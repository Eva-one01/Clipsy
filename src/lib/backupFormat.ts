import type { RazorData } from '@/store';

/** Las copias antiguas (antes del cambio de nombre) se marcaban como 'Razor': se siguen aceptando. */
const APPS = ['Clipsy', 'Clepsy', 'Razor'] as const;
const LIST_KEYS = ['events', 'tasks', 'ideas', 'goals', 'alarms', 'reminders', 'clocks', 'transactions'] as const;

interface BackupFile {
  app: (typeof APPS)[number];
  version: number;
  exportedAt: string;
  data: Partial<RazorData>;
}

export type PickResult =
  | { status: 'canceled' }
  | { status: 'invalid' }
  | { status: 'ok'; data: Partial<RazorData>; exportedAt: Date | null; count: number };

/** Convierte el JSON de una copia en datos listos para importar, o la rechaza. Compartido por móvil y escritorio. */
export function parseBackup(raw: unknown): PickResult {
  const data = validate(raw);
  if (!data) return { status: 'invalid' };
  const at = (raw as Partial<BackupFile>).exportedAt;
  const exportedAt = at && !Number.isNaN(Date.parse(at)) ? new Date(at) : null;
  const count = LIST_KEYS.reduce((n, k) => n + (data[k]?.length ?? 0), 0);
  return { status: 'ok', data, exportedAt, count };
}

/** Comprobación estructural: rechaza archivos ajenos o corruptos antes de tocar los datos. */
function validate(raw: unknown): Partial<RazorData> | null {
  if (!raw || typeof raw !== 'object') return null;
  const file = raw as Partial<BackupFile>;
  if (!(APPS as readonly string[]).includes(String(file.app)) || !file.data || typeof file.data !== 'object') return null;

  const src = file.data as Record<string, unknown>;
  const out: Partial<RazorData> = {};

  for (const key of LIST_KEYS) {
    const value = src[key];
    if (value === undefined) continue;
    if (!Array.isArray(value) || !value.every((x) => x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string')) {
      return null;
    }
    // Los IDs de notificación pertenecen al dispositivo original: se descartan.
    (out as Record<string, unknown>)[key] = value.map((x) =>
      'notificationIds' in (x as object) ? { ...(x as object), notificationIds: [] } : x,
    );
  }

  if (src.settings !== undefined) {
    if (!src.settings || typeof src.settings !== 'object') return null;
    out.settings = src.settings as RazorData['settings'];
  }

  return out;
}
