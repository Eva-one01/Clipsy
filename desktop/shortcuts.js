// Atajos de teclado configurables (Ayuda/Ajustes → Atajos). Se guardan en userData/shortcuts.json.
// «quick» y «voice» son globales (funcionan desde cualquier programa); el resto, del menú de la app.
const { app, globalShortcut } = require('electron');
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  'open:search': 'CommandOrControl+K',
  quick: 'CommandOrControl+Shift+Space',
  voice: 'CommandOrControl+Shift+D',
  mini: 'CommandOrControl+Shift+T',
  'new:task': 'CommandOrControl+N',
  'new:event': 'CommandOrControl+Shift+N',
  'nav:index': 'CommandOrControl+1',
  'nav:calendar': 'CommandOrControl+2',
  'nav:lists': 'CommandOrControl+3',
  'nav:ideas': 'CommandOrControl+4',
  'nav:goals': 'CommandOrControl+5',
  'nav:finance': 'CommandOrControl+6',
  'nav:more': 'CommandOrControl+7',
  'open:settings': 'CommandOrControl+,',
};
const GLOBAL = new Set(['quick', 'voice']);
// Si nadie lo cambió y Ctrl+Shift+D está ocupado por otro programa, se prueba esta.
const VOICE_FALLBACK = 'CommandOrControl+Alt+D';

const file = () => path.join(app.getPath('userData'), 'shortcuts.json');
// Se lee la primera vez que se usa, no al cargar el módulo: main.js cambia la carpeta de datos
// (userData → «Razor») después de cargar este archivo, y leerlo antes apuntaría a otra carpeta.
let loaded = null;
function store() {
  if (!loaded) {
    try {
      loaded = JSON.parse(fs.readFileSync(file(), 'utf8')) || {};
    } catch {
      loaded = {};
    }
  }
  return loaded;
}
const failed = new Set(); // globales que otro programa ya tenía
let effective = {}; // lo que quedó registrado de verdad (con el respaldo de voz)

function get(action) {
  if (action in effective) return effective[action];
  return action in store() ? store()[action] : DEFAULTS[action] || '';
}

const KEY = /^(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Space|Tab|Return|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Up|Down|Left|Right|Plus|[,.\/;'\[\]\\`=-]|num[0-9]|numadd|numsub|nummult|numdiv|numdec)$/;
const MODS = new Set(['CommandOrControl', 'Control', 'Ctrl', 'Command', 'Cmd', 'Alt', 'Option', 'Shift', 'Super', 'Meta']);
/** Acepta «Mod+Mayús+X», «Alt+F4», «F9»… (al menos un modificador, salvo teclas F). */
function valid(acc) {
  if (acc === '') return true;
  const parts = String(acc).split('+');
  const key = parts.pop();
  if (!KEY.test(key) || parts.some((p) => !MODS.has(p)) || new Set(parts).size !== parts.length) return false;
  // Shift solo no basta (Shift+A escribe una «A»); las teclas F sí pueden ir solas.
  return parts.some((p) => p !== 'Shift') || /^F\d+$/.test(key);
}
// Combinaciones que nadie quiere perder: copiar, pegar, deshacer, cerrar ventana…
const RESERVED = new Set(['Alt+F4', 'Alt+Tab', 'CommandOrControl+C', 'CommandOrControl+V', 'CommandOrControl+X', 'CommandOrControl+Z', 'CommandOrControl+Y', 'CommandOrControl+A', 'CommandOrControl+Q', 'CommandOrControl+W', 'CommandOrControl+Shift+Z']);
const norm = (a) => String(a).replace(/^CmdOrCtrl\b/, 'CommandOrControl');

/** Registra los atajos globales. `handlers` = { quick: fn, voice?: fn } (sin voice si el dictado no existe aquí). */
function registerGlobals(handlers, paused = false) {
  globalShortcut.unregisterAll();
  failed.clear();
  effective = {};
  if (paused) return;
  for (const action of GLOBAL) {
    const fn = handlers[action];
    if (!fn) continue;
    const tries = [get(action)];
    if (action === 'voice' && !('voice' in store())) tries.push(VOICE_FALLBACK);
    let ok = false;
    for (const acc of tries.filter(Boolean)) {
      try {
        if (globalShortcut.register(acc, fn)) {
          effective[action] = acc;
          ok = true;
          break;
        }
      } catch {
        // combinación ocupada o no válida: se prueba la siguiente
      }
    }
    if (!ok && get(action)) {
      failed.add(action);
      effective[action] = '';
    }
  }
}

function list() {
  return Object.keys(DEFAULTS).map((action) => ({
    action,
    accel: get(action),
    def: DEFAULTS[action],
    global: GLOBAL.has(action),
    busy: failed.has(action), // otro programa ya usa la combinación
  }));
}

function save() {
  try {
    fs.mkdirSync(path.dirname(file()), { recursive: true });
    fs.writeFileSync(file(), JSON.stringify(store(), null, 2));
  } catch (e) {
    console.error('shortcuts', e && e.message);
  }
}

/**
 * Cambia un atajo. `accel` vacío lo quita. Devuelve { ok } o { ok: false, error: 'invalid' | 'duplicate' | 'taken', with? }.
 * `apply()` vuelve a registrar los globales y a montar el menú.
 */
function set(action, accel, apply) {
  if (!(action in DEFAULTS)) return { ok: false, error: 'invalid' };
  const next = norm(accel || '');
  if (!valid(next)) return { ok: false, error: 'invalid' };
  if (RESERVED.has(next)) return { ok: false, error: 'reserved' };
  if (next) {
    const clash = Object.keys(DEFAULTS).find((a) => a !== action && get(a) === next);
    if (clash) return { ok: false, error: 'duplicate', with: clash };
  }
  const before = action in store() ? store()[action] : undefined;
  store()[action] = next;
  apply();
  if (GLOBAL.has(action) && next && failed.has(action)) {
    // Otro programa la tiene: se deja como estaba.
    if (before === undefined) delete store()[action];
    else store()[action] = before;
    apply();
    return { ok: false, error: 'taken' };
  }
  save();
  return { ok: true };
}

function reset(apply) {
  loaded = {};
  save();
  apply();
}

module.exports = { DEFAULTS, GLOBAL, get, list, set, reset, registerGlobals, valid };
