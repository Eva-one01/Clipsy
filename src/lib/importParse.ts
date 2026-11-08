/**
 * Importar: convierte las filas de un archivo (Excel, CSV, Word, PDF, texto o foto; ver desktop/importer.js)
 * en eventos, tareas o movimientos para revisarlos antes de añadirlos. Sin estado y sin acceso a la tienda.
 *
 *   Rutina u horario: tablas con los días en columnas («Hora | Lunes | Martes…») o líneas como
 *     «Lunes a viernes 8:00 Trabajo», «Sábado 10:00 Mercado», «7:00 Desayuno» (todos los días).
 *   Agenda: filas con fecha («15/11/2026 10:00 Dentista», «2026-11-20 | Reunión»).
 *   Tareas: una por línea, con fecha si la tiene.
 *   Finanzas: extractos u hojas con fecha, descripción y monto (columnas de ingreso/gasto, signo o palabras).
 */
import type { DateKey, Repeat, TimeHM } from '@/store/types';
import { categoryFor, looksLikeIncome, parseQuick, WEEKDAY_NAMES } from './quickParse';

export type ImportGoal = 'routine' | 'agenda' | 'tasks' | 'finance';

export interface ImportItem {
  key: string;
  type: 'event' | 'task' | 'expense' | 'income';
  title: string;
  /** Primera fecha (en rutinas, la próxima vez que toca). */
  date: DateKey | null;
  start: TimeHM | null;
  end: TimeHM | null;
  /** Rutinas: días de la semana (0 = domingo) y cómo se repite. */
  days: number[];
  repeat: Repeat;
  amount: number | null;
  category: string | null;
}

const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (d: Date): DateKey => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/* ───────── Días de la semana ───────── */

// Abreviaturas habituales en horarios (además de los nombres completos de quickParse).
const ABBR: [number, string[]][] = [
  [0, ['dom', 'do', 'd', 'sun', 'su', 'dim', 'so', 'вс']],
  [1, ['lun', 'lu', 'l', 'mon', 'mo', 'seg', 'пн']],
  [2, ['mar', 'ma', 'tue', 'tu', 'ter', 'di', 'вт']],
  [3, ['mie', 'mi', 'x', 'wed', 'we', 'qua', 'mer', 'ср']],
  [4, ['jue', 'ju', 'j', 'thu', 'th', 'qui', 'jeu', 'do', 'чт']],
  [5, ['vie', 'vi', 'v', 'fri', 'fr', 'sex', 'ven', 'пт']],
  [6, ['sab', 'sa', 's', 'sat', 'sam', 'сб']],
];
const FULL: [number, string[]][] = WEEKDAY_NAMES.map(([d, alts]) => [d, alts.split('|').map((a) => fold(a.replace(/\(\?:[^)]*\)\??/g, '')))]);

/** Si la celda es solo un día («Lunes», «LUN.», «Mo», «пн»), su número; si no, null. */
export function weekdayOf(cell: string): number | null {
  const w = fold(cell).replace(/[.:,]$/, '');
  if (!w || w.length > 14) return null;
  for (const [d, names] of FULL) if (names.includes(w) || names.some((n) => n.length > 4 && w === n.split('-')[0])) return d;
  // Abreviaturas de una o dos letras solo cuando es inequívoco por idioma («do» es domingo en es y jueves en de: se descarta).
  for (const [d, abbrs] of ABBR) if (abbrs.includes(w) && w !== 'do' && w !== 'mi' && w !== 'ma') return d;
  return null;
}

const EVERY_DAY = /\b(todos los dias|cada dia|diario|diariamente|a diario|every ?day|daily|todos os dias|diariamente|tous les jours|chaque jour|taglich|jeden tag|каждый день|ежедневно)\b/;
const WEEKEND = /\b(fin(es)? de semana|weekends?|fim de semana|week-?end|wochenende|выходные)\b/;
const WORKDAYS = /\b(entre semana|dias habiles|dias laborables|weekdays|dias uteis|en semaine|werktags|по будням|будни)\b/;

/** Días que menciona un texto: rangos («lunes a viernes», «L-V», «mon-fri»), listas o «todos los días». */
export function daysIn(text: string): number[] {
  const f = ' ' + fold(text) + ' ';
  if (EVERY_DAY.test(f)) return [0, 1, 2, 3, 4, 5, 6];
  if (WORKDAYS.test(f)) return [1, 2, 3, 4, 5];
  if (WEEKEND.test(f)) return [6, 0];
  const tokens = f.split(/[^a-z0-9а-яё]+/).filter(Boolean);
  const found: { d: number; i: number }[] = [];
  tokens.forEach((tk, i) => {
    const d = weekdayOf(tk);
    // Una sola letra solo cuenta pegada a un rango («L-V», «L a V»).
    if (d !== null && (tk.length > 1 || /^[lmxjvsd]$/.test(tk))) found.push({ d, i });
  });
  if (!found.length) return [];
  // Rango: «lunes a viernes», «L-V», «monday to friday», «de segunda a sexta»…
  const range = /([a-zа-яё]+)\.?\s*(?:-|–|a|al|to|till|until|bis|à|au|по|ate|até)\s*([a-zа-яё]+)/g;
  for (const m of fold(text).matchAll(range)) {
    const a = weekdayOf(m[1]);
    const b = weekdayOf(m[2]);
    if (a !== null && b !== null && a !== b) {
      const out: number[] = [];
      for (let d = a; ; d = (d + 1) % 7) {
        out.push(d);
        if (d === b || out.length > 7) break;
      }
      return out;
    }
  }
  const single = found.filter((x) => tokens[x.i].length > 1).map((x) => x.d);
  return [...new Set(single)];
}

/* ───────── Horas, fechas y montos ───────── */

/** «7:00 - 8:00», «9.30», «18h30», «5 pm», «1 3:00» (separado por la foto) → ['07:00', '08:00']. */
export function timesIn(text: string): TimeHM[] {
  const s = text.replace(/\b(\d)\s(\d:\d\d)\b/g, '$1$2');
  const out: TimeHM[] = [];
  const re = /(^|[^\d:])(\d{1,2})(?:[:.h](\d{2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?)?(?=$|[^\d])/gi;
  for (const m of s.matchAll(re)) {
    const hasMin = m[3] != null;
    const ampm = m[4] ? fold(m[4]).replace(/[.\s]/g, '') : '';
    if (!hasMin && !ampm) continue; // un número suelto no es una hora
    let h = Number(m[2]);
    const min = hasMin ? Number(m[3]) : 0;
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    if (h > 23 || min > 59) continue;
    out.push(`${pad(h)}:${pad(min)}`);
    if (out.length === 2) break;
  }
  return out;
}

/** Fecha de una celda: «2026-11-15», «15/11/2026», «15-11-26», «15.11.» o «11/15/2026» (si no puede ser día/mes). */
export function dateOf(cell: string, now = new Date()): DateKey | null {
  const s = cell.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]\d{1,2}:\d{2}.*)?$/.exec(s);
  if (m) return valid(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\.?(?:\s+\d{1,2}:\d{2}.*)?$/.exec(s);
  if (!m) return null;
  let a = Number(m[1]);
  let b = Number(m[2]);
  if (b > 12 && a <= 12) [a, b] = [b, a]; // 11/15/2026 (formato de EE. UU.)
  let y = m[3] ? Number(m[3]) : now.getFullYear();
  if (y < 100) y += 2000;
  return valid(y, b, a);
}
function valid(y: number, mo: number, d: number): DateKey | null {
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? keyOf(dt) : null;
}

/** Monto de una celda: «35000», «$35.000», «1.234,56», «1,234.56», «-120.000», «(50)», «COP 20 000». */
export function amountOf(cell: string): number | null {
  let s = cell.trim();
  if (!/\d/.test(s)) return null;
  // Solo números con símbolos o códigos de moneda (no «Calle 45» ni «3 cuotas»).
  const letters = s.replace(/\b(usd|cop|mxn|eur|ars|clp|pen|brl|gbp|rub|us|mx|r|rs|руб|р)\b|[$€£₽¥]/gi, '');
  if (/[a-zа-яё]/i.test(fold(letters))) return null;
  const neg = /^\(.*\)$/.test(s) || /-\s*[$€£₽¥]?\s*\d/.test(s);
  s = letters.replace(/[^\d.,]/g, '');
  if (!s) return null;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let n: number;
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? '.' : ',';
    n = Number(s.split(dec === '.' ? ',' : '.').join('').replace(dec, '.'));
  } else {
    const sep = lastDot >= 0 ? '.' : lastComma >= 0 ? ',' : '';
    const parts = sep ? s.split(sep) : [s];
    // «35.000» o «1.200.000»: miles. «12,5» o «9.99»: decimales.
    n = sep && (parts.length > 2 || parts[parts.length - 1].length === 3) ? Number(parts.join('')) : Number(s.replace(',', '.'));
  }
  if (!Number.isFinite(n) || n === 0) return null;
  return neg ? -Math.abs(n) : n;
}

/** Próxima fecha (hoy incluido) que cae en ese día de la semana. */
function nextOn(day: number, now: Date): DateKey {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() + ((day - d.getDay() + 7) % 7));
  return keyOf(d);
}
function plusHour(t: TimeHM): TimeHM {
  const [h, m] = t.split(':').map(Number);
  return h >= 23 ? '23:59' : `${pad(h + 1)}:${pad(m)}`;
}
const stripBullet = (s: string) => s.replace(/^\s*(?:[-*•·▪◦>]|\[[ xX✓]?\]|☐|☑|✔|\d{1,3}[.)])\s+/, '');

/** Quita frases como «todos los días» comparando sin acentos (fold conserva la longitud del texto). */
function dropPhrases(text: string, res: RegExp[]): string {
  let out = text.normalize('NFC');
  for (const re of res) {
    const g = new RegExp(re.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = g.exec(' ' + fold(out) + ' '))) {
      const at = m.index - 1;
      out = out.slice(0, Math.max(0, at)) + out.slice(Math.max(0, at) + m[0].length);
      g.lastIndex = 0;
    }
  }
  return out;
}

/* ───────── Rutina ───────── */

interface Slot {
  title: string;
  day: number | null; // null = todos los días
  start: TimeHM | null;
  end: TimeHM | null;
}

const TIME_ONLY = /^[\d\s:.h\-–apm]+$/i;

function routine(rows: string[][], now: Date): ImportItem[] {
  const slots: Slot[] = [];
  let dayCols: Map<number, number> | null = null; // columna → día
  let contextDays: number[] = [];
  for (const row of rows) {
    if (!row.some(Boolean)) {
      dayCols = null;
      continue;
    }
    const asDays = row.map(weekdayOf);
    if (asDays.filter((d) => d !== null).length >= 2) {
      dayCols = new Map();
      asDays.forEach((d, i) => d !== null && dayCols!.set(i, d));
      continue;
    }
    if (dayCols) {
      // Fila de una tabla con los días en columnas: la hora va en las celdas de la izquierda.
      const first = Math.min(...dayCols.keys());
      const rowTimes = timesIn(row.slice(0, first).join(' '));
      for (const [col, day] of dayCols) {
        const cell = clean(row[col] ?? '');
        if (!cell || TIME_ONLY.test(cell)) continue;
        const own = timesIn(cell);
        const times = own.length ? own : rowTimes;
        const title = own.length ? clean(cell.replace(/\b\d{1,2}(?:[:.h]\d{2})?\s*(?:a\.?\s?m\.?|p\.?\s?m\.?)?/gi, '').replace(/^[\s\-–:]+|[\s\-–:]+$/g, '')) : cell;
        if (title) slots.push({ title, day, start: times[0] ?? null, end: times[1] ?? null });
      }
      continue;
    }
    // Líneas sueltas: «Lunes a viernes 8:00 Trabajo», «Sábado | 10:00 | Mercado», «LUNES» (encabezado).
    const text = clean(stripBullet(row.join(' ')));
    const lone = row.filter(Boolean);
    if (lone.length === 1 && weekdayOf(lone[0]) !== null) {
      contextDays = [weekdayOf(lone[0])!];
      continue;
    }
    const days = daysIn(text);
    const times = timesIn(text);
    if (!times.length && !days.length) continue; // títulos («Mi rutina») y notas
    const title = clean(
      text
        .replace(/\b(\d)\s(\d:\d\d)\b/g, '$1$2')
        .replace(/\b\d{1,2}(?:[:.h]\d{2})\s*(?:a\.?\s?m\.?|p\.?\s?m\.?)?|\b\d{1,2}\s*(?:a\.?\s?m\.?|p\.?\s?m\.?)/gi, ' ')
        .split(/\s+/)
        .filter((w) => {
          const f = fold(w).replace(/[.,:;]$/, '');
          return weekdayOf(f) === null && !/^(de|del|a|al|y|e|to|and|till|bis|und|et|au|à|ate|até|по|и|-|–|—|\||:)$/.test(f);
        })
        .join(' ')
        .replace(/^[\s\-–:|,]+|[\s\-–:|,]+$/g, ''),
    );
    const cleanTitle = clean(dropPhrases(title, [EVERY_DAY, WEEKEND, WORKDAYS]).replace(/^[\s\-–:|,]+|[\s\-–:|,]+$/g, ''));
    if (!cleanTitle) continue;
    const useDays = days.length ? days : contextDays.length ? contextDays : [null];
    for (const day of useDays) slots.push({ title: cleanTitle, day, start: times[0] ?? null, end: times[1] ?? null });
  }

  // Agrupa lo mismo a la misma hora en varios días: «Gimnasio 7:00 · lun, mié, vie».
  const groups = new Map<string, { title: string; start: TimeHM | null; end: TimeHM | null; days: Set<number> }>();
  for (const s of slots) {
    const k = `${fold(s.title)}|${s.start}|${s.end}`;
    const g = groups.get(k) ?? { title: s.title, start: s.start, end: s.end, days: new Set<number>() };
    if (s.day === null) [0, 1, 2, 3, 4, 5, 6].forEach((d) => g.days.add(d));
    else g.days.add(s.day);
    groups.set(k, g);
  }
  const items: ImportItem[] = [];
  let n = 0;
  for (const g of groups.values()) {
    const days = [...g.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)); // lunes primero
    const repeat: Repeat = days.length === 7 ? 'daily' : days.length === 5 && [1, 2, 3, 4, 5].every((d) => g.days.has(d)) ? 'weekdays' : 'weekly';
    const first = [...days].sort((a, b) => nextOn(a, now).localeCompare(nextOn(b, now)))[0];
    items.push({
      key: `r${n++}`,
      type: 'event',
      title: g.title,
      date: nextOn(first, now),
      start: g.start,
      end: g.end ?? (g.start ? plusHour(g.start) : null),
      days,
      repeat,
      amount: null,
      category: null,
    });
  }
  // Orden del día: por hora.
  return items.sort((a, b) => (a.start ?? '99').localeCompare(b.start ?? '99'));
}

/* ───────── Agenda y tareas ───────── */

const HEADER_WORDS = /^(fecha|date|data|datum|дата|hora|time|horario|heure|uhr|время|evento|event|titulo|title|tarea|task|tareas|tasks|pendiente|pendientes|descripcion|description|descricao|beschreibung|описание|concepto|detalle|estado|status|prioridad|priority|notas?|notes?|lugar|place|ort|место|aufgabe|tache|tarefa|задача)$/;
const isHeader = (row: string[]) => row.filter(Boolean).length > 0 && row.filter(Boolean).every((c) => HEADER_WORDS.test(fold(c)));

function agendaOrTasks(rows: string[][], goal: 'agenda' | 'tasks', now: Date): ImportItem[] {
  const items: ImportItem[] = [];
  rows.forEach((row, i) => {
    const cells = row.map((c) => clean(c)).filter(Boolean);
    if (!cells.length || isHeader(cells)) return;
    let date: DateKey | null = null;
    const rest: string[] = [];
    for (const c of cells) {
      const d: DateKey | null = date ? null : dateOf(c, now);
      if (d) {
        date = d;
        const t = /\d{1,2}:\d{2}/.exec(c);
        if (t) rest.push(t[0]);
      } else rest.push(c);
    }
    const text = stripBullet(rest.join(' '));
    if (!text) return;
    const p = parseQuick(text, now);
    const times = timesIn(text);
    const title = clean((p.title || text).replace(/^[\s\-–:|]+|[\s\-–:|]+$/g, ''));
    if (!title || title.length > 160) return;
    const when = date ?? p.date;
    if (goal === 'agenda') {
      if (!when) return; // sin fecha no es un evento de agenda
      const start = p.time ?? times[0] ?? null;
      const end = p.end ?? times[1] ?? (start ? plusHour(start) : null);
      items.push({ key: `a${i}`, type: 'event', title, date: when, start, end, days: [], repeat: 'none', amount: null, category: null });
    } else {
      items.push({ key: `t${i}`, type: 'task', title, date: when, start: null, end: null, days: [], repeat: 'none', amount: null, category: null });
    }
  });
  return items;
}

/* ───────── Finanzas ───────── */

const COL = {
  date: /^(fecha|date|data|datum|дата|dia|day)/,
  desc: /^(descripcion|description|descricao|concepto|detalle|detalles|movimiento|nota|note|libelle|beschreibung|verwendungszweck|описание|назначение|comercio|establecimiento|item|articulo)/,
  amount: /^(monto|importe|valor|amount|total|cantidad|precio|price|montant|betrag|сумма|value|quantia)/,
  income: /^(ingresos?|income|entradas?|creditos?|abonos?|haber|recebido|recettes?|credit|einnahmen?|доход|приход)/,
  expense: /^(gastos?|egresos?|expenses?|salidas?|debitos?|cargos?|debe|debit|saidas?|depenses?|ausgaben?|расход)/,
  type: /^(tipo|type|clase|kind|art|тип)$/,
  category: /^(categoria|category|categorie|kategorie|категория|rubro)/,
};

function finance(rows: string[][], now: Date): ImportItem[] {
  const items: ImportItem[] = [];
  let map: Partial<Record<keyof typeof COL, number>> | null = null;
  rows.forEach((row, i) => {
    const cells = row.map((c) => clean(c));
    if (!cells.some(Boolean)) return;
    // Encabezado: «Fecha | Descripción | Monto» o «Fecha | Concepto | Ingreso | Gasto».
    const folded = cells.map(fold);
    const found: Partial<Record<keyof typeof COL, number>> = {};
    folded.forEach((c, ci) => {
      for (const k of Object.keys(COL) as (keyof typeof COL)[]) if (found[k] === undefined && c && COL[k].test(c)) found[k] = ci;
    });
    if (Object.keys(found).length >= 2 && !cells.some((c) => amountOf(c) !== null && !COL.date.test(fold(c)))) {
      map = found;
      return;
    }

    let date: DateKey | null = null;
    let amount: number | null = null;
    let type: 'expense' | 'income' | null = null;
    let desc = '';
    if (map) {
      const m = map as Partial<Record<keyof typeof COL, number>>;
      if (m.date !== undefined) date = dateOf(cells[m.date] ?? '', now);
      if (m.income !== undefined && amountOf(cells[m.income] ?? '')) {
        amount = Math.abs(amountOf(cells[m.income])!);
        type = 'income';
      } else if (m.expense !== undefined && amountOf(cells[m.expense] ?? '')) {
        amount = Math.abs(amountOf(cells[m.expense])!);
        type = 'expense';
      } else if (m.amount !== undefined) amount = amountOf(cells[m.amount] ?? '');
      if (m.type !== undefined) {
        const tp = fold(cells[m.type] ?? '');
        if (COL.income.test(tp)) type = 'income';
        else if (COL.expense.test(tp)) type = 'expense';
      }
      const used = new Set(Object.values(m));
      desc = m.desc !== undefined ? cells[m.desc] : cells.filter((c, ci) => !used.has(ci) && c && amountOf(c) === null && !dateOf(c, now)).join(' ');
    }
    if (amount === null) {
      // Sin encabezado: la última celda con número es el monto; una celda con fecha, la fecha; el resto, la descripción.
      const idx = [...cells.keys()].reverse().find((ci) => amountOf(cells[ci]) !== null && !dateOf(cells[ci], now));
      if (idx !== undefined) {
        amount = amountOf(cells[idx]);
        desc = desc || cells.filter((c, ci) => ci !== idx && c && !dateOf(c, now)).join(' ');
      } else if (cells.filter(Boolean).length === 1) {
        // Una línea de texto: «Almuerzo 35.000», «+2000 sueldo».
        const line = cells.filter(Boolean)[0];
        const p = parseQuick(line, now);
        if (p.amount) {
          amount = p.kind === 'income' ? p.amount : -p.amount;
          desc = p.title;
          type = p.kind === 'income' ? 'income' : 'expense';
          date = date ?? p.date;
        } else {
          // «Uber 18.500»: el último número de la línea es el monto.
          const words = line.split(' ');
          const wi = [...words.keys()].reverse().find((k) => amountOf(words[k]) !== null && !dateOf(words[k], now) && !timesIn(words[k]).length);
          if (wi !== undefined) {
            amount = amountOf(words[wi]);
            desc = words.filter((_, k) => k !== wi).join(' ');
          }
        }
      }
    }
    if (!date) date = cells.map((c) => dateOf(c, now)).find(Boolean) ?? null;
    if (amount === null || !Number.isFinite(amount)) return;
    desc = clean(desc.replace(/^[\s\-–:|]+|[\s\-–:|]+$/g, ''));
    const tp: 'expense' | 'income' = type ?? (amount < 0 ? 'expense' : looksLikeIncome(desc) ? 'income' : 'expense');
    items.push({
      key: `f${i}`,
      type: tp,
      title: desc || (tp === 'income' ? '+' : '−'),
      date: date ?? keyOf(now),
      start: null,
      end: null,
      days: [],
      repeat: 'none',
      amount: Math.abs(amount),
      category: categoryFor(desc, tp) ?? (tp === 'income' ? 'other_in' : 'other'),
    });
  });
  return items;
}

/** Filas del archivo → lo que se propone añadir, según lo que la persona dijo que contiene. */
export function interpret(rows: string[][], goal: ImportGoal, now = new Date()): ImportItem[] {
  const r = rows.slice(0, 3000);
  if (goal === 'routine') return routine(r, now);
  if (goal === 'finance') return finance(r, now);
  return agendaOrTasks(r, goal, now);
}
