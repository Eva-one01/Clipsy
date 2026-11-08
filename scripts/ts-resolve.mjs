// Para las pruebas con Node (node --import ./scripts/ts-resolve.mjs …): resuelve «@/…» y los
// imports relativos sin extensión a los archivos .ts de src, como hace el empaquetador de la app.
import { register } from 'node:module';

register(
  'data:text/javascript,' +
    encodeURIComponent(`
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
const SRC = new URL('../src/', ${JSON.stringify(import.meta.url)});
export async function resolve(spec, ctx, next) {
  let url = null;
  if (spec.startsWith('@/')) url = new URL(spec.slice(2), SRC);
  else if ((spec.startsWith('./') || spec.startsWith('../')) && ctx.parentURL && !/\\.[cm]?[jt]s$/.test(spec)) url = new URL(spec, ctx.parentURL);
  if (url) {
    for (const ext of ['.ts', '.tsx', '/index.ts']) {
      const f = fileURLToPath(url) + ext;
      if (existsSync(f)) return next(pathToFileURL(f).href, ctx);
    }
  }
  return next(spec, ctx);
}
`),
);
