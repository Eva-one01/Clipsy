import { create } from 'zustand';

/** Estado de la búsqueda global (Ctrl/⌘+K). */
export const usePalette = create<{ open: boolean; initial: string }>()(() => ({ open: false, initial: '' }));
export const openPalette = (initial = '') => usePalette.setState({ open: true, initial });
export const closePalette = () => usePalette.setState({ open: false, initial: '' });
