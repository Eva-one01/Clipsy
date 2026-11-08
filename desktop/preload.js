// Puente seguro entre la interfaz (sin acceso a Node) y el proceso principal.
// Solo expone lo que la app necesita; ver src/desktop/bridge.ts.
const { contextBridge, ipcRenderer } = require('electron');

const info = ipcRenderer.sendSync('razor:info');

contextBridge.exposeInMainWorld('razorDesktop', {
  platform: info.platform,
  version: info.version,
  focus: () => ipcRenderer.send('razor:focus'),
  openMini: () => ipcRenderer.send('razor:open-mini'),
  voiceShortcut: info.voiceShortcut || null,
  titleBar: info.titleBar || 0,
  setTitleBar: (color, symbol) => ipcRenderer.send('razor:titlebar', String(color), String(symbol)),
  shortcuts: {
    initial: info.shortcuts || [],
    list: () => ipcRenderer.invoke('razor:shortcuts:list'),
    set: (action, accel) => ipcRenderer.invoke('razor:shortcuts:set', String(action), String(accel ?? '')),
    reset: () => ipcRenderer.invoke('razor:shortcuts:reset'),
    pause: (paused) => ipcRenderer.send('razor:shortcuts:pause', !!paused),
    onChange: (cb) => {
      const h = (_e, list) => cb(list);
      ipcRenderer.on('razor:shortcuts', h);
      return () => ipcRenderer.removeListener('razor:shortcuts', h);
    },
  },
  hideQuick: () => ipcRenderer.send('razor:hide-quick'),
  openQuickVoice: () => ipcRenderer.send('razor:quick-voice-open'),
  setQuickHeight: (h) => ipcRenderer.send('razor:quick-size', Number(h)),
  openInMain: (route) => ipcRenderer.send('razor:open-in-main', String(route)),
  setTrayInfo: (label) => ipcRenderer.send('razor:tray-info', label ? String(label) : null),
  onQuickOpen: (cb) => {
    const h = () => cb();
    ipcRenderer.on('razor:quick-open', h);
    return () => ipcRenderer.removeListener('razor:quick-open', h);
  },
  onQuickVoice: (cb) => {
    const h = () => cb();
    ipcRenderer.on('razor:quick-voice', h);
    return () => ipcRenderer.removeListener('razor:quick-voice', h);
  },
  importer: {
    // Abre el diálogo del sistema; el archivo se lee en el equipo y vuelve como filas de texto.
    pick: (lang) => ipcRenderer.invoke('razor:import:pick', String(lang || '')),
    info: () => ipcRenderer.invoke('razor:import:info'),
  },
  voice: {
    status: () => ipcRenderer.invoke('razor:voice:status'),
    install: () => ipcRenderer.invoke('razor:voice:install'),
    remove: () => ipcRenderer.invoke('razor:voice:remove'),
    // WAV mono de 16 kHz → { ok, text } (todo se procesa en el equipo)
    transcribe: (wav, lang) => ipcRenderer.invoke('razor:voice:transcribe', new Uint8Array(wav), String(lang)),
    onChange: (cb) => {
      const h = (_e, st) => cb(st);
      ipcRenderer.on('razor:voice', h);
      return () => ipcRenderer.removeListener('razor:voice', h);
    },
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
