// Configuración de licencias y actualizaciones de la app de escritorio.
// Rellénala antes de compilar los instaladores (ver README → «Licencias y actualizaciones»).
module.exports = {
  // Tu web (la de razor-web), sin barra final. Se usa para activar licencias y abrir la cuenta.
  siteUrl: 'https://razorweb.vercel.app',

  // Supabase → Project Settings → API (la clave "anon" es pública; nunca pongas la service_role).
  supabaseUrl: 'https://xcbmwilvzpuwaabvvvof.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjYm13aWx2enB1d2FhYnZ2dm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1NDg4MjgsImV4cCI6MjEwOTEyNDgyOH0.5INE5cZeifUM_Y7rbEdRw4M3747IGSHssuLMPEHfCGM',

  // Dónde están latest.yml / latest-mac.yml y los instaladores: GitHub Releases del repositorio público razor-releases.
  updatesUrl: 'https://github.com/Eva-one01/razor-releases/releases/latest/download',

  // Clave PÚBLICA de licencias (la genera razor-web/tools/generate-license-keys.js).
  // Si se deja el texto de ejemplo, al compilar en GitHub Actions se descarga sola del servidor
  // (tools/fill-license-key.js), que además comprueba que coincida.
  licensePublicKey: `-----BEGIN PUBLIC KEY-----
PEGA-AQUI-LA-CLAVE-PUBLICA
-----END PUBLIC KEY-----`,

  // Días que la app funciona sin conexión antes de pedir validar la licencia de nuevo.
  offlineGraceDays: 30,

  // Ponlo en true solo si firmas la app de macOS con un certificado de Apple Developer.
  // Sin firma, en Mac la app avisa de la versión nueva y abre la página de descargas.
  macAutoUpdate: false,
};
