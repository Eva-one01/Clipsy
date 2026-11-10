/**
 * Copias de seguridad en escritorio/web: descarga un .json (Electron muestra el diálogo
 * "Guardar como" del sistema) e importa con el selector de archivos nativo.
 * El formato también lo usan las copias automáticas diarias (desktop/backups.js).
 */
import { useStore, type RazorData } from '@/store';
import { todayKey } from './date';
import { parseBackup, type PickResult } from './backupFormat';

export type { PickResult };

/** Todo lo que guarda la app, en el formato de las copias de seguridad. */
export function buildBackup() {
  const s = useStore.getState();
  return {
    app: 'Clipsy',
    version: 3,
    exportedAt: new Date().toISOString(),
    data: {
      events: s.events,
      tasks: s.tasks,
      ideas: s.ideas,
      goals: s.goals,
      alarms: s.alarms,
      reminders: s.reminders,
      clocks: s.clocks,
      transactions: s.transactions,
      recurring: s.recurring,
      settings: s.settings,
    } satisfies Partial<RazorData>,
  };
}

/** Cuántos elementos tiene una copia (sin contar los ajustes). */
export function backupCount(b: ReturnType<typeof buildBackup>): number {
  const d = b.data;
  return d.events.length + d.tasks.length + d.ideas.length + d.goals.length + d.alarms.length + d.reminders.length + d.transactions.length + d.recurring.length;
}

export async function exportBackup(): Promise<void> {
  const payload = buildBackup();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clipsy-backup-${todayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function pickBackup(): Promise<PickResult> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    let settled = false;
    const done = (r: PickResult) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(r);
    };
    input.addEventListener('cancel', () => done({ status: 'canceled' }));
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return done({ status: 'canceled' });
      try {
        done(parseBackup(JSON.parse(await file.text())));
      } catch {
        done({ status: 'invalid' });
      }
    });
    document.body.appendChild(input);
    input.click();
  });
}

/** Abre el selector y devuelve el texto del archivo elegido (para importar .ics). */
export function pickTextFile(accept: string, _mimeTypes: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    let settled = false;
    const done = (r: string | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(r);
    };
    input.addEventListener('cancel', () => done(null));
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return done(null);
      done(file.size > 20 * 1024 * 1024 ? null : await file.text().catch(() => null));
    });
    document.body.appendChild(input);
    input.click();
  });
}
