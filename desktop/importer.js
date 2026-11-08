// Importar archivos (proceso principal): Excel, CSV, Word, PDF, texto y fotos.
// El archivo lo elige la persona en el diálogo del sistema; se lee en el equipo, se devuelve su contenido
// como filas de texto y no se guarda ni se envía a ningún sitio. La interfaz decide qué crear
// (src/lib/importParse.ts) y lo muestra para revisarlo antes de importar.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { openZip } = require('./zip');

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_ROWS = 3000;
const IMAGE = ['.png', '.jpg', '.jpeg', '.bmp', '.gif', '.tif', '.tiff', '.heic', '.webp'];
const OCR_OK = process.platform === 'win32';

/* ───────── Utilidades ───────── */

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function unxml(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENT[e.toLowerCase()] ?? m;
  });
}
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
function tidy(rows) {
  return rows
    .map((r) => r.map(clean))
    .filter((r) => r.some(Boolean))
    .slice(0, MAX_ROWS);
}

/** Texto plano: UTF-8, o Windows-1252 si no lo parece (CSV de Excel en español). */
function decodeText(buf) {
  let s = buf.toString('utf8');
  if (s.includes('�')) s = new TextDecoder('windows-1252').decode(buf);
  return s.replace(/^﻿/, '');
}

function parseCsv(text) {
  const first = text.split(/\r?\n/, 1)[0] || '';
  const delim = [';', '\t', ','].map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && !cell) quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/* ───────── Excel (.xlsx) ───────── */

const pad = (n) => String(n).padStart(2, '0');
function excelDate(v) {
  const ms = Math.round((v - 25569) * 86400000); // días desde 1899-12-30
  const d = new Date(ms);
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  if (v < 1) return time;
  return Number.isInteger(v) ? date : `${date} ${time}`;
}
function colIndex(ref) {
  const m = /^([A-Z]+)/.exec(ref || '');
  if (!m) return -1;
  let n = 0;
  for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function readXlsx(buf) {
  const zip = openZip(buf);
  const str = (name) => {
    const b = zip.read(name);
    return b ? b.toString('utf8') : '';
  };
  const shared = [];
  for (const m of str('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    shared.push(unxml([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join('')));
  }
  // Formatos de fecha/hora: los números con esos estilos son fechas de Excel.
  const styles = str('xl/styles.xml');
  const custom = new Map([...styles.matchAll(/<numFmt [^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g)].map((m) => [Number(m[1]), unxml(m[2])]));
  const isDateFmt = (id) => {
    if ((id >= 14 && id <= 22) || (id >= 45 && id <= 47)) return true;
    const code = custom.get(id);
    return !!code && /[dmyhs]/i.test(code.replace(/"[^"]*"|\[[^\]]*\]|\\./g, ''));
  };
  const xfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles);
  const dateStyle = xfs ? [...xfs[1].matchAll(/<xf [^>]*?numFmtId="(\d+)"/g)].map((m) => isDateFmt(Number(m[1]))) : [];

  const sheets = zip.names
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort((a, b) => Number(/(\d+)\.xml$/.exec(a)[1]) - Number(/(\d+)\.xml$/.exec(b)[1]));
  const rows = [];
  for (const sheet of sheets) {
    const xml = str(sheet);
    for (const rm of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const row = [];
      for (const cm of rm[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = cm[1];
        const inner = cm[2] || '';
        const col = colIndex((/\br="([A-Z]+)\d+"/.exec(attrs) || [])[1]);
        const type = (/\bt="(\w+)"/.exec(attrs) || [])[1];
        const style = Number((/\bs="(\d+)"/.exec(attrs) || [])[1] || 0);
        const v = (/<v>([\s\S]*?)<\/v>/.exec(inner) || [])[1];
        let text = '';
        if (type === 's') text = shared[Number(v)] ?? '';
        else if (type === 'inlineStr') text = unxml([...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(''));
        else if (type === 'str' || type === 'e' || type === 'b') text = unxml(v ?? '');
        else if (v != null) text = dateStyle[style] && !Number.isNaN(Number(v)) ? excelDate(Number(v)) : v;
        if (col >= 0) row[col] = text;
        else row.push(text);
      }
      rows.push(Array.from(row, (x) => x ?? ''));
    }
    rows.push([]); // separa hojas
  }
  return tidy(rows);
}

/* ───────── Word (.docx) ───────── */

function paraText(xml) {
  let s = '';
  for (const m of xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:(tab|br|cr)\b[^>]*\/>/g)) {
    if (m[2] === 'tab') s += '\t';
    else if (m[2]) s += '\n';
    else s += unxml(m[1]);
  }
  return s;
}

function readDocx(buf) {
  const zip = openZip(buf);
  const doc = (zip.read('word/document.xml') || Buffer.alloc(0)).toString('utf8');
  const rows = [];
  for (const m of doc.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>|<w:p[ >][\s\S]*?<\/w:p>/g)) {
    const block = m[0];
    if (block.startsWith('<w:tbl>')) {
      for (const tr of block.matchAll(/<w:tr[ >][\s\S]*?<\/w:tr>/g)) {
        rows.push([...tr[0].matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map((tc) => [...tc[0].matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map((p) => paraText(p[0])).join(' ')));
      }
      rows.push([]);
    } else {
      // Un párrafo; las tabulaciones separan columnas («Lunes⇥7:00⇥Gimnasio»).
      for (const line of paraText(block).split('\n')) rows.push(line.split('\t'));
    }
  }
  return tidy(rows);
}

/* ───────── Fotos y PDF (reconocedor de texto de Windows) ───────── */

function ocrScript() {
  // Dentro del instalador los scripts no pueden ejecutarse desde app.asar: van en app.asar.unpacked.
  return path.join(__dirname, 'ocr.ps1').replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
}

function runOcr(file, lang) {
  return new Promise((resolve, reject) => {
    const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ocrScript(), '-Path', file, '-Lang', String(lang || '').slice(0, 5)];
    execFile('powershell.exe', args, { windowsHide: true, timeout: 90000, maxBuffer: 32 * 1024 * 1024, encoding: 'buffer' }, (err, stdout) => {
      if (err) return reject(err);
      try {
        resolve(JSON.parse(stdout.toString('utf8').trim()));
      } catch (e) {
        reject(e);
      }
    });
  });
}

/** Rehace filas y columnas con la posición de cada palabra (Windows agrupa a veces por columnas). */
function ocrRows(result) {
  const rows = [];
  for (const page of [].concat(result.pages || [])) {
    const words = [];
    for (const line of [].concat(page.lines || [])) for (const w of [].concat(line.words || [])) if (w && w.t) words.push(w);
    if (!words.length) continue;
    const hs = words.map((w) => w.h || 10).sort((a, b) => a - b);
    const h = hs[Math.floor(hs.length / 2)] || 10;
    // 1) Filas: palabras cuyo centro vertical está a menos de media línea.
    words.sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2));
    const lines = [];
    for (const w of words) {
      const cy = w.y + w.h / 2;
      const last = lines[lines.length - 1];
      if (last && Math.abs(cy - last.cy) < h * 0.6) {
        last.words.push(w);
        last.cy = (last.cy * (last.words.length - 1) + cy) / last.words.length;
      } else lines.push({ cy, words: [w] });
    }
    // 2) Celdas: dentro de una fila, un hueco grande entre palabras separa columnas.
    const cells = lines.map((l) => {
      const ws = l.words.sort((a, b) => a.x - b.x);
      const out = [];
      for (const w of ws) {
        const prev = out[out.length - 1];
        if (prev && w.x - prev.right < h * 1.1) {
          prev.text += ' ' + w.t;
          prev.right = w.x + w.w;
        } else out.push({ x: w.x, right: w.x + w.w, text: w.t });
      }
      return out;
    });
    // 3) Columnas comunes a toda la página, para que «Lunes» y lo de debajo queden alineados.
    const xs = cells.flat().map((c) => c.x).sort((a, b) => a - b);
    const anchors = [];
    for (const x of xs) {
      const a = anchors[anchors.length - 1];
      if (a && x - a.max < h * 2) {
        a.sum += x;
        a.n++;
        a.max = x;
      } else anchors.push({ sum: x, n: 1, max: x });
    }
    const centers = anchors.map((a) => a.sum / a.n);
    for (const line of cells) {
      if (line.length === 1) {
        rows.push([line[0].text]); // texto corrido: una sola celda
        continue;
      }
      const row = Array(centers.length).fill('');
      for (const c of line) {
        let best = 0;
        for (let i = 1; i < centers.length; i++) if (Math.abs(centers[i] - c.x) < Math.abs(centers[best] - c.x)) best = i;
        row[best] = row[best] ? `${row[best]} ${c.text}` : c.text;
      }
      rows.push(row);
    }
    rows.push([]);
  }
  return tidy(rows);
}

/* ───────── Entrada ───────── */

async function readFile(file, lang) {
  const ext = path.extname(file).toLowerCase();
  const stat = await fs.promises.stat(file);
  if (stat.size > MAX_BYTES) return { ok: false, error: 'too_big' };
  try {
    let rows;
    if (ext === '.xls' || ext === '.doc') return { ok: false, error: 'old_format' };
    if (ext === '.csv' || ext === '.tsv') rows = tidy(parseCsv(decodeText(await fs.promises.readFile(file))));
    else if (ext === '.txt' || ext === '.md') rows = tidy(decodeText(await fs.promises.readFile(file)).split(/\r?\n/).map((l) => l.split('\t')));
    else if (ext === '.xlsx' || ext === '.xlsm') rows = readXlsx(await fs.promises.readFile(file));
    else if (ext === '.docx') rows = readDocx(await fs.promises.readFile(file));
    else if (ext === '.pdf' || IMAGE.includes(ext)) {
      if (!OCR_OK) return { ok: false, error: 'ocr_unsupported' };
      rows = ocrRows(await runOcr(file, lang));
    } else return { ok: false, error: 'unsupported' };
    if (!rows.length) return { ok: false, error: 'empty' };
    return { ok: true, name: path.basename(file), source: IMAGE.includes(ext) ? 'photo' : ext.slice(1), rows };
  } catch (e) {
    console.error('import', ext, e && e.message);
    return { ok: false, error: IMAGE.includes(ext) || ext === '.pdf' ? 'ocr' : 'read' };
  }
}

async function pick(win, lang) {
  const { dialog } = require('electron');
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [
      { name: 'Excel, CSV, Word, PDF, texto, fotos', extensions: ['xlsx', 'xlsm', 'csv', 'tsv', 'docx', 'pdf', 'txt', 'md', ...(OCR_OK ? IMAGE.map((e) => e.slice(1)) : [])] },
    ],
  });
  if (canceled || !filePaths[0]) return { ok: false, error: 'canceled' };
  return readFile(filePaths[0], lang);
}

function register(ipcMain, getWin) {
  ipcMain.handle('razor:import:pick', (_e, lang) => pick(getWin(), String(lang || '')));
  ipcMain.handle('razor:import:info', () => ({ photos: OCR_OK }));
}

module.exports = { register, readFile, ocrRows, parseCsv };
