// Copias de seguridad automáticas: una al día en la carpeta de datos (backups/), se guardan las 7 más
// recientes. Antes de restaurar una copia se guarda también el estado actual, por si acaso (las 3 últimas).
// Así nadie pierde todo si algo se estropea en su equipo, aunque no use la sincronización.
const fs = require('node:fs');
const path = require('node:path');
const { app, shell } = require('electron');

const KEEP_DAILY = 7;
const KEEP_SAFETY = 3;
const DAILY = /^clipsy-auto-(\d{4}-\d{2}-\d{2})\.json$/;
const SAFETY = /^clipsy-antes-de-restaurar-(\d{4}-\d{2}-\d{2})-(\d{6})\.json$/;

const dir = () => path.join(app.getPath('userData'), 'backups');

function ensureDir() {
  fs.mkdirSync(dir(), { recursive: true });
}

/** Escribe en un archivo temporal y lo renombra: si se corta la luz, no queda una copia a medias. */
function writeAtomic(file, text) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

function prune() {
  const names = fs.readdirSync(dir());
  for (const [re, keep] of [
    [DAILY, KEEP_DAILY],
    [SAFETY, KEEP_SAFETY],
  ]) {
    names
      .filter((n) => re.test(n))
      .sort()
      .reverse()
      .slice(keep)
      .forEach((n) => fs.rmSync(path.join(dir(), n), { force: true }));
  }
}

/** Lista de copias, de la más reciente a la más antigua. */
function list() {
  try {
    ensureDir();
    return fs
      .readdirSync(dir())
      .filter((n) => DAILY.test(n) || SAFETY.test(n))
      .map((n) => {
        const st = fs.statSync(path.join(dir(), n));
        let count = null;
        try {
          const m = fs.readFileSync(path.join(dir(), n), 'utf8').match(/"clipsyCount":\s*(\d+)/);
          if (m) count = Number(m[1]);
        } catch {}
        return { name: n, kind: DAILY.test(n) ? 'daily' : 'safety', savedAt: st.mtimeMs, size: st.size, count };
      })
      .sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

/** Guarda la copia del día (la reemplaza si ya existe). `day` = AAAA-MM-DD en la hora del equipo. */
function saveDaily(day, text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day)) || typeof text !== 'string') return false;
  try {
    ensureDir();
    writeAtomic(path.join(dir(), `clipsy-auto-${day}.json`), text);
    prune();
    return true;
  } catch {
    return false;
  }
}

/** Copia del estado actual justo antes de restaurar otra. */
function saveSafety(text) {
  if (typeof text !== 'string') return false;
  try {
    ensureDir();
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const name = `clipsy-antes-de-restaurar-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.json`;
    writeAtomic(path.join(dir(), name), text);
    prune();
    return true;
  } catch {
    return false;
  }
}

/** Contenido de una copia (solo nombres de la lista: nunca rutas). */
function read(name) {
  if (!DAILY.test(String(name)) && !SAFETY.test(String(name))) return null;
  try {
    return fs.readFileSync(path.join(dir(), name), 'utf8');
  } catch {
    return null;
  }
}

function openFolder() {
  ensureDir();
  return shell.openPath(dir());
}

module.exports = { list, saveDaily, saveSafety, read, openFolder };
