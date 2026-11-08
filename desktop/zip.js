// Lector mínimo de archivos ZIP (los .xlsx y .docx son ZIP con XML dentro). Sin dependencias.
// Solo lee: método 0 (sin comprimir) y 8 (deflate), con límite de tamaño contra «bombas» de compresión.
const zlib = require('zlib');

const MAX_ENTRY = 40 * 1024 * 1024; // 40 MB descomprimidos por archivo interno

/** Devuelve { names: string[], read(name): Buffer | null }. Lanza si el archivo no es un ZIP válido. */
function openZip(buf) {
  // Fin del directorio central: firma 0x06054b50, en los últimos 64 KB.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('zip');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let n = 0; n < count; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw new Error('zip');
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28);
    const xlen = buf.readUInt16LE(p + 30);
    const clen = buf.readUInt16LE(p + 32);
    const offset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    entries.set(name, { method, csize, usize, offset });
    p += 46 + nlen + xlen + clen;
  }
  return {
    names: [...entries.keys()],
    read(name) {
      const e = entries.get(name);
      if (!e) return null;
      if (e.usize > MAX_ENTRY) throw new Error('too_big');
      const h = e.offset;
      if (buf.readUInt32LE(h) !== 0x04034b50) throw new Error('zip');
      const start = h + 30 + buf.readUInt16LE(h + 26) + buf.readUInt16LE(h + 28);
      const data = buf.subarray(start, start + e.csize);
      if (e.method === 0) return Buffer.from(data);
      if (e.method === 8) return zlib.inflateRawSync(data, { maxOutputLength: MAX_ENTRY });
      throw new Error('zip');
    },
  };
}

module.exports = { openZip };
