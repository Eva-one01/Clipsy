// Sincronización cifrada (proceso principal): solo transporta el bloque YA CIFRADO por la interfaz
// y guarda la clave de este equipo protegida por el sistema (Llavero de macOS / DPAPI de Windows).
// La interfaz no puede conectarse a internet (CSP), así que las peticiones salen desde aquí.
const { app, safeStorage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const CFG = require('./config');
const license = require('./license');

const keyFile = () => path.join(app.getPath('userData'), 'sync-key.json');

async function call(op, extra) {
  const token = license.token();
  if (!token) return { ok: false, error: 'no_license' };
  try {
    const res = await fetch(`${CFG.siteUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ token, op }, extra || {})),
      signal: AbortSignal.timeout(30000),
    });
    let data = {};
    try {
      data = await res.json();
    } catch {}
    if (res.ok) return Object.assign({ ok: true }, data);
    return { ok: false, status: res.status, error: data.error || 'http', version: data.version };
  } catch {
    return { ok: false, error: 'network' };
  }
}

function setKey(b64) {
  const raw = String(b64 || '');
  if (!/^[A-Za-z0-9+/=]{40,48}$/.test(raw)) return false;
  const enc = safeStorage.isEncryptionAvailable();
  const value = enc ? safeStorage.encryptString(raw).toString('base64') : raw;
  fs.writeFileSync(keyFile(), JSON.stringify({ enc, value }), { mode: 0o600 });
  return true;
}

function getKey() {
  try {
    const { enc, value } = JSON.parse(fs.readFileSync(keyFile(), 'utf8'));
    return enc ? safeStorage.decryptString(Buffer.from(value, 'base64')) : value;
  } catch {
    return null;
  }
}

function clearKey() {
  try {
    fs.unlinkSync(keyFile());
  } catch {}
  return true;
}

function register(ipcMain) {
  ipcMain.handle('razor:sync:get', () => call('get'));
  ipcMain.handle('razor:sync:put', (_e, baseVersion, blob, salt) => call('put', { baseVersion: Number(baseVersion), blob: String(blob), salt: String(salt) }));
  ipcMain.handle('razor:sync:delete', () => call('delete'));
  ipcMain.handle('razor:sync:key:get', () => getKey());
  ipcMain.handle('razor:sync:key:set', (_e, b64) => setKey(b64));
  ipcMain.handle('razor:sync:key:clear', () => clearKey());
}

module.exports = { register };
