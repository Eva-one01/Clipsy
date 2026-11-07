// Usado al compilar (GitHub Actions): descarga la clave PÚBLICA de licencias del servidor
// (siteUrl/api/license/public-key) y la escribe en desktop/config.js. Si config.js ya tiene una
// clave, comprueba que coincida con la del servidor: así nunca se publica una app que no pueda
// validar licencias.
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '..', 'desktop', 'config.js');
const cfg = require(file);

(async () => {
  if (!/^https:\/\//.test(cfg.siteUrl) || cfg.siteUrl.includes('TU-DOMINIO')) throw new Error('desktop/config.js: siteUrl sin configurar');
  const res = await fetch(`${cfg.siteUrl}/api/license/public-key`);
  const pem = (await res.text()).trim();
  if (!res.ok || !pem.startsWith('-----BEGIN PUBLIC KEY-----')) throw new Error(`No se pudo obtener la clave pública (${res.status}): ${pem.slice(0, 120)}`);

  const current = String(cfg.licensePublicKey || '').trim();
  if (current.includes('PEGA-AQUI') || !current.includes('BEGIN PUBLIC KEY')) {
    const src = fs.readFileSync(file, 'utf8').replace(/licensePublicKey: `[\s\S]*?`/, `licensePublicKey: \`${pem}\``);
    fs.writeFileSync(file, src);
    console.log('Clave pública escrita en desktop/config.js');
  } else if (current.replace(/\s+/g, '') !== pem.replace(/\s+/g, '')) {
    throw new Error('La clave pública de desktop/config.js NO coincide con la del servidor');
  } else {
    console.log('La clave pública coincide con la del servidor');
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
