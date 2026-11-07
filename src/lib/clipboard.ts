import * as Clipboard from 'expo-clipboard';

/** Copia texto al portapapeles. Devuelve true si se pudo. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}
