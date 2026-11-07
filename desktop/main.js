// Clipsy para escritorio (Windows y macOS).
// Carga la versión web de la app (exportada con `expo export -p web` en ./app) dentro de una
// ventana nativa, con menús, atajos, bandeja del sistema y notificaciones del sistema.
const { app, BrowserWindow, Menu, clipboard, Tray, nativeImage, nativeTheme, protocol, net, shell, ipcMain, globalShortcut, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const strings = require('./i18n');
const license = require('./license');
const updater = require('./updater');
const sync = require('./sync');

const APP_DIR = path.join(__dirname, 'app');
const SCHEME = 'app';
const ORIGIN = `${SCHEME}://razor`;
const IS_MAC = process.platform === 'darwin';
const BG = { dark: '#0A0A0B', light: '#F6F6F4' };

// Esquema propio con origen fijo: el almacenamiento local (tus datos) persiste entre sesiones
// y las rutas de la app (/calendar, /form/task…) funcionan sin servidor.
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

app.setAppUserModelId('com.felipefranco.razor'); // necesario para las notificaciones de Windows

// La app se llamaba «Razor»: se sigue usando su carpeta de datos (%APPDATA%\\Razor, ~/Library/Application
// Support/Razor) para que nadie pierda nada al actualizar. No cambiar: ahí están los datos, la licencia y el equipo.
app.setPath('userData', path.join(app.getPath('appData'), 'Razor'));

let win = null;
let miniWin = null;
let quickWin = null;
let tray = null;
let trayNext = null; // «Reunión · 10:00»: lo próximo que va a sonar o empezar
const QUICK_SHORTCUT = 'CommandOrControl+Shift+Space';
let quickShortcutOk = false;
let quitting = false;
let lang = (app.getLocale() || 'en').slice(0, 2);
const startHidden = process.argv.includes('--hidden') || (IS_MAC && app.getLoginItemSettings().wasOpenedAtLogin);

// Solo una instancia: si se abre otra, se muestra la ventana existente.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.whenReady().then(start);
}

/* ───────────── Archivos de la app ───────────── */

// Política de seguridad: la app no se conecta a ningún servidor (connect-src 'self').
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join('; ');

function resolveFile(urlPath) {
  const rel = decodeURIComponent(urlPath).replace(/^\/+/, '');
  const full = path.normalize(path.join(APP_DIR, rel));
  if (full !== APP_DIR && !full.startsWith(APP_DIR + path.sep)) return null; // evita salir de ./app
  try {
    return fs.statSync(full).isFile() ? full : null;
  } catch {
    return null;
  }
}

function registerProtocol() {
  protocol.handle(SCHEME, async (request) => {
    const { pathname } = new URL(request.url);
    // Rutas sin extensión (/calendar, /form/task) → index.html; la app decide qué mostrar.
    const file = resolveFile(pathname) || (path.extname(pathname) ? null : path.join(APP_DIR, 'index.html'));
    if (!file) return new Response('Not found', { status: 404 });
    const res = await net.fetch(pathToFileURL(file).toString());
    const headers = new Headers(res.headers);
    headers.set('Content-Security-Policy', CSP);
    return new Response(res.body, { status: res.status, headers });
  });
}

/* ───────────── Ventana ───────────── */

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 620,
    show: false,
    title: 'Clipsy',
    backgroundColor: nativeTheme.shouldUseDarkColors ? BG.dark : BG.light,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      // Los avisos de alarmas dependen de temporizadores: no se ralentizan con la ventana oculta.
      backgroundThrottling: false,
      spellcheck: true,
    },
  });

  win.loadURL(`${ORIGIN}/`);
  win.once('ready-to-show', () => {
    if (!startHidden) win.show();
  });

  // Cerrar la ventana la oculta: Clipsy sigue en la bandeja para que suenen las alarmas.
  win.on('close', (e) => {
    if (quitting) return;
    e.preventDefault();
    win.hide();
  });

  guardNavigation(win);
}

// Enlaces externos (correo de soporte) se abren en el programa del sistema; nada más sale de la app.
function guardNavigation(w) {
  const openExternal = (url) => {
    if (/^(https?:|mailto:)/i.test(url)) shell.openExternal(url);
  };
  w.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });
  w.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(ORIGIN)) {
      e.preventDefault();
      openExternal(url);
    }
  });
}

const webPrefs = (throttle) => ({
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  backgroundThrottling: throttle,
  spellcheck: true,
});

/* ───────────── Ventanas auxiliares ───────────── */

// Posición de la ventana «Hoy» flotante entre sesiones.
const boundsFile = () => path.join(app.getPath('userData'), 'windows.json');
function readBounds() {
  try {
    return JSON.parse(fs.readFileSync(boundsFile(), 'utf8')).mini || null;
  } catch {
    return null;
  }
}
function saveBounds(b) {
  try {
    fs.writeFileSync(boundsFile(), JSON.stringify({ mini: b }));
  } catch {
    /* sin permiso de escritura: no pasa nada */
  }
}

/** Ventana «Hoy» siempre visible encima del resto: agenda, tareas y alta rápida. */
function openMini() {
  if (!license.isUnlocked()) return showWindow();
  if (miniWin) {
    miniWin.show();
    miniWin.focus();
    return;
  }
  const saved = readBounds();
  const visible = saved && screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return saved.x >= a.x - 50 && saved.y >= a.y - 50 && saved.x < a.x + a.width && saved.y < a.y + a.height;
  });
  miniWin = new BrowserWindow({
    width: visible ? saved.width : 360,
    height: visible ? saved.height : 580,
    ...(visible ? { x: saved.x, y: saved.y } : {}),
    minWidth: 300,
    minHeight: 360,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    show: false,
    title: `Clipsy — ${strings(lang).today}`,
    backgroundColor: nativeTheme.shouldUseDarkColors ? BG.dark : BG.light,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: webPrefs(true),
  });
  miniWin.setAlwaysOnTop(true, 'floating');
  miniWin.setMenuBarVisibility(false);
  miniWin.loadURL(`${ORIGIN}/mini`);
  miniWin.once('ready-to-show', () => miniWin?.show());
  const remember = () => miniWin && !miniWin.isMinimized() && saveBounds(miniWin.getBounds());
  miniWin.on('moved', remember);
  miniWin.on('resized', remember);
  miniWin.on('closed', () => {
    miniWin = null;
  });
  guardNavigation(miniWin);
}

/** Barra de alta rápida (Ctrl/⌘+Shift+Espacio desde cualquier programa). */
function toggleQuick() {
  if (!license.isUnlocked()) return showWindow();
  if (quickWin?.isVisible()) {
    quickWin.hide();
    return;
  }
  if (!quickWin) {
    quickWin = new BrowserWindow({
      width: 640,
      height: 188,
      frame: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      show: false,
      title: 'Clipsy',
      backgroundColor: nativeTheme.shouldUseDarkColors ? BG.dark : BG.light,
      webPreferences: webPrefs(true),
    });
    quickWin.setAlwaysOnTop(true, 'floating');
    quickWin.loadURL(`${ORIGIN}/quick`);
    quickWin.on('blur', () => quickWin?.hide());
    quickWin.on('close', (e) => {
      if (quitting) return;
      e.preventDefault();
      quickWin.hide();
    });
    quickWin.on('closed', () => {
      quickWin = null;
    });
    guardNavigation(quickWin);
  }
  // En la pantalla donde está el ratón, en el tercio superior.
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const [w] = quickWin.getSize();
  quickWin.setPosition(Math.round(area.x + (area.width - w) / 2), Math.round(area.y + area.height * 0.22));
  const reveal = () => {
    quickWin.show();
    quickWin.focus();
    quickWin.webContents.send('razor:quick-open');
  };
  if (quickWin.webContents.isLoading()) quickWin.webContents.once('did-finish-load', reveal);
  else reveal();
}

function registerShortcuts() {
  globalShortcut.unregisterAll();
  try {
    quickShortcutOk = globalShortcut.register(QUICK_SHORTCUT, toggleQuick);
  } catch {
    quickShortcutOk = false; // otro programa ya usa la combinación
  }
}

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function send(action) {
  showWindow();
  // Sin licencia activa, los atajos y menús no abren nada (la app muestra la pantalla de activación).
  if (!license.isUnlocked()) return;
  win?.webContents.send('razor:menu', action);
}

/* ───────────── Menús y bandeja ───────────── */

function buildMenu() {
  const s = strings(lang);
  const template = [
    ...(IS_MAC ? [{ role: 'appMenu' }] : []),
    {
      label: s.file,
      submenu: [
        { label: s.newTask, accelerator: 'CmdOrCtrl+N', click: () => send('new:task') },
        { label: s.newEvent, accelerator: 'CmdOrCtrl+Shift+N', click: () => send('new:event') },
        { label: s.newReminder, click: () => send('new:reminder') },
        { label: s.newTransaction, click: () => send('new:transaction') },
        { type: 'separator' },
        { label: s.search, accelerator: 'CmdOrCtrl+K', click: () => send('open:search') },
        { label: s.quickAdd, accelerator: QUICK_SHORTCUT, registerAccelerator: false, click: toggleQuick },
        { label: s.mini, accelerator: 'CmdOrCtrl+Shift+T', click: openMini },
        { type: 'separator' },
        { label: s.settings, accelerator: 'CmdOrCtrl+,', click: () => send('open:settings') },
        ...(IS_MAC ? [] : [{ type: 'separator' }, { label: s.quit, accelerator: 'Ctrl+Q', click: quit }]),
      ],
    },
    { role: 'editMenu' }, // copiar/pegar en los campos (imprescindible en macOS)
    {
      label: s.go,
      submenu: [
        { label: s.today, accelerator: 'CmdOrCtrl+1', click: () => send('nav:index') },
        { label: s.calendar, accelerator: 'CmdOrCtrl+2', click: () => send('nav:calendar') },
        { label: s.lists, accelerator: 'CmdOrCtrl+3', click: () => send('nav:lists') },
        { label: s.finance, accelerator: 'CmdOrCtrl+4', click: () => send('nav:finance') },
        { label: s.more, accelerator: 'CmdOrCtrl+5', click: () => send('nav:more') },
      ],
    },
    {
      label: s.view,
      submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }],
    },
    ...(IS_MAC ? [{ role: 'windowMenu' }] : []),
    { role: 'help', label: s.help, submenu: [{ label: s.helpItem, click: () => send('open:help') }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function trayIcon() {
  if (IS_MAC) {
    // Icono "plantilla": macOS lo pinta en blanco o negro según la barra de menús.
    const img = nativeImage.createFromPath(path.join(__dirname, 'build', 'trayTemplate.png'));
    img.setTemplateImage(true);
    return img;
  }
  return nativeImage.createFromPath(path.join(__dirname, 'build', 'tray.png'));
}

function buildTray() {
  const s = strings(lang);
  if (!tray) {
    tray = new Tray(trayIcon());
    tray.setToolTip('Clipsy');
    if (!IS_MAC) tray.on('click', showWindow);
  }
  tray.setToolTip(trayNext ? `Clipsy — ${trayNext}` : 'Clipsy');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      ...(trayNext ? [{ label: trayNext, enabled: false }, { type: 'separator' }] : []),
      { label: s.open, click: showWindow },
      { label: s.mini, click: openMini },
      { label: quickShortcutOk ? `${s.quickAdd}  (${IS_MAC ? '⌘⇧Space' : 'Ctrl+Shift+Space'})` : s.quickAdd, click: toggleQuick },
      { type: 'separator' },
      { label: s.newTask, click: () => send('new:task') },
      { label: s.newEvent, click: () => send('new:event') },
      { type: 'separator' },
      { label: s.quit, click: quit },
    ]),
  );
}

function quit() {
  quitting = true;
  app.quit();
}

/* ───────────── Comunicación con la interfaz ───────────── */

function registerIpc() {
  ipcMain.on('razor:info', (e) => {
    e.returnValue = { platform: process.platform, version: app.getVersion() };
  });
  ipcMain.on('razor:focus', showWindow);
  ipcMain.on('razor:open-mini', openMini);
  ipcMain.on('razor:hide-quick', () => quickWin?.hide());
  // Desde las ventanas auxiliares: abre la ventana principal en una pantalla de la app.
  ipcMain.on('razor:open-in-main', (_e, route) => {
    const r = String(route);
    if (!/^\/[a-z0-9/_-]*(\?[a-z0-9=&_-]*)?$/i.test(r)) return;
    showWindow();
    if (license.isUnlocked()) win?.webContents.send('razor:navigate', r);
  });
  ipcMain.on('razor:tray-info', (_e, label) => {
    const next = label ? String(label).slice(0, 80) : null;
    if (next === trayNext) return;
    trayNext = next;
    buildTray();
  });
  ipcMain.on('razor:copy', (_e, text) => clipboard.writeText(String(text).slice(0, 10000)));
  ipcMain.on('razor:language', (_e, value) => {
    const next = String(value).slice(0, 2);
    if (next === lang) return;
    lang = next;
    buildMenu();
    buildTray();
  });
  ipcMain.on('razor:theme', (_e, value) => {
    nativeTheme.themeSource = ['light', 'dark'].includes(value) ? value : 'system';
    win?.setBackgroundColor(nativeTheme.shouldUseDarkColors ? BG.dark : BG.light);
  });
  // Licencia
  ipcMain.handle('razor:license:get', () => license.get());
  ipcMain.handle('razor:license:activate', (_e, email, password) => license.activate(email, password));
  ipcMain.handle('razor:license:deactivate', () => license.deactivate());
  ipcMain.handle('razor:license:refresh', () => license.refresh());
  // Sincronización cifrada
  sync.register(ipcMain);
  // Actualizaciones
  ipcMain.handle('razor:update:get', () => updater.get());
  ipcMain.handle('razor:update:check', () => updater.check());
  ipcMain.on('razor:update:install', () => updater.install());
  // Abre páginas de la web de Clipsy (comprar, recuperar contraseña, gestionar equipos).
  ipcMain.on('razor:open-site', (_e, where) => {
    const allowed = { buy: '/account?buy=1', account: '/account', devices: '/account#license', forgot: '/account', downloads: '/account#downloads' };
    if (allowed[where] && /^https:\/\//.test(license.siteUrl)) shell.openExternal(license.siteUrl + allowed[where]);
  });
  ipcMain.handle('razor:get-open-at-login', () => app.getLoginItemSettings().openAtLogin);
  ipcMain.handle('razor:set-open-at-login', (_e, value) => {
    // En Windows se abre oculto con --hidden; en macOS se detecta con wasOpenedAtLogin.
    app.setLoginItemSettings({ openAtLogin: Boolean(value), args: ['--hidden'] });
    return app.getLoginItemSettings().openAtLogin;
  });
}

/* ───────────── Arranque ───────────── */

function start() {
  registerProtocol();
  registerIpc();
  createWindow();
  registerShortcuts();
  buildMenu();
  buildTray();
  license.init((st) => win?.webContents.send('razor:license', st));
  updater.init(
    (st) => win?.webContents.send('razor:update', st),
    () => {
      quitting = true; // la ventana no se esconde en la bandeja: se cierra para instalar
    },
  );

  app.on('activate', showWindow); // clic en el Dock (macOS)
  app.on('before-quit', () => {
    quitting = true;
  });
  app.on('will-quit', () => globalShortcut.unregisterAll());
}
