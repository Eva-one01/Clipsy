// Clima de «Hoy» (proceso principal). Solo si la persona lo activa.
// - Ubicación: la de Windows (servicio de ubicación del sistema, si está permitido) o una ciudad elegida.
//   Las coordenadas se redondean a 2 decimales (~1 km) y no se guardan fuera del equipo.
// - Pronóstico: MET Norway (api.met.no), gratis también para uso comercial, con atribución.
//   Es lo único que se envía: las coordenadas aproximadas, sin cuenta ni identificadores.
const { app, net } = require('electron');
const { execFile } = require('child_process');

const API = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
const TTL = 30 * 60 * 1000;
const LOC_TTL = 6 * 60 * 60 * 1000;

let cache = null; // { key, at, data }
let loc = null; // { at, lat, lon } o { at, error }

const round = (n) => Math.round(Number(n) * 100) / 100;

/** Ubicación del equipo con el servicio de ubicación de Windows (System.Device). */
function locateWindows() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve({ error: 'unsupported' });
    const ps = [
      'Add-Type -AssemblyName System.Device',
      '$w = New-Object System.Device.Location.GeoCoordinateWatcher([System.Device.Location.GeoPositionAccuracy]::Default)',
      '$null = $w.TryStart($true, [TimeSpan]::FromSeconds(8))',
      '$i = 0; while ($w.Status -ne "Ready" -and $w.Permission -ne "Denied" -and $i -lt 80) { Start-Sleep -Milliseconds 100; $i++ }',
      'if ($w.Permission -eq "Denied") { "denied" } elseif ($w.Position.Location.IsUnknown) { "unknown" }',
      'else { "{0:F4},{1:F4}" -f $w.Position.Location.Latitude, $w.Position.Location.Longitude }',
      '$w.Stop()',
    ].join('; ');
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true, timeout: 15000 }, (err, out) => {
      const s = String(out || '').trim();
      if (err && !s) return resolve({ error: 'unknown' });
      if (s === 'denied') return resolve({ error: 'denied' });
      const m = /^(-?\d+[.,]\d+),(-?\d+[.,]\d+)$/.exec(s);
      if (!m) return resolve({ error: 'unknown' });
      resolve({ lat: round(m[1].replace(',', '.')), lon: round(m[2].replace(',', '.')) });
    });
  });
}

/** Lo esencial del pronóstico: ahora, símbolo y mínima/máxima de las próximas 24 h. */
function summarize(json) {
  const ts = (json && json.properties && json.properties.timeseries) || [];
  if (!ts.length) return null;
  const first = ts[0].data || {};
  const temp = first.instant && first.instant.details ? first.instant.details.air_temperature : null;
  const sum = (first.next_1_hours || first.next_6_hours || first.next_12_hours || {}).summary || {};
  const until = Date.parse(ts[0].time) + 24 * 3600 * 1000;
  const temps = ts.filter((x) => Date.parse(x.time) <= until).map((x) => x.data && x.data.instant && x.data.instant.details && x.data.instant.details.air_temperature).filter((n) => typeof n === 'number');
  return {
    temp: typeof temp === 'number' ? Math.round(temp) : null,
    symbol: String(sum.symbol_code || ''),
    min: temps.length ? Math.round(Math.min(...temps)) : null,
    max: temps.length ? Math.round(Math.max(...temps)) : null,
  };
}

async function forecast(lat, lon) {
  const key = `${round(lat)},${round(lon)}`;
  if (cache && cache.key === key && Date.now() - cache.at < TTL) return cache.data;
  const [la, lo] = key.split(',');
  const res = await net.fetch(`${API}?lat=${la}&lon=${lo}`, {
    // MET Norway pide identificar la app (sin datos de la persona).
    headers: { 'User-Agent': `Clipsy/${app.getVersion()} https://github.com/Eva-one01/Clipsy`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`met ${res.status}`);
  const data = summarize(await res.json());
  if (!data) throw new Error('met empty');
  cache = { key, at: Date.now(), data };
  return data;
}

/** { source: 'auto' } usa la ubicación de Windows; { source: 'city', lat, lon } una ciudad elegida. */
async function get(opts) {
  try {
    let lat;
    let lon;
    if (opts && opts.source === 'city') {
      lat = Number(opts.lat);
      lon = Number(opts.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { ok: false, error: 'unknown' };
    } else {
      if (!loc || Date.now() - loc.at > LOC_TTL || (loc.error && Date.now() - loc.at > 60 * 1000)) loc = { at: Date.now(), ...(await locateWindows()) };
      if (loc.error) return { ok: false, error: loc.error };
      ({ lat, lon } = loc);
    }
    const data = await forecast(lat, lon);
    return { ok: true, lat: round(lat), lon: round(lon), ...data, at: Date.now() };
  } catch (e) {
    console.error('weather', e && e.message);
    return { ok: false, error: 'offline' };
  }
}

function register(ipcMain) {
  ipcMain.handle('razor:weather:get', (_e, opts) => get(opts || {}));
}

module.exports = { register, summarize };
