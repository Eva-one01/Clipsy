// Actualizaciones automáticas (proceso principal).
// Windows: electron-updater descarga la versión nueva en segundo plano y se instala al reiniciar.
// macOS sin firmar: Apple no permite instalar solo, así que se avisa y se abre la página de descargas.
// Las actualizaciones nunca tocan tus datos: viven en otra carpeta (userData).
const fs = require('fs');
const path = require('path');
const { app, shell } = require('electron');
const CFG = require('./config');
const license = require('./license');

let autoUpdater = null;
try {
  ({ autoUpdater } = require('electron-updater'));
} catch {}

const IS_MAC = process.platform === 'darwin';
const native = () => !!autoUpdater && (!IS_MAC || CFG.macAutoUpdate);
const enabled = () => app.isPackaged && !/TU-PROYECTO/.test(CFG.updatesUrl);

/** Registro de actualizaciones (carpeta de datos → logs/updater.log) para saber por qué falla una instalación. */
function logFile() {
  return path.join(app.getPath('userData'), 'logs', 'updater.log');
}
function log(level, ...args) {
  try {
    const f = logFile();
    fs.mkdirSync(path.dirname(f), { recursive: true });
    if (fs.existsSync(f) && fs.statSync(f).size > 512 * 1024) fs.renameSync(f, f + '.old');
    const msg = args.map((a) => (a instanceof Error ? a.stack || a.message : typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    fs.appendFileSync(f, `${new Date().toISOString()} [${level}] ${msg}\n`);
  } catch {}
}
const logger = { info: (...a) => log('info', ...a), warn: (...a) => log('warn', ...a), error: (...a) => log('error', ...a), debug: () => {} };

/** ¿Se puede escribir en la carpeta donde está instalada la app? (si no, el instalador necesita permisos de administrador) */
function installDirWritable() {
  try {
    fs.accessSync(path.dirname(process.execPath), fs.constants.W_OK);
    const probe = path.join(path.dirname(process.execPath), `.clipsy-write-test-${process.pid}`);
    fs.writeFileSync(probe, '');
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

let state = { status: 'idle', current: app.getVersion() };
let lastCheck = 0;
let listener = () => {};
let beforeInstall = () => {};
function set(patch) {
  state = Object.assign({}, state, patch);
  listener(state);
}

function newer(a, b) {
  const pa = String(a).split(/[.-]/).map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split(/[.-]/).map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  return false;
}

async function manualCheck() {
  const name = IS_MAC ? 'latest-mac.yml' : 'latest.yml';
  const res = await fetch(`${CFG.updatesUrl.replace(/\/$/, '')}/${name}?t=${Date.now()}`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error('feed');
  const m = (await res.text()).match(/^version:\s*['"]?([\w.-]+)/m);
  if (m && newer(m[1], app.getVersion())) set({ status: 'available', version: m[1], manual: true });
  else set({ status: 'none' });
}

async function check() {
  if (!enabled()) return set({ status: 'disabled' }), state;
  if (['checking', 'downloading', 'ready'].includes(state.status)) return state;
  lastCheck = Date.now();
  set({ status: 'checking', error: undefined });
  try {
    if (native()) await autoUpdater.checkForUpdates();
    else await manualCheck();
  } catch (e) {
    logger.error('check', e);
    set({ status: 'error' });
  }
  return state;
}

function install() {
  if (state.status === 'ready' && native()) {
    // Si la app está en una carpeta protegida (p. ej. Archivos de programa), el instalador en silencio no
    // puede escribir ahí: se abre visible para que Windows pida permiso de administrador.
    const silent = process.platform !== 'win32' || installDirWritable();
    logger.info(`Instalar ${state.version} desde ${app.getVersion()} · carpeta ${path.dirname(process.execPath)} · silencioso ${silent}`);
    beforeInstall();
    // Se cierra todo antes de lanzar el instalador; la app se vuelve a abrir sola al terminar.
    setImmediate(() => {
      try {
        autoUpdater.quitAndInstall(silent, true);
      } catch (e) {
        logger.error('quitAndInstall', e);
        set({ status: 'error' });
      }
    });
  } else if (state.status === 'available' && state.manual) {
    shell.openExternal(license.accountUrl('downloads'));
  }
}

function init(onChange, onBeforeInstall) {
  listener = onChange || listener;
  beforeInstall = onBeforeInstall || beforeInstall;
  if (!enabled()) return set({ status: 'disabled' });
  if (native()) {
    autoUpdater.logger = logger;
    autoUpdater.setFeedURL({ provider: 'generic', url: CFG.updatesUrl });
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true; // si no reinicia, se instala al salir
    autoUpdater.on('update-available', (i) => set({ status: 'downloading', version: i.version, progress: 0 }));
    autoUpdater.on('update-not-available', () => set({ status: 'none' }));
    autoUpdater.on('download-progress', (p) => set({ status: 'downloading', progress: Math.round(p.percent) }));
    autoUpdater.on('update-downloaded', (i) => set({ status: 'ready', version: i.version }));
    autoUpdater.on('error', (e) => {
      logger.error('updater', e);
      set({ status: 'error' });
    });
  }
  // Al abrir la app se revisa enseguida; si hay versión nueva, se descarga y se pide actualizar.
  setTimeout(check, 2 * 1000);
  // Revisar cuesta casi nada (latest.yml pesa menos de 1 KB); la descarga solo ocurre si hay versión nueva.
  setInterval(check, 10 * 60 * 1000).unref?.();
}

/** Al volver a mostrar la ventana: revisa si pasaron más de 10 minutos desde la última vez. */
function checkIfStale() {
  if (enabled() && Date.now() - lastCheck > 10 * 60 * 1000) check();
}

module.exports = { init, check, checkIfStale, install, get: () => state };
