// macOS: sin cuenta de Apple Developer no hay certificado para firmar.
// Una firma "ad hoc" es obligatoria para que la app arranque en Macs con Apple Silicon (M1/M2/M3…);
// macOS seguirá pidiendo confirmación la primera vez (ver README → Escritorio).
const { execFileSync } = require('node:child_process');
const path = require('node:path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
};
