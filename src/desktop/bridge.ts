import { Platform } from 'react-native';

/** Acciones que el menú y los atajos de teclado del escritorio envían a la app. */
export type MenuAction =
  | 'nav:index'
  | 'nav:calendar'
  | 'nav:lists'
  | 'nav:finance'
  | 'nav:more'
  | 'new:task'
  | 'new:event'
  | 'new:reminder'
  | 'new:transaction'
  | 'open:settings'
  | 'open:help'
  | 'open:search';

export type LicenseStatus = 'checking' | 'valid' | 'none' | 'revoked' | 'offline' | 'unconfigured' | 'trial_expired';
export interface LicenseState {
  status: LicenseStatus;
  email?: string;
  checkedAt?: number;
  /** En prueba gratuita: cuándo termina (ms). Sin este campo, la licencia es completa. */
  trialEndsAt?: number;
  reason?: string;
  dev?: boolean;
}
export type LicenseError =
  | 'invalid'
  | 'unconfirmed'
  | 'rate'
  | 'not_purchased'
  | 'device_limit'
  | 'network'
  | 'unconfigured'
  | 'trial_expired'
  | 'trial_used'
  | 'generic'
  | string;

export type UpdateStatus = 'idle' | 'disabled' | 'checking' | 'none' | 'available' | 'downloading' | 'ready' | 'installing' | 'error';
export interface UpdateState {
  status: UpdateStatus;
  current: string;
  version?: string;
  progress?: number;
  /** true en macOS sin firmar: se descarga desde la web en vez de instalarse sola. */
  manual?: boolean;
  /** Ya está descargada (sirve para reintentar la instalación). */
  downloaded?: boolean;
  /** Se acaba de actualizar a esta versión (aviso al volver a abrir). */
  updatedTo?: string;
  /** Se intentó instalar esta versión y no se completó (plan B: reintentar o descargar el instalador). */
  failedTo?: string;
}

/** Dictado por voz (whisper.cpp en el equipo). Solo Windows x64 por ahora. */
export interface VoiceState {
  supported: boolean;
  installed: boolean;
  installing: boolean;
  /** 0–1 mientras se descarga el motor y el modelo. */
  progress: number;
  sizeMB: number;
  error: string | null;
}
export interface VoiceResult {
  ok: boolean;
  text?: string;
  error?: string;
}

export interface SyncResponse {
  ok: boolean;
  error?: string;
  status?: number;
  version?: number;
  blob?: string;
  salt?: string;
  updatedAt?: string;
}

/** Un atajo configurable (desktop/shortcuts.js). `accel` vacío = sin atajo; `busy` = otro programa lo tiene. */
export interface ShortcutInfo {
  action: string;
  accel: string;
  def: string;
  global: boolean;
  busy: boolean;
}
export type ShortcutResult = { ok: true; list: ShortcutInfo[] } | { ok: false; error: 'invalid' | 'reserved' | 'duplicate' | 'taken'; with?: string; list: ShortcutInfo[] };

/** Archivo leído para importar: filas de texto (las tablas conservan sus columnas). */
export type ImportFile =
  | { ok: true; name: string; source: string; rows: string[][] }
  | { ok: false; error: 'canceled' | 'too_big' | 'old_format' | 'unsupported' | 'ocr_unsupported' | 'empty' | 'ocr' | 'read' };

/** API expuesta por desktop/preload.js (contextBridge). Solo existe dentro de la app de escritorio. */
export interface RazorDesktop {
  platform: 'darwin' | 'win32' | 'linux';
  version: string;
  focus(): void;
  /** Ventana «Hoy» flotante. */
  openMini?(): void;
  /** Atajo de dictado que se pudo registrar (p. ej. «CommandOrControl+Shift+D»), o null si otro programa los usa todos. */
  voiceShortcut?: string | null;
  /** Alto de la barra de título propia (solo ventana principal en Windows; 0 si no hay). */
  titleBar?: number;
  /** Colores de los botones del sistema (minimizar, maximizar, cerrar) según el tema. */
  setTitleBar?(color: string, symbol: string): void;
  /** Atajos configurables. */
  shortcuts?: {
    initial: ShortcutInfo[];
    list(): Promise<ShortcutInfo[]>;
    set(action: string, accel: string): Promise<ShortcutResult>;
    reset(): Promise<ShortcutInfo[]>;
    /** Mientras se graba una combinación, los atajos actuales no se disparan. */
    pause(paused: boolean): void;
    onChange(cb: (list: ShortcutInfo[]) => void): () => void;
  };
  /** Oculta la barra de alta rápida. */
  hideQuick?(): void;
  /** Abre la barra rápida ya escuchando (botón del micrófono de la ventana principal). */
  openQuickVoice?(): void;
  /** La barra rápida ajusta la altura de su ventana a su contenido. */
  setQuickHeight?(height: number): void;
  /** Abre la ventana principal en una ruta (desde las ventanas auxiliares). */
  openInMain?(route: string): void;
  /** Texto de lo próximo (alarma, recordatorio o evento) para la bandeja del sistema. */
  setTrayInfo?(label: string | null): void;
  onQuickOpen?(cb: () => void): () => void;
  /** Atajo de voz (Ctrl+Shift+D): la barra rápida empieza o deja de escuchar. */
  onQuickVoice?(cb: () => void): () => void;
  /** Importar: diálogo del sistema + lectura del archivo en el equipo (desktop/importer.js). */
  importer?: {
    pick(lang: string): Promise<ImportFile>;
    info(): Promise<{ photos: boolean }>;
  };
  voice?: {
    status(): Promise<VoiceState>;
    install(): Promise<VoiceState>;
    remove(): Promise<VoiceState>;
    /** WAV mono de 16 kHz → texto. */
    transcribe(wav: ArrayBuffer, lang: string): Promise<VoiceResult>;
    onChange(cb: (st: VoiceState) => void): () => void;
  };
  onNavigate?(cb: (route: string) => void): () => void;
  /** Copia texto al portapapeles del sistema. */
  copyText?(text: string): void;
  setLanguage(lang: string): void;
  setTheme(theme: 'system' | 'light' | 'dark'): void;
  getOpenAtLogin(): Promise<boolean>;
  setOpenAtLogin(value: boolean): Promise<boolean>;
  onMenu(cb: (action: MenuAction) => void): () => void;
  openSite?(where: 'buy' | 'account' | 'devices' | 'forgot' | 'downloads'): void;
  license?: {
    get(): Promise<LicenseState>;
    activate(email: string, password: string): Promise<{ ok: boolean; error?: LicenseError; limit?: number }>;
    deactivate(): Promise<LicenseState>;
    refresh(): Promise<LicenseState>;
    onChange(cb: (s: LicenseState) => void): () => void;
  };
  sync?: {
    get(): Promise<SyncResponse>;
    put(baseVersion: number, blob: string, salt: string): Promise<SyncResponse>;
    remove(): Promise<SyncResponse>;
    getKey(): Promise<string | null>;
    setKey(b64: string): Promise<boolean>;
    clearKey(): Promise<boolean>;
  };
  /** Informes de errores (Sentry). `available`: la copia tiene un DSN configurado. */
  errorReports?: {
    report(p: { kind?: string; name?: string; message: string; stack?: string; source?: string }): void;
    get(): Promise<{ enabled: boolean; available: boolean }>;
    set(v: boolean): Promise<{ enabled: boolean; available: boolean }>;
    test?(): Promise<{ ok: boolean }>;
  };
  updates?: {
    get(): Promise<UpdateState>;
    check(): Promise<UpdateState>;
    install(opts?: { visible?: boolean }): void;
    dismiss?(): void;
    download?(): void;
    onChange(cb: (s: UpdateState) => void): () => void;
  };
}

export const desktop: RazorDesktop | null =
  Platform.OS === 'web' && typeof window !== 'undefined' ? ((window as unknown as { razorDesktop?: RazorDesktop }).razorDesktop ?? null) : null;

export const isDesktopApp = desktop !== null;

/** Atajo legible para mostrar en la ayuda: ⌘ en Mac, Ctrl en Windows/Linux. */
export const modKey = desktop?.platform === 'darwin' ? '⌘' : 'Ctrl';

/** «CommandOrControl+Shift+D» → ['Mod', 'Shift', 'D']. */
export function accelKeys(acc: string): string[] {
  return acc ? acc.split('+').map((k) => (k === 'CommandOrControl' || k === 'CmdOrCtrl' ? 'Mod' : k)) : [];
}

// Atajos actuales (se actualizan al cambiarlos en Ajustes, desde cualquier ventana).
let shortcutList: ShortcutInfo[] = desktop?.shortcuts?.initial ?? [];
const shortcutSubs = new Set<() => void>();
desktop?.shortcuts?.onChange((list) => {
  shortcutList = list;
  shortcutSubs.forEach((f) => f());
});
export function getShortcuts(): ShortcutInfo[] {
  return shortcutList;
}
export function setShortcutList(list: ShortcutInfo[]) {
  shortcutList = list;
  shortcutSubs.forEach((f) => f());
}
export function subscribeShortcuts(f: () => void): () => void {
  shortcutSubs.add(f);
  return () => shortcutSubs.delete(f);
}

/** Teclas del atajo de dictado registrado («CommandOrControl+Shift+D» → ['Mod', 'Shift', 'D']), o null. */
export function voiceKeys(): string[] | null {
  const acc = shortcutList.find((s) => s.action === 'voice')?.accel ?? desktop?.voiceShortcut ?? '';
  return acc ? accelKeys(acc) : null;
}

/** El atajo de dictado como texto («Ctrl+Shift+D»), o null si no hay. */
export function voiceKeysLabel(): string | null {
  const keys = voiceKeys();
  return keys ? keys.map((k) => (k === 'Mod' ? modKey : k)).join('+') : null;
}

// Errores de la interfaz → informes de errores (el proceso principal decide si se envían).
if (desktop?.errorReports && typeof window !== 'undefined') {
  const rep = desktop.errorReports;
  window.addEventListener('error', (e) => {
    rep.report({ kind: 'error', name: e.error?.name, message: e.message, stack: e.error?.stack, source: `${e.filename}:${e.lineno}:${e.colno}` });
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason as { name?: string; message?: string; stack?: string } | undefined;
    rep.report({ kind: 'unhandledrejection', name: r?.name, message: String(r?.message ?? r), stack: r?.stack });
  });
}
