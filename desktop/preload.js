// Puente seguro entre la interfaz (sin acceso a Node) y el proceso principal.
// Solo expone lo que la app necesita; ver src/desktop/bridge.ts.
const { contextBridge, ipcRenderer } = require('electron');

const info = ipcRenderer.sendSync('razor:info');

contextBridge.exposeInMainWorld('razorDesktop', {
  platform: info.platform,
  version: info.version,
  focus: () => ipcRenderer.send('razor:focus'),
  openMini: () => ipcRenderer.send('razor:open-mini'),
  hideQuick: () => ipcRenderer.send('razor:hide-quick'),
  openInMain: (route) => ipcRenderer.send('razor:open-in-main', String(route)),
  setTrayInfo: (label) => ipcRenderer.send('razor:tray-info', label ? String(label) : null),
  onQuickOpen: (cb) => {
    const h = () => cb();
    ipcRenderer.on('razor:quick-open', h);
    return () => ipcRenderer.removeListener('razor:quick-open', h);
  },
  onNavigate: (cb) => {
    const h = (_e, route) => cb(String(route));
    ipcRenderer.on('razor:navigate', h);
    return () => ipcRenderer.removeListener('razor:navigate', h);
  },
  copyText: (text) => ipcRenderer.send('razor:copy', String(text)),
  setLanguage: (lang) => ipcRenderer.send('razor:language', String(lang)),
  setTheme: (theme) => ipcRenderer.send('razor:theme', String(theme)),
  getOpenAtLogin: () => ipcRenderer.invoke('razor:get-open-at-login'),
  setOpenAtLogin: (value) => ipcRenderer.invoke('razor:set-open-at-login', Boolean(value)),
  openSite: (where) => ipcRenderer.send('razor:open-site', String(where)),
  license: {
    get: () => ipcRenderer.invoke('razor:license:get'),
    activate: (email, password) => ipcRenderer.invoke('razor:license:activate', String(email), String(password)),
    deactivate: () => ipcRenderer.invoke('razor:license:deactivate'),
    refresh: () => ipcRenderer.invoke('razor:license:refresh'),
    onChange: (cb) => {
      const h = (_e, st) => cb(st);
      ipcRenderer.on('razor:license', h);
      return () => ipcRenderer.removeListener('razor:license', h);
    },
  },
  sync: {
    get: () => ipcRenderer.invoke('razor:sync:get'),
    put: (baseVersion, blob, salt) => ipcRenderer.invoke('razor:sync:put', Number(baseVersion), String(blob), String(salt)),
    remove: () => ipcRenderer.invoke('razor:sync:delete'),
    getKey: () => ipcRenderer.invoke('razor:sync:key:get'),
    setKey: (b64) => ipcRenderer.invoke('razor:sync:key:set', String(b64)),
    clearKey: () => ipcRenderer.invoke('razor:sync:key:clear'),
  },
  updates: {
    get: () => ipcRenderer.invoke('razor:update:get'),
    check: () => ipcRenderer.invoke('razor:update:check'),
    install: () => ipcRenderer.send('razor:update:install'),
    onChange: (cb) => {
      const h = (_e, st) => cb(st);
      ipcRenderer.on('razor:update', h);
      return () => ipcRenderer.removeListener('razor:update', h);
    },
  },
  onMenu: (cb) => {
    const handler = (_event, action) => cb(action);
    ipcRenderer.on('razor:menu', handler);
    return () => ipcRenderer.removeListener('razor:menu', handler);
  },
});
