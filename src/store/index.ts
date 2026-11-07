import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCalendars, getLocales } from 'expo-localization';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { cityForTz } from '@/constants/cities';
import { detectLanguage, languages, setLanguage } from '@/i18n';
import { accents } from '@/theme/tokens';
import { uid } from '@/lib/id';
import {
  cancelAll,
  cancelMany,
  relabelChannels,
  scheduleAlarm,
  scheduleEventReminder,
  scheduleRecurringReminder,
  scheduleReminder,
} from '@/lib/notifications';
import type {
  Alarm,
  CalendarEvent,
  Goal,
  ID,
  Idea,
  RecurringTx,
  Reminder,
  Settings,
  Task,
  Transaction,
  WorldClock,
} from './types';

type NewEvent = Omit<CalendarEvent, 'id' | 'notificationIds'>;
type NewTask = Pick<Task, 'title'> & Partial<Omit<Task, 'id' | 'createdAt'>>;
type NewGoal = Pick<Goal, 'title'> & Partial<Omit<Goal, 'id' | 'createdAt'>>;
type NewAlarm = Omit<Alarm, 'id' | 'notificationIds'>;
type NewReminder = Omit<Reminder, 'id' | 'notificationIds' | 'done'>;
type NewTx = Omit<Transaction, 'id' | 'createdAt'>;
type NewRecurring = Omit<RecurringTx, 'id' | 'createdAt' | 'notificationIds' | 'lastPosted'> & { lastPosted?: string | null };

interface Data {
  events: CalendarEvent[];
  tasks: Task[];
  ideas: Idea[];
  goals: Goal[];
  alarms: Alarm[];
  reminders: Reminder[];
  clocks: WorldClock[];
  transactions: Transaction[];
  recurring: RecurringTx[];
  settings: Settings;
}

interface State extends Data {
  hydrated: boolean;

  addEvent(e: NewEvent): Promise<void>;
  /** Añade muchos eventos de una vez (importar .ics). Omite los que ya existen (mismo título, día y hora). */
  importEvents(list: NewEvent[]): number;
  updateEvent(id: ID, patch: Partial<NewEvent>): Promise<void>;
  deleteEvent(id: ID): Promise<void>;
  /** Borra solo una repetición (la fecha queda como excepción). */
  skipOccurrence(id: ID, date: string): Promise<void>;

  addTask(t: NewTask): void;
  updateTask(id: ID, patch: Partial<Task>): void;
  toggleTask(id: ID): void;
  deleteTask(id: ID): void;
  clearDoneTasks(): void;

  addIdea(text: string): void;
  updateIdea(id: ID, text: string): void;
  togglePinIdea(id: ID): void;
  deleteIdea(id: ID): void;

  addGoal(g: NewGoal): void;
  updateGoal(id: ID, patch: Partial<Goal>): void;
  deleteGoal(id: ID): void;

  addAlarm(a: NewAlarm): Promise<void>;
  updateAlarm(id: ID, patch: Partial<NewAlarm>): Promise<void>;
  deleteAlarm(id: ID): Promise<void>;

  addReminder(r: NewReminder): Promise<void>;
  updateReminder(id: ID, patch: Partial<Omit<Reminder, 'id' | 'notificationIds'>>): Promise<void>;
  deleteReminder(id: ID): Promise<void>;

  addClock(c: Omit<WorldClock, 'id'>): void;
  removeClock(id: ID): void;
  moveClock(id: ID, dir: -1 | 1): void;
  updateClock(id: ID, patch: Partial<Omit<WorldClock, 'id'>>): void;

  addTransaction(t: NewTx): void;
  updateTransaction(id: ID, patch: Partial<NewTx>): void;
  deleteTransaction(id: ID): void;

  addRecurring(r: NewRecurring): Promise<void>;
  updateRecurring(id: ID, patch: Partial<NewRecurring>): Promise<void>;
  deleteRecurring(id: ID): Promise<void>;
  /** Registra los gastos/ingresos fijos que ya tocan este mes. Devuelve cuántos se añadieron. */
  postDueRecurring(): number;

  setSettings(patch: Partial<Settings>): void;
  rescheduleAll(): Promise<void>;
  resetAll(): Promise<void>;
  importData(data: Partial<Data>): Promise<void>;
}

function defaultCurrency(): string {
  try {
    return getLocales()[0]?.currencyCode ?? 'USD';
  } catch {
    return 'USD';
  }
}

function localTz(): string {
  try {
    return getCalendars()[0]?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  } catch {
    return 'UTC';
  }
}

function cityFromTz(tz: string) {
  return tz.split('/').pop()?.replace(/_/g, ' ') ?? tz;
}

function initialData(): Data {
  const tz = localTz();
  return {
    events: [],
    tasks: [],
    ideas: [],
    goals: [],
    alarms: [],
    reminders: [],
    clocks: [{ id: uid(), tz, city: cityFromTz(tz), cityId: cityForTz(tz)?.id }],
    transactions: [],
    recurring: [],
    settings: {
      language: detectLanguage(),
      theme: 'system',
      accent: 'blue',
      currency: defaultCurrency(),
      weekStartsMonday: true,
      haptics: true,
      monthlyBudget: 0,
      onboarded: false,
      use24h: true,
    },
  };
}

/** Las notificaciones nunca deben romper el guardado: si fallan, se guarda igual. */
async function safe(fn: () => Promise<string[]>): Promise<string[]> {
  try {
    return await fn();
  } catch (err) {
    if (__DEV__) console.warn('[notifications]', err);
    return [];
  }
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...initialData(),
      hydrated: false,

      // ——— Eventos ———
      async addEvent(input) {
        const e: CalendarEvent = { ...input, id: uid(), notificationIds: [] };
        e.notificationIds = await safe(() => scheduleEventReminder(e));
        set((s) => ({ events: [...s.events, e] }));
      },
      importEvents(list) {
        const seen = new Set(get().events.map((e) => `${e.title}|${e.date}|${e.allDay ? '' : e.start}`));
        const fresh: CalendarEvent[] = [];
        for (const input of list) {
          const k = `${input.title}|${input.date}|${input.allDay ? '' : input.start}`;
          if (seen.has(k)) continue;
          seen.add(k);
          fresh.push({ ...input, id: uid(), notificationIds: [] });
        }
        if (fresh.length) set((s) => ({ events: [...s.events, ...fresh] }));
        return fresh.length;
      },
      async updateEvent(id, patch) {
        const prev = get().events.find((e) => e.id === id);
        if (!prev) return;
        await cancelMany(prev.notificationIds);
        const next: CalendarEvent = { ...prev, ...patch, notificationIds: [] };
        next.notificationIds = await safe(() => scheduleEventReminder(next));
        set((s) => ({ events: s.events.map((e) => (e.id === id ? next : e)) }));
      },
      async deleteEvent(id) {
        const prev = get().events.find((e) => e.id === id);
        if (prev) await cancelMany(prev.notificationIds);
        set((s) => ({ events: s.events.filter((e) => e.id !== id) }));
      },
      async skipOccurrence(id, date) {
        const prev = get().events.find((e) => e.id === id);
        if (!prev) return;
        await get().updateEvent(id, { exceptions: [...new Set([...(prev.exceptions ?? []), date])] });
      },

      // ——— Tareas ———
      addTask(t) {
        const task: Task = {
          id: uid(),
          title: t.title.trim(),
          done: false,
          doneAt: null,
          due: t.due ?? null,
          priority: t.priority ?? 0,
          goalId: t.goalId ?? null,
          notes: t.notes ?? '',
          createdAt: Date.now(),
        };
        set((s) => ({ tasks: [task, ...s.tasks] }));
      },
      updateTask(id, patch) {
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
      },
      toggleTask(id) {
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done, doneAt: t.done ? null : Date.now() } : t)),
        }));
      },
      deleteTask(id) {
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
      },
      clearDoneTasks() {
        set((s) => ({ tasks: s.tasks.filter((t) => !t.done) }));
      },

      // ——— Ideas ———
      addIdea(text) {
        const idea: Idea = { id: uid(), text: text.trim(), pinned: false, createdAt: Date.now() };
        set((s) => ({ ideas: [idea, ...s.ideas] }));
      },
      updateIdea(id, text) {
        set((s) => ({ ideas: s.ideas.map((i) => (i.id === id ? { ...i, text } : i)) }));
      },
      togglePinIdea(id) {
        set((s) => ({ ideas: s.ideas.map((i) => (i.id === id ? { ...i, pinned: !i.pinned } : i)) }));
      },
      deleteIdea(id) {
        set((s) => ({ ideas: s.ideas.filter((i) => i.id !== id) }));
      },

      // ——— Objetivos ———
      addGoal(g) {
        const goal: Goal = {
          id: uid(),
          title: g.title.trim(),
          why: g.why ?? '',
          progress: g.progress ?? 0,
          deadline: g.deadline ?? null,
          color: g.color ?? '#7B93FF',
          createdAt: Date.now(),
          archived: false,
        };
        set((s) => ({ goals: [goal, ...s.goals] }));
      },
      updateGoal(id, patch) {
        set((s) => ({
          goals: s.goals.map((g) =>
            g.id === id ? { ...g, ...patch, progress: Math.max(0, Math.min(100, patch.progress ?? g.progress)) } : g,
          ),
        }));
      },
      deleteGoal(id) {
        set((s) => ({
          goals: s.goals.filter((g) => g.id !== id),
          tasks: s.tasks.map((t) => (t.goalId === id ? { ...t, goalId: null } : t)),
        }));
      },

      // ——— Alarmas ———
      async addAlarm(input) {
        const a: Alarm = { ...input, id: uid(), notificationIds: [] };
        a.notificationIds = await safe(() => scheduleAlarm(a));
        set((s) => ({ alarms: [...s.alarms, a].sort((x, y) => x.time.localeCompare(y.time)) }));
      },
      async updateAlarm(id, patch) {
        const prev = get().alarms.find((a) => a.id === id);
        if (!prev) return;
        await cancelMany(prev.notificationIds);
        const next: Alarm = { ...prev, ...patch, notificationIds: [] };
        next.notificationIds = await safe(() => scheduleAlarm(next));
        set((s) => ({
          alarms: s.alarms.map((a) => (a.id === id ? next : a)).sort((x, y) => x.time.localeCompare(y.time)),
        }));
      },
      async deleteAlarm(id) {
        const prev = get().alarms.find((a) => a.id === id);
        if (prev) await cancelMany(prev.notificationIds);
        set((s) => ({ alarms: s.alarms.filter((a) => a.id !== id) }));
      },

      // ——— Recordatorios ———
      async addReminder(input) {
        const r: Reminder = { ...input, id: uid(), done: false, notificationIds: [] };
        r.notificationIds = await safe(() => scheduleReminder(r));
        set((s) => ({ reminders: [...s.reminders, r].sort((a, b) => a.at - b.at) }));
      },
      async updateReminder(id, patch) {
        const prev = get().reminders.find((r) => r.id === id);
        if (!prev) return;
        await cancelMany(prev.notificationIds);
        const next: Reminder = { ...prev, ...patch, notificationIds: [] };
        next.notificationIds = await safe(() => scheduleReminder(next));
        set((s) => ({ reminders: s.reminders.map((r) => (r.id === id ? next : r)).sort((a, b) => a.at - b.at) }));
      },
      async deleteReminder(id) {
        const prev = get().reminders.find((r) => r.id === id);
        if (prev) await cancelMany(prev.notificationIds);
        set((s) => ({ reminders: s.reminders.filter((r) => r.id !== id) }));
      },

      // ——— Relojes ———
      addClock(c) {
        if (get().clocks.some((x) => x.tz === c.tz && (x.cityId ?? x.city) === (c.cityId ?? c.city))) return;
        set((s) => ({ clocks: [...s.clocks, { ...c, id: uid() }] }));
      },
      removeClock(id) {
        set((s) => ({ clocks: s.clocks.filter((c) => c.id !== id) }));
      },
      updateClock(id, patch) {
        set((s) => ({ clocks: s.clocks.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
      },
      moveClock(id, dir) {
        set((s) => {
          const i = s.clocks.findIndex((c) => c.id === id);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= s.clocks.length) return s;
          const next = [...s.clocks];
          [next[i], next[j]] = [next[j], next[i]];
          return { clocks: next };
        });
      },

      // ——— Finanzas ———
      addTransaction(t) {
        set((s) => ({ transactions: [{ ...t, id: uid(), createdAt: Date.now() }, ...s.transactions] }));
      },
      updateTransaction(id, patch) {
        set((s) => ({ transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
      },
      deleteTransaction(id) {
        set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }));
      },

      // ——— Gastos e ingresos fijos ———
      async addRecurring(input) {
        const r: RecurringTx = { ...input, lastPosted: input.lastPosted ?? null, id: uid(), createdAt: Date.now(), notificationIds: [] };
        r.notificationIds = await safe(() => scheduleRecurringReminder(r));
        set((s) => ({ recurring: [...s.recurring, r].sort((a, b) => a.day - b.day) }));
        get().postDueRecurring();
      },
      async updateRecurring(id, patch) {
        const prev = get().recurring.find((r) => r.id === id);
        if (!prev) return;
        await cancelMany(prev.notificationIds);
        const next: RecurringTx = { ...prev, ...patch, notificationIds: [] };
        next.notificationIds = await safe(() => scheduleRecurringReminder(next));
        set((s) => ({ recurring: s.recurring.map((r) => (r.id === id ? next : r)).sort((a, b) => a.day - b.day) }));
      },
      async deleteRecurring(id) {
        const prev = get().recurring.find((r) => r.id === id);
        if (prev) await cancelMany(prev.notificationIds);
        set((s) => ({ recurring: s.recurring.filter((r) => r.id !== id) }));
      },
      postDueRecurring() {
        const now = new Date();
        const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const add: Transaction[] = [];
        const recurring = get().recurring.map((r) => {
          const day = Math.min(r.day, last);
          if (!r.active || r.lastPosted === month || now.getDate() < day) return r;
          add.push({
            // Id fijo por mes: si dos equipos sincronizados lo registran, se fusiona en uno solo.
            id: `rec-${r.id}-${month}`,
            type: r.type,
            amount: r.amount,
            category: r.category,
            note: r.note,
            date: `${month}-${String(day).padStart(2, '0')}`,
            createdAt: Date.now(),
          });
          return { ...r, lastPosted: month };
        });
        if (add.length) set((s) => ({ recurring, transactions: [...add, ...s.transactions] }));
        return add.length;
      },

      // ——— Ajustes ———
      setSettings(patch) {
        const prevLang = get().settings.language;
        // El idioma global se fija antes de notificar, para que el siguiente render ya lo use.
        if (patch.language) setLanguage(patch.language);
        set((s) => ({ settings: { ...s.settings, ...patch } }));
        if (patch.language && patch.language !== prevLang) {
          // Reprograma para que alarmas y recordatorios lleguen en el nuevo idioma.
          relabelChannels()
            .then(() => get().rescheduleAll())
            .catch(() => undefined);
        }
      },

      /** Reconstruye todas las notificaciones (tras conceder permiso o importar datos). */
      async rescheduleAll() {
        await cancelAll().catch(() => undefined);
        const { events, alarms, reminders } = get();
        const ev = await Promise.all(events.map(async (e) => ({ ...e, notificationIds: await safe(() => scheduleEventReminder(e)) })));
        const al = await Promise.all(alarms.map(async (a) => ({ ...a, notificationIds: await safe(() => scheduleAlarm(a)) })));
        const re = await Promise.all(reminders.map(async (r) => ({ ...r, notificationIds: await safe(() => scheduleReminder(r)) })));
        const rc = await Promise.all(get().recurring.map(async (r) => ({ ...r, notificationIds: await safe(() => scheduleRecurringReminder(r)) })));
        set({ events: ev, alarms: al, reminders: re, recurring: rc });
      },

      async resetAll() {
        await cancelAll().catch(() => undefined);
        const fresh = initialData();
        set({ ...fresh, settings: { ...fresh.settings, language: get().settings.language, onboarded: true } });
      },

      async importData(data) {
        const base = initialData();
        const merged = { ...base.settings, ...(data.settings ?? {}), onboarded: true };
        // Valores de una copia externa: se sanean para no dejar la app en un estado imposible.
        const settings: Settings = {
          ...merged,
          language: languages.some((l) => l.code === merged.language) ? merged.language : base.settings.language,
          accent: merged.accent in accents ? merged.accent : 'blue',
          theme: ['system', 'light', 'dark'].includes(merged.theme) ? merged.theme : 'system',
          monthlyBudget: Number.isFinite(merged.monthlyBudget) && merged.monthlyBudget > 0 ? merged.monthlyBudget : 0,
        };
        setLanguage(settings.language);
        set({
          events: data.events ?? base.events,
          tasks: data.tasks ?? base.tasks,
          ideas: data.ideas ?? base.ideas,
          goals: data.goals ?? base.goals,
          alarms: data.alarms ?? base.alarms,
          reminders: data.reminders ?? base.reminders,
          clocks: (data.clocks ?? base.clocks).map((c) => ({ ...c, cityId: c.cityId ?? cityForTz(c.tz)?.id })),
          transactions: data.transactions ?? base.transactions,
          recurring: data.recurring ?? base.recurring,
          settings,
        });
        // Los IDs de notificación de la copia son de otro dispositivo: se reprograma todo.
        await relabelChannels().catch(() => undefined);
        await get().rescheduleAll();
      },
    }),
    {
      name: 'razor-store',
      version: 4,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s): Data => ({
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
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.settings.language) setLanguage(state.settings.language);
        useStore.setState({ hydrated: true });
      },
      // Punto de entrada para futuras migraciones de esquema (subir `version`).
      migrate: (persisted, version) => {
        const data = persisted as Data;
        if (version < 2 && data?.settings) {
          // v2: idioma + nombres de ciudad traducibles
          data.settings = { ...data.settings, language: data.settings.language ?? detectLanguage() };
          data.clocks = (data.clocks ?? []).map((c) => ({ ...c, cityId: c.cityId ?? cityForTz(c.tz)?.id }));
        }
        if (version < 3 && data?.settings) {
          // v3: color de acento
          data.settings = { ...data.settings, accent: data.settings.accent ?? 'blue' };
        }
        if (version < 4 && data) {
          // v4: gastos fijos (Clipsy)
          data.recurring = data.recurring ?? [];
        }
        return data;
      },
    },
  ),
);

export type { Data as RazorData };
