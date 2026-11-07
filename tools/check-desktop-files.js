// Comprueba antes de compilar que todos los archivos que usa la app de escritorio (require('./…'))
// están en la lista «build.files» de desktop/package.json. Si falta uno, la app no arrancaría.
const fs = require('node:fs');
const path = require('node:path');
const dir = path.join(__dirname, '..', 'desktop');
const files = require(path.join(dir, 'package.json')).build.files;
const missing = new Set();
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
  for (const m of fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/require\('\.\/([^']+)'\)/g)) {
    const name = m[1].endsWith('.js') ? m[1] : `${m[1]}.js`;
    if (!files.includes(name)) missing.add(name);
  }
}
if (missing.size) {
  console.error(`Faltan en desktop/package.json → build.files: ${[...missing].join(', ')}`);
  process.exit(1);
}
console.log('Archivos de escritorio: OK');
