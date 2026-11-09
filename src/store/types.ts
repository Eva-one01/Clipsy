import type { Lang } from '@/i18n';
import type { AccentId } from '@/theme/tokens';

export type ID = string;

/** 'YYYY-MM-DD' en hora local */
export type DateKey = string;
/** 'HH:mm' 24h */
export type TimeHM = string;

export type Repeat = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'monthlyNth' | 'monthlyLast' | 'yearly';

export interface CalendarEvent {
  id: ID;
  title: string;
  date: DateKey;
  start: TimeHM;
  end: TimeHM;
  allDay: boolean;
  color: string;
  notes: string;
  repeat: Repeat;
  /** Cada cuántos días/semanas/meses/años se repite (1 por defecto). */
  interval?: number;
  /** Última fecha en que se repite (incluida). */
  until?: DateKey | null;
  /** Fechas en que NO ocurre (repeticiones borradas una a una). */
  exceptions?: DateKey[];
  /** minutos antes para avisar; null = sin aviso */
  remindBefore: number | null;
  notificationIds: string[];
}

export type Priority = 0 | 1 | 2;

export interface Task {
  id: ID;
  title: string;
  done: boolean;
  doneAt: number | null;
  due: DateKey | null;
  priority: Priority;
  goalId: ID | null;
  notes: string;
  createdAt: number;
}

export interface Idea {
  id: ID;
  text: string;
  pinned: boolean;
  createdAt: number;
}

export interface Goal {
  id: ID;
  title: string;
  why: string;
  progress: number; // 0..100
  deadline: DateKey | null;
  color: string;
  createdAt: number;
  archived: boolean;
}

export interface Alarm {
  id: ID;
  time: TimeHM;
  label: string;
  /** 0 = domingo ... 6 = sábado. Vacío = todos los días */
  days: number[];
  enabled: boolean;
  notificationIds: string[];
}

export interface Reminder {
  id: ID;
  title: string;
  at: number; // epoch ms
  done: boolean;
  notificationIds: string[];
}

export interface WorldClock {
  id: ID;
  tz: string;
  /** Nombre libre (zonas IANA escritas a mano) o respaldo */
  city: string;
  /** ID de la lista curada: permite mostrar el nombre en cada idioma */
  cityId?: string;
  /** Visible siempre en la esquina superior derecha (además del principal). */
  pinned?: boolean;
}

export type TxType = 'income' | 'expense';

export interface Transaction {
  id: ID;
  type: TxType;
  amount: number;
  category: string;
  note: string;
  date: DateKey;
  createdAt: number;
}

/** Gasto o ingreso fijo que se registra solo cada mes (alquiler, suscripciones, nómina…). */
export interface RecurringTx {
  id: ID;
  type: TxType;
  amount: number;
  category: string;
  note: string;
  /** Día del mes en que se cobra (1–31; en meses cortos, el último día). */
  day: number;
  active: boolean;
  /** Último mes registrado, 'YYYY-MM'. */
  lastPosted: string | null;
  /** Avisar el día antes del cobro. */
  remind: boolean;
  notificationIds: string[];
  createdAt: number;
}

export type ThemePref = 'system' | 'light' | 'dark';

export interface Settings {
  language: Lang;
  theme: ThemePref;
  accent: AccentId;
  currency: string;
  weekStartsMonday: boolean;
  monthlyBudget: number;
  onboarded: boolean;
  use24h: boolean;
  /** Reloj principal de la cabecera. Si no existe, se usa el primero de la lista. */
  primaryClockId?: string | null;
  /** Límite mensual por categoría de gasto (clave de categoría → importe). */
  categoryBudgets?: Record<string, number>;
  /** Avisos de presupuesto ya mostrados este mes: 'YYYY-MM:categoría:80|100'. */
  budgetAlerts?: string[];
  /** Fecha de la última revisión semanal completada. */
  lastReview?: DateKey | null;
}
