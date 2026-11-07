/**
 * Alta rápida en lenguaje natural, en los 6 idiomas de la app a la vez:
 *   «Reunión con Ana mañana a las 10»      → evento mañana 10:00–11:00
 *   «Llamar al banco el viernes !!»         → tarea para el viernes, prioridad alta
 *   «Recuérdame pagar el arriendo el 30/11» → recordatorio el 30/11 a las 9:00
 *   «Netflix $15» · «gasté 20 en café»      → gasto
 *   «+2000 salario»                         → ingreso
 *   «idea: app de recetas»                  → idea
 * Sin dependencias de Intl ni de regex Unicode (Hermes y web se comportan igual).
 */
import type { DateKey, Priority, TimeHM } from '@/store/types';

export type QuickKind = 'task' | 'event' | 'reminder' | 'expense' | 'income' | 'idea';

export interface QuickParsed {
  kind: QuickKind;
  title: string;
  date: DateKey | null;
  time: TimeHM | null;
  end: TimeHM | null;
  priority: Priority;
  amount: number | null;
}

const L = 'A-Za-zÀ-ÖØ-öø-ÿĀ-žА-яЁё';
const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (d: Date): DateKey => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const plus = (base: Date, n: number) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);

/** Palabra completa (sin \b, que no entiende tildes ni cirílico). */
const word = (alts: string) => new RegExp(`(^|[^${L}])(?:${alts})(?=[^${L}]|$)`, 'i');

// 0 = domingo … 6 = sábado. Incluye formas con preposición/caso (ru «в среду», de «am Montag»).
const WEEKDAYS: [number, string][] = [
  [0, 'domingo|sunday|dimanche|воскресенье|sonntag'],
  [1, 'lunes|monday|segunda(?:-feira)?|lundi|понедельник|montag'],
  [2, 'martes|tuesday|terça(?:-feira)?|terca(?:-feira)?|mardi|вторник|dienstag'],
  [3, 'miércoles|miercoles|wednesday|quarta(?:-feira)?|mercredi|среду|среда|mittwoch'],
  [4, 'jueves|thursday|quinta(?:-feira)?|jeudi|четверг|donnerstag'],
  [5, 'viernes|friday|sexta(?:-feira)?|vendredi|пятницу|пятница|freitag'],
  [6, 'sábado|sabado|saturday|samedi|субботу|суббота|samstag'],
];
// Preposiciones que acompañan a la fecha y se quitan del título.
const DATE_PREP = '(?:el|la|este|esta|el próximo|el proximo|on|this|next|no|na|neste|nesta|ce|le|в|во|am|diesen|nächsten|naechsten)\\s+';

const TODAY = 'hoy|today|hoje|aujourd[\'’]hui|сегодня|heute';
const TOMORROW = 'mañana|manana|tomorrow|amanhã|amanha|demain|завтра|morgen';
const AFTER_TOMORROW = 'pasado mañana|pasado manana|day after tomorrow|depois de amanhã|depois de amanha|après-demain|apres-demain|послезавтра|übermorgen|uebermorgen';
const NEXT_WEEK =
  'la próxima semana|la proxima semana|la semana que viene|próxima semana|proxima semana|next week|semana que vem|na próxima semana|la semaine prochaine|semaine prochaine|на следующей неделе|следующей неделе|nächste woche|naechste woche';

const REMIND = 'recuérdame|recuerdame|recordarme|recordar|remind me(?: to)?|remind|lembre-me de|lembre-me|lembrar de|lembrar|rappelle-moi de|rappelle-moi|rappeler|напомни мне|напомни|erinnere mich an|erinnere mich|erinnern';
const EVENT = 'reunión|reunion|cita|llamada|meeting|call|appointment|reunião|reuniao|consulta|réunion|rendez-vous|rdv|встреча|созвон|termin|besprechung|meeting';
const EXPENSE = 'gasté|gaste|pagué|pague|gasto|spent|paid|expense|gastei|paguei|despesa|dépensé|depense|payé|paye|dépense|потратил|потратила|заплатил|заплатила|расход|ausgegeben|bezahlt|ausgabe';
const INCOME = 'cobré|cobre|recibí|recibi|ingreso|earned|received|income|got paid|recebi|ganhei|receita|reçu|recu|gagné|gagne|revenu|получил|получила|доход|erhalten|bekommen|verdient|einnahme';
const IDEA = /^\s*(idea|ideia|idée|idee|идея)\s*[:：-]\s*/i;

function strip(s: string, re: RegExp) {
  return s.replace(re, (_m, pre: string) => pre ?? ' ');
}

function toHM(h: number, m: number, ampm?: string): TimeHM | null {
  const a = ampm?.toLowerCase().replace(/\./g, '');
  if (a === 'pm' && h < 12) h += 12;
  if (a === 'am' && h === 12) h = 0;
  if (h > 23 || m > 59) return null;
  return `${pad(h)}:${pad(m)}`;
}

export function parseQuick(input: string, now = new Date()): QuickParsed {
  let s = ` ${input.trim()} `;
  const out: QuickParsed = { kind: 'task', title: '', date: null, time: null, end: null, priority: 0, amount: null };

  // Idea
  if (IDEA.test(s)) {
    return { ...out, kind: 'idea', title: s.replace(IDEA, '').trim() };
  }

  // Prioridad: «!» media, «!!» o «!!!» alta.
  s = s.replace(/(\s)(!{1,3})(?=\s)/, (_m, pre: string, bangs: string) => {
    out.priority = bangs.length >= 2 ? 2 : 1;
    return pre;
  });

  // Recordatorio
  const rem = word(REMIND);
  if (rem.test(s)) {
    out.kind = 'reminder';
    s = strip(s, rem);
  }

  // Dinero: «$15», «15€», «+2000», o una cifra con palabra de gasto/ingreso.
  const money = /(^|\s)([+-]?)\s?([$€£]?)\s?(\d+(?:[.,]\d{1,2})?)\s?([$€£]|usd|eur|cop|mxn|ars|clp|pen|brl|rub|gbp)?(?=\s|$)/i;
  const isExp = word(EXPENSE);
  const isInc = word(INCOME);
  if (out.kind === 'task') {
    const m = s.match(money);
    const hasSymbol = m && (m[3] || m[5] || m[2] === '+');
    const kwExp = isExp.test(s);
    const kwInc = isInc.test(s);
    if (m && (hasSymbol || kwExp || kwInc)) {
      out.amount = Number(m[4].replace(',', '.'));
      out.kind = m[2] === '+' || (kwInc && !kwExp) ? 'income' : 'expense';
      s = s.replace(money, (_x, pre: string) => pre);
      s = strip(strip(s, isExp), isInc);
      // «en café», «on coffee», «für Kaffee»…
      s = s.replace(/^\s*(?:en|on|for|em|com|pour|en|на|за|für|fuer)\s+/i, ' ');
    }
  }

  // Fechas relativas
  const setDate = (d: Date) => {
    out.date = keyOf(d);
  };
  const tryWord = (alts: string, d: () => Date) => {
    const re = word(`(?:${DATE_PREP})?(?:${alts})`);
    if (out.date || !re.test(s)) return;
    setDate(d());
    s = strip(s, re);
  };
  tryWord(AFTER_TOMORROW, () => plus(now, 2));
  tryWord(NEXT_WEEK, () => plus(now, ((8 - now.getDay()) % 7) || 7));
  tryWord(TOMORROW, () => plus(now, 1));
  tryWord(TODAY, () => now);
  for (const [dow, alts] of WEEKDAYS) {
    tryWord(alts, () => plus(now, ((dow - now.getDay() + 7) % 7) || 7));
  }
  // «en 3 días», «in 3 days», «em 3 dias», «dans 3 jours», «через 3 дня», «in 3 Tagen»
  if (!out.date) {
    const re = /(^|\s)(?:en|in|em|dans|через)\s+(\d{1,3})\s+(?:días|dias|day|days|jours?|дн(?:я|ей|ь)|tagen?)(?=\s|$)/i;
    const m = s.match(re);
    if (m) {
      setDate(plus(now, Number(m[2])));
      s = s.replace(re, (_x, pre: string) => pre);
    }
  }
  // «30/11», «30.11», «30/11/2026», con «el/on/le/am» delante opcional.
  if (!out.date) {
    const re = new RegExp(`(^|\\s)(?:${DATE_PREP})?(\\d{1,2})[/.](\\d{1,2})(?:[/.](\\d{2,4}))?(?=\\s|$)`, 'i');
    const m = s.match(re);
    if (m) {
      const d = Number(m[2]);
      const mo = Number(m[3]) - 1;
      let y = m[4] ? Number(m[4]) : now.getFullYear();
      if (y < 100) y += 2000;
      let dt = new Date(y, mo, d);
      if (!m[4] && keyOf(dt) < keyOf(now)) dt = new Date(y + 1, mo, d);
      if (dt.getMonth() === mo && dt.getDate() === d) {
        setDate(dt);
        s = s.replace(re, (_x, pre: string) => pre);
      }
    }
  }

  // Horas: «10:30-12», «a las 5 pm», «at 5pm», «17h30», «um 17 Uhr», «в 17:00», «17:30»
  const T = '(\\d{1,2})(?:[:h](\\d{2}))?\\s*(am|pm|a\\.m\\.|p\\.m\\.)?';
  const range = new RegExp(`(^|\\s)(?:de\\s+|from\\s+|von\\s+|с\\s+)?${T}\\s*(?:-|–|a|to|até|ate|à|bis|до)\\s*${T}\\s*(?:uhr|h)?(?=\\s|$)`, 'i');
  const single = new RegExp(
    `(^|\\s)(?:(?:a\\s+las|a\\s+la|at|às|à|um|в)\\s+${T}\\s*(?:uhr|h|horas|hrs)?|(\\d{1,2})[:h](\\d{2})\\s*(am|pm|a\\.m\\.|p\\.m\\.)?|(\\d{1,2})\\s*(am|pm|a\\.m\\.|p\\.m\\.|uhr|h))(?=\\s|$)`,
    'i',
  );
  const rm = s.match(range);
  if (rm && (rm[3] || rm[4] || rm[6] || rm[7] || /(de|from|von|с)\s+\d/i.test(rm[0]))) {
    const ampmEnd = rm[7];
    const start = toHM(Number(rm[2]), Number(rm[3] ?? 0), rm[4] ?? ampmEnd);
    const end = toHM(Number(rm[5]), Number(rm[6] ?? 0), ampmEnd);
    if (start && end) {
      out.time = start;
      out.end = end;
      s = s.replace(range, (_x, pre: string) => pre);
    }
  }
  if (!out.time) {
    const m = s.match(single);
    if (m) {
      let hm: TimeHM | null = null;
      if (m[2]) hm = toHM(Number(m[2]), Number(m[3] ?? 0), m[4]);
      else if (m[5]) hm = toHM(Number(m[5]), Number(m[6]), m[7]);
      else if (m[8]) {
        const suf = m[9].toLowerCase();
        hm = toHM(Number(m[8]), 0, suf === 'am' || suf === 'pm' || suf.includes('.') ? suf : undefined);
      }
      if (hm) {
        out.time = hm;
        s = s.replace(single, (_x, pre: string) => pre);
      }
    }
  }

  // Tipo: evento si lo dice o si tiene hora; si no, tarea.
  if (out.kind === 'task' && (out.time || word(EVENT).test(s))) out.kind = 'event';
  if (out.kind === 'event') {
    if (!out.date) {
      // Una hora que ya pasó hoy, sin fecha, se entiende como mañana.
      const past = out.time && out.time <= `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      out.date = keyOf(past ? plus(now, 1) : now);
    }
    if (out.time && !out.end) {
      const [h, m] = out.time.split(':').map(Number);
      out.end = h >= 23 ? '23:59' : `${pad(h + 1)}:${pad(m)}`;
    }
  }
  if (out.kind === 'reminder') {
    if (!out.time) out.time = '09:00';
    if (!out.date) {
      const past = out.time <= `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      out.date = keyOf(past ? plus(now, 1) : now);
    }
  }
  if ((out.kind === 'expense' || out.kind === 'income') && !out.date) out.date = keyOf(now);

  out.title = s
    .replace(/\s+/g, ' ')
    .replace(/^\s*(?:de|que|to|que|à|de|zu|an)\s+/i, '')
    .replace(/\s+(?:a\s+las|a|at|el|la|on|um|в|à|às|no|na)\s*$/i, '')
    .trim()
    .replace(/^[,.;:\-–]+|[,.;:\-–]+$/g, '')
    .trim();
  if (out.title) out.title = out.title[0].toUpperCase() + out.title.slice(1);
  return out;
}
