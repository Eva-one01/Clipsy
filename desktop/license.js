// Licencias de Clipsy (proceso principal).
// La app solo funciona en equipos activados con una cuenta que haya comprado Clipsy.
// El servidor firma un token (Ed25519) ligado a este equipo; la app lo verifica sin conexión
// con la clave pública y lo renueva periódicamente. Así detecta reembolsos y equipos quitados.
// Sin compra, el servidor da una prueba gratuita de 7 días: el token lleva su fin (exp) y la app
// deja de funcionar al llegar, aunque no haya conexión. Al comprar, la siguiente renovación ya es completa.
const { app } = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const CFG = require('./config');

const DAY = 24 * 60 * 60 * 1000;
const REFRESH_AFTER = DAY; // renueva el token una vez al día como mucho
const REFRESH_AFTER_TRIAL = 3 * 60 * 60 * 1000; // en prueba, más a menudo: así se nota antes la compra
let expiryTimer = null;
let state = { status: 'checking' };
let listener = () => {};

const file = (name) => path.join(app.getPath('userData'), name);
const configured = () => !/TU-DOMINIO|TU-PROYECTO|TU-ANON-KEY|PEGA-AQUI/.test(JSON.stringify(CFG));
// En desarrollo (npm run desktop:dev) no se pide licencia, salvo que se fuerce con RAZOR_REQUIRE_LICENSE=1.
const bypass = () => !app.isPackaged && process.env.RAZOR_REQUIRE_LICENSE !== '1';

function readJson(name) {
  try {
    return JSON.parse(fs.readFileSync(file(name), 'utf8'));
  } catch {
    return null;
  }
}
function writeJson(name, data) {
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(file(name), JSON.stringify(data), { mode: 0o600 });
}

/** Identificador aleatorio de este equipo (se crea una vez y se guarda junto a los datos). */
function deviceId() {
  const saved = readJson('device.json');
  if (saved && typeof saved.id === 'string') return saved.id;
  const id = crypto.randomUUID();
  writeJson('device.json', { id });
  return id;
}

let publicKey = null;
function verify(token) {
  try {
    if (!publicKey) publicKey = crypto.createPublicKey(CFG.licensePublicKey);
    const [body, sig] = String(token).split('.');
    if (!body || !sig) return null;
    if (!crypto.verify(null, Buffer.from(body), publicKey, Buffer.from(sig, 'base64url'))) return null;
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function set(next) {
  state = next;
  // Al terminar la prueba, la app se bloquea en ese momento (sin esperar a la próxima renovación).
  if (expiryTimer) clearTimeout(expiryTimer);
  if (state.status === 'valid' && state.trialEndsAt) {
    const ms = state.trialEndsAt - Date.now();
    if (ms > 0 && ms < 2 ** 31 - 1) expiryTimer = setTimeout(() => set(strip(local())), ms + 1000);
  }
  listener(state);
}

/** Estado según el token guardado, sin red. */
function local() {
  const saved = readJson('license.json');
  if (!saved || !saved.token) return { status: 'none' };
  const p = verify(saved.token);
  if (!p || p.did !== deviceId()) return { status: 'none' };
  const age = Date.now() - p.iat * 1000;
  const base = { email: p.email, checkedAt: p.iat * 1000, token: saved.token };
  if (p.trial && p.exp) {
    const trialEndsAt = p.exp * 1000;
    if (Date.now() >= trialEndsAt) return { ...base, status: 'trial_expired', trialEndsAt };
    return { ...base, status: 'valid', trialEndsAt };
  }
  return age > CFG.offlineGraceDays * DAY ? { ...base, status: 'offline' } : { ...base, status: 'valid' };
}

async function post(url, body, headers) {
  const res = await fetch(url, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  let data = {};
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, ok: res.ok, data };
}

function save(token) {
  const p = verify(token);
  if (!p || p.did !== deviceId()) throw new Error('bad_token');
  writeJson('license.json', { token });
  return p;
}

/** Renueva el token con el servidor. Sin conexión, se mantiene el estado local. */
async function refresh(force) {
  if (bypass() || !configured()) return state;
  const cur = local();
  if (!cur.token) return set(cur), state;
  if (!force && cur.status === 'valid' && Date.now() - cur.checkedAt < (cur.trialEndsAt ? REFRESH_AFTER_TRIAL : REFRESH_AFTER)) return set(strip(cur)), state;
  try {
    const r = await post(`${CFG.siteUrl}/api/license/refresh`, { token: cur.token });
    if (r.ok && r.data.token) {
      save(r.data.token);
      set(strip(local()));
    } else if (r.status === 403 && r.data.error === 'trial_expired') {
      // Se conserva el token: si compra, «Ya lo compré» lo renueva sin volver a iniciar sesión.
      set({ status: 'trial_expired', email: cur.email, checkedAt: cur.checkedAt, trialEndsAt: r.data.endsAt || cur.trialEndsAt });
    } else if (r.status === 403 || r.status === 401) {
      // Reembolso, equipo quitado desde la web o cuenta eliminada.
      try {
        fs.unlinkSync(file('license.json'));
      } catch {}
      set({ status: 'revoked', reason: r.data.error || 'revoked', email: cur.email });
    } else {
      set(strip(cur));
    }
  } catch {
    set(strip(cur)); // sin conexión: sigue funcionando dentro del periodo de gracia
  }
  return state;
}
const strip = (s) => ({ status: s.status, email: s.email, checkedAt: s.checkedAt, ...(s.trialEndsAt ? { trialEndsAt: s.trialEndsAt } : {}) });

/** Inicia sesión con la cuenta de la web y activa este equipo. */
async function activate(email, password) {
  if (!configured()) return { ok: false, error: 'unconfigured' };
  email = String(email || '').trim();
  try {
    const auth = await post(
      `${CFG.supabaseUrl}/auth/v1/token?grant_type=password`,
      { email, password: String(password || '') },
      { apikey: CFG.supabaseAnonKey },
    );
    if (!auth.ok) {
      const msg = String(auth.data.error_description || auth.data.msg || auth.data.message || '').toLowerCase();
      if (auth.status === 429) return { ok: false, error: 'rate' };
      if (msg.includes('not confirmed')) return { ok: false, error: 'unconfirmed' };
      return { ok: false, error: 'invalid' };
    }
    const r = await post(
      `${CFG.siteUrl}/api/license/activate`,
      { deviceId: deviceId(), name: os.hostname().slice(0, 60), platform: process.platform },
      { Authorization: 'Bearer ' + auth.data.access_token },
    );
    if (!r.ok || !r.data.token) return { ok: false, error: r.data.error || 'generic', limit: r.data.limit };
    save(r.data.token);
    set(strip(local()));
    return { ok: true };
  } catch {
    return { ok: false, error: 'network' };
  }
}

/** Cierra la sesión en este equipo y libera su plaza. */
async function deactivate() {
  const cur = local();
  if (cur.token && configured()) {
    try {
      await post(`${CFG.siteUrl}/api/license/deactivate`, { token: cur.token });
    } catch {}
  }
  try {
    fs.unlinkSync(file('license.json'));
  } catch {}
  set({ status: 'none' });
  return state;
}

function init(onChange) {
  listener = onChange || listener;
  if (bypass()) return set({ status: 'valid', email: 'desarrollo', dev: true });
  if (!configured()) return set({ status: 'unconfigured' });
  set(strip(local()));
  refresh(false);
  setInterval(() => refresh(false), 6 * 60 * 60 * 1000).unref?.();
}

module.exports = {
  init,
  activate,
  deactivate,
  refresh: () => refresh(true),
  get: () => state,
  isUnlocked: () => state.status === 'valid',
  /** Token firmado de este equipo (para la sincronización), solo con la licencia activa. */
  token: () => {
    if (state.status !== 'valid' || bypass()) return null;
    const cur = local();
    return cur.status === 'valid' ? cur.token : null;
  },
  accountUrl: (hash) => `${CFG.siteUrl}/account${hash ? '#' + hash : ''}`,
  siteUrl: CFG.siteUrl,
};
