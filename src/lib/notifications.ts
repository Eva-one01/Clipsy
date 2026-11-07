import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import type { Alarm, CalendarEvent, RecurringTx, Reminder } from '@/store/types';
import { isSimpleRepeat, nextCharges, nextOccurrences } from './recurrence';
import { formatMoney } from './money';
import { t } from '@/i18n';
import { formatLead, formatTime, fromKey, timeToMinutes, todayKey } from './date';
import { useStore } from '@/store';

export const CHANNEL_ALARMS = 'alarms';
export const CHANNEL_REMINDERS = 'reminders';

let configured = false;

/** Llamar una vez al arrancar. No pide permisos: eso se hace en contexto. */
export async function configureNotifications() {
  if (configured) return;
  configured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ALARMS, {
      name: t('notif.chAlarms'),
      description: t('notif.chAlarmsDesc'),
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 400, 250, 400, 250, 400],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      enableVibrate: true,
    });
    await Notifications.setNotificationChannelAsync(CHANNEL_REMINDERS, {
      name: t('notif.chReminders'),
      description: t('notif.chRemindersDesc'),
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 200, 120, 200],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
  }
}

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function getPermission(): Promise<PermissionState> {
  const { status } = await Notifications.getPermissionsAsync();
  return status as PermissionState;
}

/** Pide permiso sólo si aún no se ha decidido. Devuelve si podemos notificar. */
export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const res = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return res.granted;
}

export async function cancelMany(ids: string[]) {
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
}

export async function cancelAll() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

function hm(t: string) {
  const m = timeToMinutes(t);
  return { hour: Math.floor(m / 60), minute: m % 60 };
}

export async function scheduleAlarm(alarm: Alarm): Promise<string[]> {
  if (!alarm.enabled) return [];
  const { hour, minute } = hm(alarm.time);
  const content: Notifications.NotificationContentInput = {
    title: alarm.label || t('notif.alarm'),
    body: t('notif.alarmBody', { t: formatTime(alarm.time, use24h()) }),
    sound: 'default',
    priority: Notifications.AndroidNotificationPriority.MAX,
    interruptionLevel: 'timeSensitive',
    data: { kind: 'alarm', id: alarm.id },
  };

  if (alarm.days.length === 0 || alarm.days.length === 7) {
    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: CHANNEL_ALARMS },
    });
    return [id];
  }

  return Promise.all(
    alarm.days.map((d) =>
      Notifications.scheduleNotificationAsync({
        content,
        // expo-notifications: 1 = domingo ... 7 = sábado
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: d + 1, hour, minute, channelId: CHANNEL_ALARMS },
      }),
    ),
  );
}

export async function scheduleReminder(r: Reminder): Promise<string[]> {
  if (r.done || r.at <= Date.now()) return [];
  const id = await Notifications.scheduleNotificationAsync({
    content: { title: r.title, body: t('notif.reminder'), sound: 'default', data: { kind: 'reminder', id: r.id } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(r.at), channelId: CHANNEL_REMINDERS },
  });
  return [id];
}

export async function scheduleEventReminder(e: CalendarEvent): Promise<string[]> {
  if (e.remindBefore === null) return [];
  const startMin = e.allDay ? 9 * 60 : timeToMinutes(e.start);
  const fireMin = startMin - e.remindBefore;
  const body = e.remindBefore === 0 ? t('notif.startsNow') : t('notif.startsIn', { x: formatLead(e.remindBefore) });
  const content: Notifications.NotificationContentInput = {
    title: e.title,
    body: e.allDay ? t('common.today') : body,
    sound: 'default',
    data: { kind: 'event', id: e.id },
  };

  // Si el aviso cae el día anterior (p. ej. 23:45 para un evento a las 00:15) lo acotamos al inicio del día.
  const safeMin = Math.max(0, fireMin);
  const hour = Math.floor(safeMin / 60);
  const minute = safeMin % 60;

  // Repeticiones complejas (cada N, mensuales, anuales, hasta una fecha, con excepciones): se programan
  // las próximas fechas una a una; al abrir la app se vuelven a calcular.
  if (!isSimpleRepeat(e)) {
    const dates = nextOccurrences(e, todayKey(), 12, 200)
      .map((k) => {
        const d = fromKey(k);
        d.setHours(hour, minute, 0, 0);
        return d;
      })
      .filter((d) => d.getTime() > Date.now());
    return Promise.all(
      dates.map((date) =>
        Notifications.scheduleNotificationAsync({
          content,
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL_REMINDERS },
        }),
      ),
    );
  }

  if (e.repeat === 'none') {
    const date = fromKey(e.date);
    date.setHours(hour, minute, 0, 0);
    if (date.getTime() <= Date.now()) return [];
    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL_REMINDERS },
    });
    return [id];
  }
  if (e.repeat === 'daily') {
    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: CHANNEL_REMINDERS },
    });
    return [id];
  }
  const days = e.repeat === 'weekdays' ? [1, 2, 3, 4, 5] : [fromKey(e.date).getDay()];
  return Promise.all(
    days.map((d) =>
      Notifications.scheduleNotificationAsync({
        content,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: d + 1, hour, minute, channelId: CHANNEL_REMINDERS },
      }),
    ),
  );
}

function use24h(): boolean {
  try {
    return useStore.getState().settings.use24h;
  } catch {
    return true;
  }
}

/** Al cambiar de idioma, renombra los canales de Android. */
export async function relabelChannels() {
  configured = false;
  await configureNotifications();
}

/** Al tocar una notificación, abre la sección correspondiente (también en arranque en frío). */
export function useNotificationRouting(ready: boolean) {
  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!ready || !last || last.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const kind = (last.notification.request.content.data as Record<string, unknown> | undefined)?.kind;
    // Pequeño retardo para que el navegador esté montado tras un arranque en frío.
    const t = setTimeout(() => {
      if (kind === 'event') router.navigate('/calendar');
      else if (kind === 'alarm' || kind === 'reminder') router.navigate('/alarms');
      else if (kind === 'recurring') router.navigate('/finance');
    }, 50);
    return () => clearTimeout(t);
  }, [last, ready]);
}

/** Aviso el día antes de un gasto o ingreso fijo, a las 9:00. */
export async function scheduleRecurringReminder(r: RecurringTx): Promise<string[]> {
  if (!r.active || !r.remind) return [];
  const currency = useStore.getState().settings.currency;
  const dates = nextCharges(r, 2)
    .map((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 9, 0, 0))
    .filter((d) => d.getTime() > Date.now());
  return Promise.all(
    dates.map((date) =>
      Notifications.scheduleNotificationAsync({
        content: {
          title: r.note || t(r.type === 'income' ? 'rec.notifIncome' : 'rec.notifExpense'),
          body: t('rec.notifBody', { x: formatMoney(r.amount, currency) }),
          sound: 'default',
          data: { kind: 'recurring', id: r.id },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL_REMINDERS },
      }),
    ),
  );
}
