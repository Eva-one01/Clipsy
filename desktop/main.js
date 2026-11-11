// Clipsy para escritorio (Windows y macOS).
// Carga la versión web de la app (exportada con `expo export -p web` en ./app) dentro de una
// ventana nativa, con menús, atajos, bandeja del sistema y notificaciones del sistema.
const { app, BrowserWindow, Menu, clipboard, Tray, nativeImage, nativeTheme, protocol, net, shell, ipcMain, globalShortcut, screen, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const strings = require('./i18n');
const license = require('./license');
const updater = require('./updater');
const sync = require('./sync');
const voice = require('./voice');
const importer = require('./importer');
const shortcuts = require('./shortcuts');
const weather = require('./weather');
const backups = require('./backups');

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

// Informes de errores (Sentry): justo después de fijar la carpeta de datos, antes de que la app esté lista.
const errors = require('./errors');
errors.init();

let win = null;
let miniWin = null;
let quickWin = null;
let tray = null;
let trayNext = null; // «Reunión · 10:00»: lo próximo que va a sonar o empezar
// Atajos: configurables desde Ajustes/Ayuda (desktop/shortcuts.js). Por defecto, Ctrl+Shift+Espacio
// abre la barra rápida y Ctrl+Shift+D dicta («D» de dictar; si otro programa la tiene, Ctrl+Alt+D).
// Ctrl+Alt+Espacio lo usa la app de Claude y Alt+Espacio el lanzador de PowerToys y ChatGPT.
const IS_WIN = process.platform === 'win32';
const TITLE_H = 36; // barra de título propia en Windows (con el aviso de actualización junto a minimizar)
let shortcutsPausedTimer = null;
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
  // En portátiles con pantalla pequeña o escalado de Windows al 125-150 % (p. ej. 1366×768 → 1093×582
  // útiles), 1200×800 y un mínimo de 900×620 no cabían: la ventana quedaba cortada por abajo.
  const area = screen.getPrimaryDisplay().workAreaSize;
  const fit = (want, avail) => Math.min(want, Math.round(avail * 0.92));
  win = new BrowserWindow({
    width: fit(1200, area.width),
    height: fit(800, area.height),
    minWidth: Math.min(900, area.width),
    minHeight: Math.min(620, area.height),
    center: true,
    // Windows: la app dibuja su barra de título (para poner el aviso de actualización junto a minimizar);
    // los botones de minimizar, maximizar y cerrar siguen siendo los del sistema.
    ...(IS_WIN
      ? {
          titleBarStyle: 'hidden',
          titleBarOverlay: {
            color: nativeTheme.shouldUseDarkColors ? BG.dark : BG.light,
            symbolColor: nativeTheme.shouldUseDarkColors ? '#F2F2F0' : '#0E0E10',
            height: TITLE_H,
          },
        }
      : {}),
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

/** Barra de alta rápida (Ctrl/⌘+Shift+Espacio desde cualquier programa). Con `listen`, empieza a escuchar. */
function toggleQuick(listen = false) {
  if (!license.isUnlocked()) return showWindow();
  if (quickWin?.isVisible()) {
    // Con el atajo de voz, la barra abierta empieza o deja de escuchar en vez de cerrarse.
    if (listen === true) quickWin.webContents.send('razor:quick-voice');
    else quickWin.hide();
    return;
  }
  if (!quickWin) {
    quickWin = new BrowserWindow({
      // Ancho fijo; la altura la ajusta la propia barra a su contenido (razor:quick-size).
      width: 720,
      height: 196,
      useContentSize: true,
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
    if (listen === true) quickWin.webContents.send('razor:quick-voice');
  };
  if (quickWin.webContents.isLoading()) quickWin.webContents.once('did-finish-load', reveal);
  else reveal();
}

function registerShortcuts(paused = false) {
  shortcuts.registerGlobals({ quick: () => toggleQuick(), ...(voice.supported ? { voice: () => toggleQuick(true) } : {}) }, paused);
}

/** Tras cambiar un atajo: globales, menú, bandeja y la interfaz de todas las ventanas. */
function applyShortcuts() {
  registerShortcuts();
  buildMenu();
  buildTray();
  const list = shortcuts.list();
  for (const w of [win, quickWin, miniWin]) if (w && !w.isDestroyed()) w.webContents.send('razor:shortcuts', list);
}

/** «CommandOrControl+Shift+Space» → «Ctrl+Shift+Space» (o ⌘ en Mac) para la bandeja. */
function accLabel(acc) {
  return acc ? acc.replace(/^CommandOrControl|^CmdOrCtrl/, IS_MAC ? '⌘' : 'Ctrl') : '';
}
/** Atajo del menú para una acción (vacío si la persona lo quitó). */
function acc(action, extra = {}) {
  const a = shortcuts.get(action);
  return a ? { accelerator: a, ...extra } : {};
}

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  updater.checkIfStale(); // cada vez que se abre Clipsy, mira si hay versión nueva
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
        { label: s.newTask, ...acc('new:task'), click: () => send('new:task') },
        { label: s.newEvent, ...acc('new:event'), click: () => send('new:event') },
        { label: s.newReminder, click: () => send('new:reminder') },
        { label: s.newTransaction, click: () => send('new:transaction') },
        { type: 'separator' },
        { label: s.search, ...acc('open:search'), click: () => send('open:search') },
        { label: s.quickAdd, ...acc('quick', { registerAccelerator: false }), click: () => toggleQuick() },
        ...(voice.supported ? [{ label: s.voice, ...acc('voice', { registerAccelerator: false }), click: () => toggleQuick(true) }] : []),
        { label: s.mini, ...acc('mini'), click: openMini },
        { type: 'separator' },
        { label: s.settings, ...acc('open:settings'), click: () => send('open:settings') },
        ...(IS_MAC ? [] : [{ type: 'separator' }, { label: s.quit, accelerator: 'Ctrl+Q', click: quit }]),
      ],
    },
    { role: 'editMenu' }, // copiar/pegar en los campos (imprescindible en macOS)
    {
      label: s.go,
      submenu: [
        { label: s.today, ...acc('nav:index'), click: () => send('nav:index') },
        { label: s.calendar, ...acc('nav:calendar'), click: () => send('nav:calendar') },
        { label: s.lists, ...acc('nav:lists'), click: () => send('nav:lists') },
        { label: s.ideas, ...acc('nav:ideas'), click: () => send('nav:ideas') },
        { label: s.goals, ...acc('nav:goals'), click: () => send('nav:goals') },
        { label: s.finance, ...acc('nav:finance'), click: () => send('nav:finance') },
        { label: s.more, ...acc('nav:more'), click: () => send('nav:more') },
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
      { label: shortcuts.get('quick') ? `${s.quickAdd}  (${accLabel(shortcuts.get('quick'))})` : s.quickAdd, click: () => toggleQuick() },
      ...(voice.supported ? [{ label: shortcuts.get('voice') ? `${s.voice}  (${accLabel(shortcuts.get('voice'))})` : s.voice, click: () => toggleQuick(true) }] : []),
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
    e.returnValue = {
      platform: process.platform,
      version: app.getVersion(),
      voiceShortcut: shortcuts.get('voice') || null,
      shortcuts: shortcuts.list(),
      // Solo la ventana principal de Windows dibuja su propia barra de título.
      titleBar: IS_WIN && !!win && e.sender === win.webContents ? TITLE_H : 0,
    };
  });
  ipcMain.on('razor:focus', showWindow);
  ipcMain.on('razor:open-mini', openMini);
  ipcMain.on('razor:hide-quick', () => quickWin?.hide());
  // Clima de «Hoy» (solo si la persona lo activa; ver desktop/weather.js)
  weather.register(ipcMain);
  // Atajos configurables
  ipcMain.handle('razor:shortcuts:list', () => shortcuts.list());
  ipcMain.handle('razor:shortcuts:set', (_e, action, accel) => {
    const res = shortcuts.set(String(action), String(accel ?? ''), applyShortcuts);
    return { ...res, list: shortcuts.list() };
  });
  ipcMain.handle('razor:shortcuts:reset', () => {
    shortcuts.reset(applyShortcuts);
    return shortcuts.list();
  });
  // Mientras se graba una combinación, los atajos actuales no deben dispararse (se reactivan solos a los 20 s).
  ipcMain.on('razor:shortcuts:pause', (_e, paused) => {
    clearTimeout(shortcutsPausedTimer);
    if (paused) {
      registerShortcuts(true);
      Menu.setApplicationMenu(null);
      shortcutsPausedTimer = setTimeout(applyShortcuts, 20000);
    } else applyShortcuts();
  });
  // Barra de título propia (Windows): colores de los botones del sistema según el tema de la app.
  ipcMain.on('razor:titlebar', (_e, color, symbol) => {
    const hex = /^#[0-9a-f]{6}$/i;
    if (!IS_WIN || !win || win.isDestroyed() || !hex.test(color) || !hex.test(symbol)) return;
    try {
      win.setTitleBarOverlay({ color, symbolColor: symbol, height: TITLE_H });
    } catch {}
  });
  // Botón del micrófono de la ventana principal: abre la barra rápida ya escuchando.
  ipcMain.on('razor:quick-voice-open', () => toggleQuick(true));
  // La barra rápida pide la altura que necesita su contenido (cambia con el tamaño de letra y el escalado de Windows).
  ipcMain.on('razor:quick-size', (_e, h) => {
    const height = Math.round(Math.min(420, Math.max(120, Number(h) || 0)));
    if (!quickWin || quickWin.isDestroyed()) return;
    const [w, cur] = quickWin.getContentSize();
    if (Math.abs(cur - height) > 1) quickWin.setContentSize(w, height);
  });
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
  // Importar archivos (Excel, CSV, Word, PDF, texto y fotos), leídos en el equipo
  importer.register(ipcMain, () => BrowserWindow.getFocusedWindow() || win);
  // Dictado por voz (whisper.cpp en el equipo)
  voice.register(ipcMain, (st) => {
    for (const w of [win, quickWin]) if (w && !w.isDestroyed()) w.webContents.send('razor:voice', st);
  });
  // Actualizaciones
  ipcMain.handle('razor:update:get', () => updater.get());
  ipcMain.handle('razor:update:check', () => updater.check());
  ipcMain.on('razor:update:install', (_e, opts) => updater.install({ visible: !!(opts && opts.visible) }));
  ipcMain.on('razor:update:dismiss', () => updater.dismiss());
  ipcMain.on('razor:error', (_e, p) => errors.report(p));
  ipcMain.handle('razor:errors:get', () => errors.get());
  ipcMain.handle('razor:errors:set', (_e, v) => errors.setEnabled(!!v));
  ipcMain.handle('razor:errors:test', () => errors.test());
  ipcMain.handle('razor:backups:list', () => backups.list());
  ipcMain.handle('razor:backups:saveDaily', (_e, day, text) => backups.saveDaily(day, text));
  ipcMain.handle('razor:backups:saveSafety', (_e, text) => backups.saveSafety(text));
  ipcMain.handle('razor:backups:read', (_e, name) => backups.read(name));
  ipcMain.handle('razor:backups:openFolder', () => backups.openFolder());
  ipcMain.on('razor:update:download', () => updater.openDownloads());
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

// Micrófono: solo para la propia app y solo audio (lo usa el dictado). El resto de permisos, como hasta ahora.
function registerPermissions() {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback, details) => {
    if (permission === 'media') {
      const types = details.mediaTypes || [];
      return callback(String(details.requestingUrl || '').startsWith(ORIGIN) && types.length > 0 && types.every((t) => t === 'audio'));
    }
    callback(true);
  });
}

function start() {
  registerProtocol();
  registerPermissions();
  registerIpc();
  registerShortcuts(); // antes de abrir ventanas: la interfaz lee qué atajo de voz quedó registrado
  createWindow();
  buildMenu();
  buildTray();
  license.init((st) => win?.webContents.send('razor:license', st));
  updater.init(
    (st) => win?.webContents.send('razor:update', st),
    () => {
      quitting = true; // la ventana no se esconde en la bandeja: se cierra para instalar
      try {
        tray?.destroy();
        tray = null;
      } catch {}
    },
  );

  app.on('activate', showWindow); // clic en el Dock (macOS)
  app.on('before-quit', () => {
    quitting = true;
    updater.noteQuit();
  });
  app.on('will-quit', () => globalShortcut.unregisterAll());
}
