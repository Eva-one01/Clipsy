// Actualizaciones automáticas (proceso principal).
// Windows: electron-updater descarga la versión nueva en segundo plano y se instala al reiniciar.
// macOS sin firmar: Apple no permite instalar solo, así que se avisa y se abre la página de descargas.
// Las actualizaciones nunca tocan tus datos: viven en otra carpeta (userData).
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
  } catch {
    set({ status: 'error' });
  }
  return state;
}

function install() {
  if (state.status === 'ready' && native()) {
    beforeInstall();
    autoUpdater.quitAndInstall(false, true);
  } else if (state.status === 'available' && state.manual) {
    shell.openExternal(license.accountUrl('downloads'));
  }
}

function init(onChange, onBeforeInstall) {
  listener = onChange || listener;
  beforeInstall = onBeforeInstall || beforeInstall;
  if (!enabled()) return set({ status: 'disabled' });
  if (native()) {
    autoUpdater.setFeedURL({ provider: 'generic', url: CFG.updatesUrl });
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true; // si no reinicia, se instala al salir
    autoUpdater.on('update-available', (i) => set({ status: 'downloading', version: i.version, progress: 0 }));
    autoUpdater.on('update-not-available', () => set({ status: 'none' }));
    autoUpdater.on('download-progress', (p) => set({ status: 'downloading', progress: Math.round(p.percent) }));
    autoUpdater.on('update-downloaded', (i) => set({ status: 'ready', version: i.version }));
    autoUpdater.on('error', () => set({ status: 'error' }));
  }
  // Al abrir la app se revisa enseguida; si hay versión nueva, se descarga y se pide actualizar.
  setTimeout(check, 2 * 1000);
  setInterval(check, 6 * 60 * 60 * 1000).unref?.();
}

/** Al volver a mostrar la ventana: revisa si pasó un rato desde la última vez. */
function checkIfStale() {
  if (enabled() && Date.now() - lastCheck > 30 * 60 * 1000) check();
}

module.exports = { init, check, checkIfStale, install, get: () => state };
