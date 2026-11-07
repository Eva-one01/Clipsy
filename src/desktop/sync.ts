/**
 * Sincronización cifrada de extremo a extremo entre los equipos de la misma cuenta (escritorio).
 *
 * - Los datos se comprimen y cifran aquí (AES-GCM 256) con una clave que deriva de la frase del
 *   usuario (PBKDF2-SHA256). El servidor solo guarda el bloque cifrado y su versión: no puede leerlo.
 * - La clave de este equipo se guarda protegida por el sistema (desktop/sync.js, safeStorage).
 * - Fusión a tres bandas por id, con la última versión sincronizada como base: los cambios hechos
 *   en equipos distintos se combinan (campo a campo) y los borrados se respetan.
 */
import { useEffect } from 'react';
import { create } from 'zustand';
import { useStore } from '@/store';
import { auxWindow } from './aux';
import { desktop } from './bridge';

const BASE_KEY = 'razor-sync-base';
const META_KEY = 'razor-sync-meta';
const ITER = 310_000;

/** Colecciones que se sincronizan (todo lo que es contenido del usuario). */
const COLLECTIONS = ['events', 'tasks', 'ideas', 'goals', 'alarms', 'reminders', 'clocks', 'transactions', 'recurring'] as const;
type Coll = (typeof COLLECTIONS)[number];
/** Ajustes compartidos; tema, idioma, acento… se quedan por equipo. */
const SHARED_SETTINGS = ['currency', 'monthlyBudget', 'categoryBudgets', 'weekStartsMonday', 'use24h', 'lastReview', 'primaryClockId'] as const;

type Item = Record<string, unknown> & { id: string };
export interface Snapshot {
  v: 1;
  data: Record<Coll, Item[]>;
  settings: Record<string, unknown>;
}

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'error';
export const useSync = create<{ status: SyncStatus; lastSync: number | null; error: string | null; enabled: boolean }>()(() => ({
  status: 'off',
  lastSync: null,
  error: null,
  enabled: false,
}));

/* ───────────── Utilidades ───────────── */

const b64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

const read = <T,>(k: string): T | null => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
};
const write = (k: string, v: unknown) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* sin espacio: la próxima sincronización volverá a fusionar */
  }
};

interface Meta {
  version: number;
  salt: string;
  lastSync: number | null;
}

async function gzip(text: string): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function gunzip(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

export async function deriveKey(passphrase: string, saltB64: string): Promise<string> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase.normalize('NFC')), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(saltB64), iterations: ITER }, material, 256);
  return b64(bits);
}
const aesKey = (raw: string) => crypto.subtle.importKey('raw', unb64(raw), 'AES-GCM', false, ['encrypt', 'decrypt']);

async function encrypt(snap: Snapshot, rawKey: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(rawKey), await gzip(JSON.stringify(snap)));
  return JSON.stringify({ v: 1, iv: b64(iv), ct: b64(ct) });
}
async function decrypt(blob: string, rawKey: string): Promise<Snapshot> {
  let plain: ArrayBuffer;
  try {
    const env = JSON.parse(blob) as { v: number; iv: string; ct: string };
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv) }, await aesKey(rawKey), unb64(env.ct));
  } catch {
    throw new Error('decrypt');
  }
  const snap = JSON.parse(await gunzip(new Uint8Array(plain))) as Snapshot;
  if (snap?.v !== 1 || !snap.data) throw new Error('format');
  return snap;
}

/* ───────────── Instantánea y fusión ───────────── */

/** Los ids de avisos son de cada equipo: no se sincronizan. */
const clean = (x: Item): Item => {
  const { notificationIds: _n, ...rest } = x as Item & { notificationIds?: unknown };
  return rest as Item;
};

export function snapshot(): Snapshot {
  const s = useStore.getState() as unknown as Record<string, unknown> & { settings: Record<string, unknown> };
  const data = {} as Record<Coll, Item[]>;
  for (const c of COLLECTIONS) data[c] = ((s[c] as Item[]) ?? []).map(clean);
  const settings: Record<string, unknown> = {};
  for (const k of SHARED_SETTINGS) if (s.settings[k] !== undefined) settings[k] = s.settings[k];
  return { v: 1, data, settings };
}

/** JSON con claves ordenadas: dos objetos iguales dan siempre el mismo texto. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}
const same = (a: unknown, b: unknown) => stable(a) === stable(b);

function mergeFields(b: Record<string, unknown> | undefined, l: Record<string, unknown>, r: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const k of new Set([...Object.keys(l), ...Object.keys(r)])) {
    const bv = b?.[k];
    out[k] = same(l[k], bv) ? r[k] : l[k]; // si este equipo no lo cambió, gana el otro
  }
  return out;
}

function mergeList(base: Item[], local: Item[], remote: Item[]): Item[] {
  const B = new Map(base.map((x) => [x.id, x]));
  const L = new Map(local.map((x) => [x.id, x]));
  const R = new Map(remote.map((x) => [x.id, x]));
  const order = [...remote.map((x) => x.id), ...local.map((x) => x.id).filter((id) => !R.has(id))];
  const out: Item[] = [];
  for (const id of order) {
    const b = B.get(id);
    const l = L.get(id);
    const r = R.get(id);
    let v: Item | undefined;
    if (l && r) v = same(l, r) ? l : (mergeFields(b, l, r) as Item);
    else if (l && !r) v = b && same(l, b) ? undefined : l; // borrado en el otro equipo (si aquí no cambió)
    else if (r && !l) v = b && same(r, b) ? undefined : r; // borrado aquí (si allí no cambió)
    if (v) out.push(v);
  }
  return out;
}

export function merge(base: Snapshot | null, local: Snapshot, remote: Snapshot): Snapshot {
  const data = {} as Record<Coll, Item[]>;
  for (const c of COLLECTIONS) data[c] = mergeList(base?.data[c] ?? [], local.data[c] ?? [], remote.data[c] ?? []);
  return { v: 1, data, settings: mergeFields(base?.settings, local.settings, remote.settings) };
}

/** Aplica la versión fusionada conservando los avisos ya programados y reprogramando el resto. */
async function apply(snap: Snapshot) {
  const s = useStore.getState() as unknown as Record<string, unknown> & { settings: Record<string, unknown> };
  const patch: Record<string, unknown> = {};
  for (const c of COLLECTIONS) {
    const cur = new Map(((s[c] as Item[]) ?? []).map((x) => [x.id, x]));
    const withAlerts = c === 'events' || c === 'alarms' || c === 'reminders' || c === 'recurring';
    patch[c] = snap.data[c].map((x) => (withAlerts ? { ...x, notificationIds: (cur.get(x.id) as { notificationIds?: string[] } | undefined)?.notificationIds ?? [] } : x));
  }
  patch.settings = { ...s.settings, ...snap.settings };
  useStore.setState(patch as never);
  await useStore.getState().rescheduleAll().catch(() => undefined);
}

/* ───────────── Ciclo de sincronización ───────────── */

let running: Promise<void> | null = null;

export async function syncNow(): Promise<void> {
  if (running) return running;
  running = (async () => {
    const api = desktop?.sync;
    const meta = read<Meta>(META_KEY);
    const key = api ? await api.getKey() : null;
    if (!api || !meta || !key) {
      useSync.setState({ status: 'off', enabled: false });
      return;
    }
    useSync.setState({ status: 'syncing', enabled: true, error: null });
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        const local = snapshot();
        const base = read<Snapshot>(BASE_KEY);
        const remote = await api.get();
        if (!remote.ok) throw new Error(remote.error ?? 'network');
        const rv = remote.version ?? 0;
        if (rv === 0 && meta.version > 0) {
          // La copia del servidor se borró desde otro equipo: aquí también se deja de sincronizar.
          await disableSync(false);
          useSync.setState({ status: 'error', error: 'removed' });
          return;
        }

        let next = local;
        if (rv > 0 && remote.blob) {
          if (rv !== meta.version || !base) {
            const theirs = await decrypt(remote.blob, key);
            next = merge(base, local, theirs);
            if (!same(next, local)) await apply(next);
            if (same(next, theirs)) {
              // Nada nuevo que subir.
              write(BASE_KEY, next);
              write(META_KEY, { ...meta, version: rv, lastSync: Date.now() });
              break;
            }
          } else if (base && same(local, base)) {
            write(META_KEY, { ...meta, lastSync: Date.now() });
            break; // ningún cambio en ningún lado
          }
        }
        const put = await api.put(rv, await encrypt(next, key), meta.salt);
        if (put.ok && put.version) {
          write(BASE_KEY, next);
          write(META_KEY, { ...meta, version: put.version, lastSync: Date.now() });
          break;
        }
        if (put.status === 409) continue; // otro equipo subió algo entre medias: se vuelve a fusionar
        throw new Error(put.error ?? 'network');
      }
      useSync.setState({ status: 'idle', lastSync: read<Meta>(META_KEY)?.lastSync ?? Date.now() });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'error';
      // Un fallo al descifrar significa que la frase cambió en otro equipo.
      useSync.setState({ status: 'error', error: msg === 'decrypt' || msg === 'format' ? 'key' : msg });
    }
  })().finally(() => {
    running = null;
  });
  return running;
}

/** ¿Ya hay datos sincronizados en la cuenta? Devuelve su sal (para pedir la frase existente). */
export async function remoteInfo(): Promise<{ exists: boolean; salt?: string; blob?: string; error?: string }> {
  const r = await desktop?.sync?.get();
  if (!r) return { exists: false, error: 'unavailable' };
  if (!r.ok) return { exists: false, error: r.error };
  return r.version && r.blob ? { exists: true, salt: r.salt, blob: r.blob } : { exists: false };
}

/**
 * Activa la sincronización en este equipo. Si la cuenta ya tiene datos, la frase debe coincidir
 * (se comprueba descifrando); si no, se crea con una sal nueva. Devuelve un código de error o null.
 */
export async function enableSync(passphrase: string): Promise<string | null> {
  const api = desktop?.sync;
  if (!api) return 'unavailable';
  const info = await remoteInfo();
  if (info.error) return info.error;
  const salt = info.salt ?? b64(crypto.getRandomValues(new Uint8Array(16)));
  const key = await deriveKey(passphrase, salt);
  if (info.exists && info.blob) {
    try {
      await decrypt(info.blob, key);
    } catch {
      return 'wrong_passphrase';
    }
  }
  if (!(await api.setKey(key))) return 'generic';
  // Sin base: la primera vez se unen los datos de este equipo con los de la cuenta, sin perder nada.
  write(BASE_KEY, null);
  write(META_KEY, { version: 0, salt, lastSync: null } satisfies Meta);
  useSync.setState({ enabled: true, status: 'idle' });
  await syncNow();
  return useSync.getState().status === 'error' ? useSync.getState().error ?? 'generic' : null;
}

/** Deja de sincronizar en este equipo (los datos locales se quedan). Opcionalmente borra la copia del servidor. */
export async function disableSync(deleteRemote: boolean): Promise<boolean> {
  const api = desktop?.sync;
  if (deleteRemote) {
    const r = await api?.remove();
    if (!r?.ok) return false;
  }
  await api?.clearKey();
  write(BASE_KEY, null);
  write(META_KEY, null);
  useSync.setState({ enabled: false, status: 'off', lastSync: null, error: null });
  return true;
}

/** Sincroniza al abrir, cada 5 minutos, al volver a la ventana y poco después de cada cambio. */
export function useAutoSync(ready: boolean) {
  const enabled = useSync((s) => s.enabled);

  useEffect(() => {
    if (!desktop?.sync || !ready || auxWindow) return;
    const meta = read<Meta>(META_KEY);
    useSync.setState({ enabled: !!meta, lastSync: meta?.lastSync ?? null, status: meta ? 'idle' : 'off' });
  }, [ready]);

  useEffect(() => {
    if (!desktop?.sync || !ready || auxWindow || !enabled) return;
    syncNow();
    const every = setInterval(syncNow, 5 * 60_000);
    let debounce: ReturnType<typeof setTimeout> | null = null;
    let last = stable(snapshot());
    const unsub = useStore.subscribe(() => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        const now = stable(snapshot());
        if (now !== last) {
          last = now;
          syncNow();
        }
      }, 15_000);
    });
    const onFocus = () => syncNow();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(every);
      unsub();
      if (debounce) clearTimeout(debounce);
      window.removeEventListener('focus', onFocus);
    };
  }, [ready, enabled]);
}
