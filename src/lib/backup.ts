import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { t } from '@/i18n';
import { useStore, type RazorData } from '@/store';
import { parseBackup, type PickResult } from './backupFormat';
import { todayKey } from './date';

const APP = 'Clipsy';
const FORMAT_VERSION = 3;

interface BackupFile {
  app: typeof APP;
  version: number;
  exportedAt: string;
  data: Partial<RazorData>;
}

export type { PickResult };

/** Guarda todos los datos en un archivo .json y abre el menú del sistema para guardarlo o enviarlo. */
export async function exportBackup(): Promise<void> {
  const s = useStore.getState();
  const payload: BackupFile = {
    app: APP,
    version: FORMAT_VERSION,
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
      settings: s.settings,
    },
  };

  const file = new File(Paths.cache, `clipsy-backup-${todayKey()}.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(payload, null, 2));

  if (!(await Sharing.isAvailableAsync())) throw new Error('sharing-unavailable');
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    UTI: 'public.json',
    dialogTitle: t('set.exportTitle'),
  });
}

/** Abre el selector de archivos y valida que sea una copia de Razor. No modifica nada todavía. */
export async function pickBackup(): Promise<PickResult> {
  const picked = await File.pickFileAsync({ mimeTypes: ['application/json', 'text/plain', 'application/octet-stream'] });
  if (picked.canceled || !picked.result) return { status: 'canceled' };
  try {
    return parseBackup(JSON.parse(await picked.result.text()));
  } catch {
    return { status: 'invalid' };
  }
}

/** Abre el selector y devuelve el texto del archivo elegido (para importar .ics). */
export async function pickTextFile(_accept: string, mimeTypes: string[]): Promise<string | null> {
  const picked = await File.pickFileAsync({ mimeTypes });
  if (picked.canceled || !picked.result) return null;
  return picked.result.text();
}
