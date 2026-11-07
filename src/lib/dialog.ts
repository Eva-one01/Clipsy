import { Alert, Platform } from 'react-native';
import { create } from 'zustand';

/** Mismo formato que los botones de Alert.alert de React Native. */
export interface DialogButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface DialogState {
  title: string;
  message?: string;
  buttons: DialogButton[];
}

export const useDialogStore = create<{ current: DialogState | null; queue: DialogState[] }>()(() => ({
  current: null,
  queue: [],
}));

/**
 * Diálogo multiplataforma con la misma API que Alert.alert.
 * Móvil: diálogo nativo del sistema. Escritorio/web: diálogo propio con el estilo de la app
 * (Alert.alert no hace nada en react-native-web).
 */
export function showDialog(title: string, message?: string, buttons?: DialogButton[]) {
  const list = buttons && buttons.length ? buttons : [{ text: 'OK' }];
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, list);
    return;
  }
  const next: DialogState = { title, message, buttons: list };
  useDialogStore.setState((s) => (s.current ? { queue: [...s.queue, next] } : { current: next }));
}

/** Cierra el diálogo actual y ejecuta la acción del botón elegido. */
export function resolveDialog(button?: DialogButton) {
  useDialogStore.setState((s) => {
    const [head, ...rest] = s.queue;
    return { current: head ?? null, queue: rest };
  });
  button?.onPress?.();
}
