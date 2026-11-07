// Dictado por voz, procesado en el equipo con whisper.cpp (sin enviar el audio a ningún servidor).
// El motor y el modelo no van en el instalador (≈ 70 MB): se descargan una sola vez cuando la persona
// activa la voz, se comprueba su SHA-256 y se guardan en la carpeta de datos (%APPDATA%\Razor\voice).
// Por ahora hay motor publicado para Windows x64; en el resto de sistemas la voz no aparece.
const { app, net } = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

// Versiones fijadas: si se cambian, hay que actualizar también el tamaño y el SHA-256.
const ENGINE = {
  name: 'whisper.cpp b5454',
  url: 'https://github.com/ggml-org/whisper.cpp/releases/download/b5454/whisper-bin-x64.zip',
  size: 8928640,
  sha256: '6ba69e3482d7826214f90a6a9c84ca07782aec1e1d0c6a7c30c994fd5d816ccb',
};
const MODEL = {
  name: 'ggml-base-q5_1',
  url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin',
  size: 59707625,
  sha256: '422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898',
};
const LANGS = ['es', 'en', 'pt', 'fr', 'de', 'ru'];
const MAX_WAV = 16000 * 2 * 60 + 44; // 60 s de audio mono a 16 kHz y 16 bits

const supported = process.platform === 'win32' && process.arch === 'x64';
const dir = () => path.join(app.getPath('userData'), 'voice');
const exePath = () => path.join(dir(), 'engine', 'Release', 'whisper-cli.exe');
const modelPath = () => path.join(dir(), `${MODEL.name}.bin`);

let installing = null; // promesa de la descarga en curso
let progress = 0;
let lastError = null;

function installed() {
  try {
    return fs.statSync(exePath()).isFile() && fs.statSync(modelPath()).size === MODEL.size;
  } catch {
    return false;
  }
}

function status() {
  return {
    supported,
    installed: supported && installed(),
    installing: !!installing,
    progress,
    sizeMB: Math.round((ENGINE.size + MODEL.size) / 1e6),
    error: lastError,
  };
}

/** Descarga a un archivo temporal comprobando tamaño y SHA-256; solo entonces lo deja en su sitio. */
async function download(file, dest, onBytes) {
  const res = await net.fetch(file.url);
  if (!res.ok || !res.body) throw new Error(`http_${res.status}`);
  const tmp = `${dest}.part`;
  const out = fs.createWriteStream(tmp);
  const hash = crypto.createHash('sha256');
  let got = 0;
  try {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      got += value.length;
      if (got > file.size) throw new Error('size');
      hash.update(value);
      if (!out.write(value)) await new Promise((r) => out.once('drain', r));
      onBytes(value.length);
    }
    await new Promise((resolve, reject) => out.end((err) => (err ? reject(err) : resolve())));
    if (got !== file.size || hash.digest('hex') !== file.sha256) throw new Error('checksum');
    fs.renameSync(tmp, dest);
  } catch (e) {
    out.destroy();
    fs.rmSync(tmp, { force: true });
    throw e;
  }
}

/** Descomprime el .zip del motor con el tar que trae Windows 10/11. */
function unzip(zip, to) {
  return new Promise((resolve, reject) => {
    const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
    fs.mkdirSync(to, { recursive: true });
    const p = spawn(tar, ['-xf', zip, '-C', to], { windowsHide: true });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error('unzip'))));
  });
}

function install(onProgress) {
  if (!supported) return Promise.resolve(status());
  if (installed()) return Promise.resolve(status());
  if (installing) return installing;
  lastError = null;
  progress = 0;
  const total = ENGINE.size + MODEL.size;
  let done = 0;
  let lastSent = 0;
  const tick = (n) => {
    done += n;
    progress = Math.min(0.99, done / total);
    if (progress - lastSent >= 0.01) {
      lastSent = progress;
      onProgress(status());
    }
  };
  installing = (async () => {
    try {
      fs.mkdirSync(dir(), { recursive: true });
      const zip = path.join(dir(), 'engine.zip');
      await download(ENGINE, zip, tick);
      fs.rmSync(path.join(dir(), 'engine'), { recursive: true, force: true });
      await unzip(zip, path.join(dir(), 'engine'));
      fs.rmSync(zip, { force: true });
      if (!fs.existsSync(exePath())) throw new Error('engine');
      if (!installed()) await download(MODEL, modelPath(), tick);
      progress = 1;
    } catch (e) {
      lastError = String((e && e.message) || e).slice(0, 40);
      progress = 0;
    } finally {
      installing = null;
      onProgress(status());
    }
    return status();
  })();
  onProgress(status());
  return installing;
}

function remove() {
  if (installing) return status();
  fs.rmSync(dir(), { recursive: true, force: true });
  lastError = null;
  progress = 0;
  return status();
}

// Lo que whisper escribe cuando no hay voz («[Música]», «(silencio)»…): no es un comando.
const NOISE = /^[[(（].*[\])）]$|^[\s.…,¡!¿?-]*$/;

/** WAV mono de 16 kHz (lo graba la barra rápida) → texto. */
function transcribe(wav, lang) {
  if (!supported || !installed()) return Promise.resolve({ ok: false, error: 'not_installed' });
  const buf = Buffer.from(wav);
  if (buf.length < 44 + 16000 || buf.length > MAX_WAV || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    return Promise.resolve({ ok: false, error: 'bad_audio' });
  }
  const file = path.join(os.tmpdir(), `clipsy-voice-${crypto.randomUUID()}.wav`);
  fs.writeFileSync(file, buf);
  const threads = String(Math.max(1, Math.min(4, os.cpus().length - 1)));
  const l = LANGS.includes(lang) ? lang : 'auto';
  return new Promise((resolve) => {
    let out = '';
    let finished = false;
    const finish = (r) => {
      if (finished) return;
      finished = true;
      fs.rmSync(file, { force: true });
      resolve(r);
    };
    const p = spawn(exePath(), ['-m', modelPath(), '-f', file, '-l', l, '-t', threads, '-nt', '-np'], { windowsHide: true, cwd: path.dirname(exePath()) });
    const timer = setTimeout(() => {
      p.kill();
      finish({ ok: false, error: 'timeout' });
    }, 45000);
    p.stdout.on('data', (d) => {
      out += d.toString('utf8');
    });
    p.on('error', () => {
      clearTimeout(timer);
      finish({ ok: false, error: 'engine' });
    });
    p.on('close', (code) => {
      clearTimeout(timer);
      const text = out
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => s && !NOISE.test(s))
        .join(' ')
        .trim();
      finish(code === 0 ? { ok: true, text } : { ok: false, error: 'engine' });
    });
  });
}

function register(ipcMain, send) {
  ipcMain.handle('razor:voice:status', () => status());
  ipcMain.handle('razor:voice:install', () => install(send));
  ipcMain.handle('razor:voice:remove', () => remove());
  ipcMain.handle('razor:voice:transcribe', (_e, wav, lang) => transcribe(wav, String(lang).slice(0, 2)));
}

module.exports = { register, status, supported };
