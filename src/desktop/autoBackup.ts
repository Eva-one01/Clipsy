// Copias de seguridad automáticas (solo escritorio): cada hora se actualiza la copia del día en la
// carpeta de datos; el proceso principal guarda las de los últimos 7 días (desktop/backups.js).
import { useEffect } from 'react';
import { backupCount, buildBackup } from '@/lib/backup';
import { todayKey } from '@/lib/date';
import { auxWindow } from './auxWindow';
import { desktop } from './bridge';

const FIRST_DELAY = 20 * 1000; // deja que la app termine de cargar
const EVERY = 60 * 60 * 1000;

/** El texto de una copia, con el número de elementos al principio para listarlas sin leerlas enteras. */
export function backupText(): { text: string; count: number } {
  const b = buildBackup();
  const count = backupCount(b);
  return { text: JSON.stringify({ clipsyCount: count, ...b }), count };
}

export async function saveDailyBackup(): Promise<boolean> {
  if (!desktop?.backups) return false;
  const { text, count } = backupText();
  // Sin nada que guardar no se escribe: así una app vacía (o borrada sin querer) no tapa copias buenas.
  if (count === 0) return false;
  return desktop.backups.saveDaily(todayKey(), text).catch(() => false);
}

/** Guarda el estado actual antes de restaurar otra copia (se puede volver atrás). */
export async function saveSafetyBackup(): Promise<void> {
  if (!desktop?.backups) return;
  const { text, count } = backupText();
  if (count > 0) await desktop.backups.saveSafety(text).catch(() => false);
}

export function useAutoBackup(ready: boolean) {
  useEffect(() => {
    if (!ready || !desktop?.backups || auxWindow) return;
    const first = setTimeout(() => void saveDailyBackup(), FIRST_DELAY);
    const id = setInterval(() => void saveDailyBackup(), EVERY);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [ready]);
}
