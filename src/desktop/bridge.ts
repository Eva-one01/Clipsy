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

export type UpdateStatus = 'idle' | 'disabled' | 'checking' | 'none' | 'available' | 'downloading' | 'ready' | 'error';
export interface UpdateState {
  status: UpdateStatus;
  current: string;
  version?: string;
  progress?: number;
  /** true en macOS sin firmar: se descarga desde la web en vez de instalarse sola. */
  manual?: boolean;
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

/** API expuesta por desktop/preload.js (contextBridge). Solo existe dentro de la app de escritorio. */
export interface RazorDesktop {
  platform: 'darwin' | 'win32' | 'linux';
  version: string;
  focus(): void;
  /** Ventana «Hoy» flotante. */
  openMini?(): void;
  /** Oculta la barra de alta rápida. */
  hideQuick?(): void;
  /** Abre la ventana principal en una ruta (desde las ventanas auxiliares). */
  openInMain?(route: string): void;
  /** Texto de lo próximo (alarma, recordatorio o evento) para la bandeja del sistema. */
  setTrayInfo?(label: string | null): void;
  onQuickOpen?(cb: () => void): () => void;
  /** Atajo de voz (Ctrl+Alt+Espacio): la barra rápida empieza o deja de escuchar. */
  onQuickVoice?(cb: () => void): () => void;
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
  updates?: {
    get(): Promise<UpdateState>;
    check(): Promise<UpdateState>;
    install(): void;
    onChange(cb: (s: UpdateState) => void): () => void;
  };
}

export const desktop: RazorDesktop | null =
  Platform.OS === 'web' && typeof window !== 'undefined' ? ((window as unknown as { razorDesktop?: RazorDesktop }).razorDesktop ?? null) : null;

export const isDesktopApp = desktop !== null;

/** Atajo legible para mostrar en la ayuda: ⌘ en Mac, Ctrl en Windows/Linux. */
export const modKey = desktop?.platform === 'darwin' ? '⌘' : 'Ctrl';
