/**
 * Alta rápida en lenguaje natural, en los 6 idiomas de la app a la vez (escrito o dictado por voz):
 *   «Reunión con Ana mañana a las 10»      → evento mañana 10:00–11:00
 *   «Llamar al banco el viernes !!»         → tarea para el viernes, prioridad alta
 *   «Recuérdame pagar el arriendo el 30/11» → recordatorio el 30/11 a las 9:00
 *   «Recuérdame llamar a Juan en 20 minutos»→ recordatorio dentro de 20 minutos
 *   «Pon una alarma a las 6 y media»        → alarma 06:30
 *   «Netflix $15» · «gasté 35 mil en almuerzo» → gasto (con su categoría: suscripciones, comida…)
 *   «+2000 salario»                         → ingreso
 *   «idea: app de recetas»                  → idea
 * Una hora sin «am/pm» entre la 1 y las 6 se entiende de la tarde («dentista a las 4» → 16:00), salvo en alarmas.
 * Sin dependencias de Intl ni de regex Unicode (Hermes y web se comportan igual).
 */
import type { DateKey, Priority, TimeHM } from '@/store/types';

export type QuickKind = 'task' | 'event' | 'reminder' | 'alarm' | 'expense' | 'income' | 'idea';

export interface QuickParsed {
  kind: QuickKind;
  title: string;
  date: DateKey | null;
  time: TimeHM | null;
  end: TimeHM | null;
  priority: Priority;
  amount: number | null;
  /** Categoría de gasto o ingreso deducida del texto («almuerzo» → food); null si no se reconoce. */
  category: string | null;
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

const REMIND = 'recuérdame|recuerdame|recordarme|recordar|avísame|avisame|remind me(?: to)?|remind|lembre-me de|lembre-me|me lembre de|me lembre|lembrar de|lembrar|rappelle-moi de|rappelle-moi|rappeler|напомни мне|напомни|erinnere mich an|erinnere mich|erinnern';
const ALARM =
  'pon(?:me)? una alarma(?: para)?|pon(?:me)? la alarma(?: para)?|alarma(?: para)?|despiértame|despiertame|set an alarm(?: for)?|alarm(?: for)?|wake me up|wake me|alarme(?: para| pour)?|despertador|me acorde|me acorda|réveille-moi|reveille-moi|réveil|reveil|stell(?:e)? (?:einen |den )?wecker(?: auf| für)?|wecker(?: auf| für)?|weck(?:e)? mich|поставь будильник(?: на)?|будильник(?: на)?|разбуди меня|разбуди';
const EVENT = 'reunión|reunion|cita|llamada|meeting|call|appointment|reunião|reuniao|consulta|réunion|rendez-vous|rdv|встреча|созвон|termin|besprechung|meeting';
const EXPENSE = 'gasté|gaste|pagué|pague|gasto|i spent|spent|i paid|paid|i bought|expense|gastei|paguei|despesa|dépensé|depense|payé|paye|dépense|потратил|потратила|заплатил|заплатила|расход|ausgegeben|bezahlt|ausgabe';
const INCOME = 'me pagaron|me depositaron|cobré|cobre|recibí|recibi|ingreso|i earned|earned|i received|received|income|i got paid|got paid|me pagaram|on m[\'’]a payé|recebi|ganhei|receita|reçu|recu|gagné|gagne|revenu|получил|получила|доход|erhalten|bekommen|verdient|einnahme';
const IDEA = /^\s*(idea|ideia|idée|idee|идея)\s*[:：-]\s*/i;

// Franja del día: «a las 3 de la tarde», «7 in the evening», «в 9 вечера», «mañana por la mañana».
const AM_Q = 'de la mañana|de la manana|por la mañana|por la manana|en la mañana|de la madrugada|in the morning|this morning|da manhã|da manha|de manhã|de manha|pela manhã|du matin|ce matin|am morgen|morgens|vormittags|утра|утром';
const PM_Q = 'de la tarde|por la tarde|en la tarde|in the afternoon|this afternoon|da tarde|à tarde|de tarde|pela tarde|de l[\'’]après-midi|cet après-midi|am nachmittag|nachmittags|днём|днем';
const EVE_Q = 'de la noche|por la noche|en la noche|esta noche|in the evening|this evening|tonight|at night|da noite|à noite|de noite|du soir|ce soir|am abend|heute abend|abends|вечера|вечером|ночи';
// Comidas de la noche: «cena con Laura a las 8» es a las 20:00.
const EVENING_MEAL = 'cena|cenar|dinner|jantar|dîner|diner|abendessen|ужин';

// Números dichos con palabras (lo habitual al dictar): solo se convierten junto a una unidad o una hora.
const NUM_WORDS: Record<string, number> = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, quince: 15, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50,
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  um: 1, uma: 1, dois: 2, duas: 2, três: 3, quatro: 4, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, quinze: 15, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50,
  une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, sept: 7, huit: 8, neuf: 9, dix: 10, douze: 12, vingt: 20, trente: 30, quarante: 40, cinquante: 50,
  ein: 1, eine: 1, einer: 1, eins: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12, fünfzehn: 15, zwanzig: 20, dreißig: 30, vierzig: 40, fünfzig: 50,
  один: 1, одну: 1, одна: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9, десять: 10, одиннадцать: 11, двенадцать: 12, пятнадцать: 15, двадцать: 20, тридцать: 30, сорок: 40, пятьдесят: 50,
};
const NUMW = Object.keys(NUM_WORDS)
  .sort((a, b) => b.length - a.length)
  .join('|');
// Tras «a las / at / um…» los artículos no son números («at a meeting»), salvo «a la una».
const ARTICLES = ['a', 'an', 'un', 'uno', 'um', 'une', 'ein', 'eine', 'einer'];
const NUMW_HOUR = NUMW.split('|')
  .filter((w) => !ARTICLES.includes(w))
  .join('|');
const SEC = 'segundos?|seconds?|secs?|secondes?|sekunden?|секунд[уы]?';
const MIN = 'minutos?|minutes?|mins?|minuten|минут[уы]?|мин';
const HOUR = 'horas?|hours?|hrs?|heures?|stunden?|час(?:а|ов)?';
const DAY = 'días|dias|día|dia|days?|jours?|tagen?|tag|дн(?:я|ей)|день';

// Categorías de gasto e ingreso (las mismas claves que src/constants/finance.ts), por orden de prioridad.
const EXPENSE_CATS: [string, string][] = [
  ['subscriptions', 'netflix|spotify|disney|hbo|prime video|youtube premium|suscripción|suscripcion|subscription|assinatura|abonnement|abo|подписк[аи]'],
  ['bills', 'luz|agua|internet|celular|teléfono|telefono|servicios|electricity|phone bill|bills?|utilities|conta de luz|électricité|electricite|strom|handy|коммуналк[аи]|телефон'],
  ['home', 'arriendo|alquiler|renta|rent|aluguel|loyer|miete|аренд[аы]|hogar|home|casa|maison|wohnung'],
  ['health', 'farmacia|médico|medico|doctor|dentista|medicina|medicamentos?|pharmacy|medicine|farmácia|pharmacie|médecin|apotheke|arzt|аптек[аи]|врач|лекарств[ао]'],
  ['education', 'curso|libros?|universidad|colegio|matrícula|matricula|course|books?|tuition|school|livros?|faculdade|cours|livres?|kurs|bücher|buch|schule|курс|книг[аи]?'],
  ['transport', 'taxi|uber|didi|cabify|bus|buseta|gasolina|transporte|metro|peaje|parqueadero|parking|fuel|train|tren|ônibus|onibus|combustível|combustivel|essence|bahn|tanken|benzin|такси|бензин|метро|автобус|проезд'],
  ['leisure', 'cine|concierto|bar|fiesta|juego|movie|cinema|concert|party|game|festa|jogo|kino|konzert|spiel|кино|концерт|игр[аы]'],
  ['shopping', 'ropa|zapatos|tienda|amazon|compras|clothes|shoes|shopping|roupa|sapatos|vêtements|vetements|chaussures|kleidung|schuhe|одежд[аы]|обувь'],
  ['food', 'almuerzo|comida|cena|desayuno|restaurante|café|cafe|mercado|supermercado|lunch|dinner|breakfast|food|groceries|coffee|pizza|almoço|almoco|jantar|lanche|déjeuner|dejeuner|dîner|diner|repas|courses|restaurant|boulangerie|essen|mittagessen|abendessen|frühstück|kaffee|lebensmittel|еда|еду|обед|ужин|завтрак|кофе|продукты|ресторан'],
];
const INCOME_CATS: [string, string][] = [
  ['salary', 'salario|sueldo|nómina|nomina|quincena|salary|paycheck|salário|salaire|gehalt|lohn|зарплат[аы]'],
  ['freelance', 'freelance|cliente|proyecto|client|project|projeto|projet|kunde|projekt|клиент|проект'],
  ['investments', 'dividendos|intereses|inversión|inversion|dividends|interest|investment|juros|dividendes|zinsen|дивиденды|проценты'],
  ['gift', 'regalo|gift|presente|cadeau|geschenk|подарок'],
];

/** Categoría de un gasto o ingreso a partir de su descripción («almuerzo» → food), o null. Lo usa la importación. */
export function categoryFor(text: string, type: 'expense' | 'income'): string | null {
  for (const [key, alts] of type === 'income' ? INCOME_CATS : EXPENSE_CATS) if (word(alts).test(text)) return key;
  return null;
}

/** ¿Habla de un ingreso? («sueldo», «me pagaron», «salary»…). Lo usa la importación. */
export function looksLikeIncome(text: string): boolean {
  return INCOME_CATS.some(([, alts]) => word(alts).test(text)) || word('ingreso|income|entrada|abono|crédito|credito|recibido|received|recebido|reçu|recu|einnahme|доход').test(text);
}

/** Nombres completos de los días en los 6 idiomas (0 = domingo). */
export const WEEKDAY_NAMES: readonly [number, string][] = WEEKDAYS;

function strip(s: string, re: RegExp) {
  return s.replace(re, (_m, pre: string) => pre ?? ' ');
}

function toHM(h: number, m: number, ampm?: string): TimeHM | null {
  const a = ampm?.toLowerCase().replace(/[.\s]/g, '');
  if (a === 'pm' && h < 12) h += 12;
  if (a === 'am' && h === 12) h = 0;
  if (h > 23 || m > 59) return null;
  return `${pad(h)}:${pad(m)}`;
}

/** «35.000» · «35,000» · «12,50» · «1 500» → número. */
function amountOf(raw: string): number {
  const g = raw.match(/^(\d{1,3}(?:[.,\s]\d{3})+)(?:[.,](\d{1,2}))?$/);
  if (g) return Number(g[1].replace(/[.,\s]/g, '') + (g[2] ? `.${g[2]}` : ''));
  return Number(raw.replace(',', '.'));
}

/** Lo dictado llega con puntuación y números en palabras: «En veinte minutos.» → «en 20 minutos». */
function normalizeSpoken(input: string): string {
  let s = input.replace(/^[\s¿¡]+/, '').replace(/([^\s!])[.?…。]+\s*$/, '$1');
  const n = (w: string) => String(NUM_WORDS[w.toLowerCase()] ?? w);
  // «veinte minutos», «two hours», «через двадцать минут»
  s = s.replace(new RegExp(`(^|[^${L}])(${NUMW})(\\s+(?:${SEC}|${MIN}|${HOUR}|${DAY})(?=[^${L}]|$))`, 'gi'), (_m, pre: string, w: string, rest: string) => pre + n(w) + rest);
  // «a las seis», «at seven», «um sieben», «в семь»
  s = s.replace(new RegExp(`(^|[^${L}])((?:a las|a la|para las|at|às|as|à|um|в|halb)\\s+)(${NUMW_HOUR})(?=[^${L}]|$)`, 'gi'), (_m, pre: string, prep: string, w: string) => pre + prep + n(w));
  // «6 y media», «6 e meia», «6 et demie» → 6:30; «y cuarto» → :15; «7 menos cuarto» → 6:45
  s = s.replace(/(\d{1,2})\s+(?:y|e|et)\s+(media|meia|demie)(?=[^A-Za-zÀ-ÿ]|$)/gi, '$1:30');
  s = s.replace(/(\d{1,2})\s+(?:y|e|et)\s+(cuarto|quart|quinze)(?=[^A-Za-zÀ-ÿ]|$)/gi, '$1:15');
  s = s.replace(/(\d{1,2})\s+(?:menos cuarto|moins le quart)(?=[^A-Za-zÀ-ÿ]|$)/gi, (_m, h: string) => `${(Number(h) + 23) % 24}:45`);
  // «half past 6» → 6:30, «quarter to 7» → 6:45; de «halb 7» → 6:30
  s = s.replace(/(half|quarter)\s+past\s+(\d{1,2})/gi, (_m, q: string, h: string) => `${h}:${q.toLowerCase() === 'half' ? '30' : '15'}`);
  s = s.replace(/quarter\s+to\s+(\d{1,2})/gi, (_m, h: string) => `${(Number(h) + 23) % 24}:45`);
  s = s.replace(/(^|\s)(um\s+)?halb\s+(\d{1,2})(?=\s|$)/gi, (_m, pre: string, um: string | undefined, h: string) => `${pre}${um ?? ''}${(Number(h) + 23) % 24}:30`);
  // «4:00 p. m.» → «4:00 pm»
  s = s.replace(/(\d)\s*([ap])\.\s?m\.?(?=\s|$)/gi, (_m, d: string, ap: string) => `${d} ${ap.toLowerCase()}m`);
  return s;
}

export function parseQuick(input: string, now = new Date()): QuickParsed {
  let s = ` ${normalizeSpoken(input.trim())} `;
  const out: QuickParsed = { kind: 'task', title: '', date: null, time: null, end: null, priority: 0, amount: null, category: null };

  // Idea
  if (IDEA.test(s)) {
    return { ...out, kind: 'idea', title: s.replace(IDEA, '').trim() };
  }

  // Prioridad: «!» media, «!!» o «!!!» alta.
  s = s.replace(/(\s)(!{1,3})(?=\s)/, (_m, pre: string, bangs: string) => {
    out.priority = bangs.length >= 2 ? 2 : 1;
    return pre;
  });

  // Alarma y recordatorio
  const alarm = word(ALARM);
  const rem = word(REMIND);
  if (alarm.test(s)) {
    out.kind = 'alarm';
    s = strip(s, alarm);
  } else if (rem.test(s)) {
    out.kind = 'reminder';
    s = strip(s, rem);
  }

  // Dentro de un rato: «en 20 minutos», «in 2 hours», «через полчаса», «dans une demi-heure».
  let relative = false;
  const half = /(^|\s)(?:(?:en|dentro de|em|daqui a)\s+(?:media|meia)\s+hora|in\s+half\s+an?\s+hour|dans\s+une\s+demi-?\s?heure|in\s+einer\s+halben\s+stunde|через\s+полчаса)(?=\s|$)/i;
  const rel = new RegExp(`(^|\\s)(?:en|dentro de|in|em|daqui a|dans|через)\\s+(\\d{1,3})\\s*(${SEC}|${MIN}|${HOUR})(?=\\s|$)`, 'i');
  let relMs = 0;
  const hm = s.match(half);
  if (hm) {
    relMs = 30 * 60000;
    s = s.replace(half, (_x, pre: string) => pre);
  } else {
    const rm = s.match(rel);
    if (rm) {
      const n = Number(rm[2]);
      const unit = rm[3].toLowerCase();
      relMs = n * (new RegExp(`^(?:${SEC})$`, 'i').test(unit) ? 1000 : new RegExp(`^(?:${MIN})$`, 'i').test(unit) ? 60000 : 3600000);
      s = s.replace(rel, (_x, pre: string) => pre);
    }
  }
  if (relMs) {
    const at = new Date(now.getTime() + relMs);
    out.date = keyOf(at);
    out.time = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
    relative = true;
    if (out.kind === 'task') out.kind = 'reminder';
  }

  // Dinero: «$15», «15€», «+2000», «35 mil pesos», «$35.000», o una cifra con palabra de gasto/ingreso.
  const NUM = '\\d{1,3}(?:[.,\\s]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?';
  const MULT = 'mil|k|thousand|grand|mille|tausend|тыс(?:яч[аи]?)?|millones|millón|millon|millions?|millionen|milhões|milhoes|milhão|milhao|миллион(?:а|ов)?|млн';
  const CUR =
    'pesos?|dólares?|dolares?|dollars?|bucks|euros?|reais|real|rubles?|рубл(?:ей|я|ь)|руб|usd|eur|cop|mxn|ars|clp|pen|brl|rub|gbp';
  const money = new RegExp(`(^|\\s)([+-]?)\\s?([$€£₽]|r\\$)?\\s?(${NUM})(?:\\s?(${MULT}))?(?:\\s?([$€£₽])|\\s(?:de\\s+)?(${CUR}))?(?=[\\s,.]|$)`, 'i');
  const isExp = word(EXPENSE);
  const isInc = word(INCOME);
  if (out.kind === 'task') {
    const m = s.match(money);
    const hasSymbol = m && (m[3] || m[6] || m[7] || m[2] === '+');
    const kwExp = isExp.test(s);
    const kwInc = isInc.test(s);
    if (m && (hasSymbol || kwExp || kwInc)) {
      let amount = amountOf(m[4]);
      if (m[5]) amount *= /^(?:mil|k|thousand|grand|mille|tausend|тыс)/i.test(m[5]) ? 1000 : 1000000;
      out.amount = amount;
      out.kind = m[2] === '+' || (kwInc && !kwExp) ? 'income' : 'expense';
      s = s.replace(money, (_x, pre: string) => pre);
      s = strip(strip(s, isExp), isInc);
      // «en café», «on coffee», «für Kaffee»…
      s = s.replace(/^\s*(?:en|on|for|em|com|pour|en|на|за|für|fuer)\s+/i, ' ');
      for (const [key, alts] of out.kind === 'income' ? INCOME_CATS : EXPENSE_CATS) {
        if (word(alts).test(s)) {
          out.category = key;
          break;
        }
      }
    }
  }

  // Franja del día (antes que las fechas: «de la mañana» no es «mañana»).
  let q: 'am' | 'pm' | 'eve' | null = null;
  for (const [k, alts] of [['am', AM_Q], ['pm', PM_Q], ['eve', EVE_Q]] as const) {
    const re = word(alts);
    if (!q && re.test(s)) {
      q = k;
      s = strip(s, re);
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
  let explicit = relative; // la hora ya es exacta (con am/pm, 24 h o relativa)
  if (!relative) {
    const T = '(\\d{1,2})(?:[:h](\\d{2}))?\\s*(am|pm|a\\.m\\.|p\\.m\\.)?';
    const range = new RegExp(`(^|\\s)(?:de\\s+|from\\s+|von\\s+|с\\s+)?${T}\\s*(?:-|–|a|to|até|ate|à|bis|до)\\s*${T}\\s*(?:uhr|h)?(?=\\s|$)`, 'i');
    const single = new RegExp(
      `(^|\\s)(?:(?:a\\s+las|a\\s+la|para\\s+las|at|às|à|um|в)\\s+${T}\\s*(?:uhr|h|horas|hrs|heures?|o'clock|часа|часов|час)?|(\\d{1,2})[:h](\\d{2})\\s*(am|pm|a\\.m\\.|p\\.m\\.)?|(\\d{1,2})\\s*(am|pm|a\\.m\\.|p\\.m\\.|uhr|h))(?=\\s|$)`,
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
        explicit = true;
        s = s.replace(range, (_x, pre: string) => pre);
      }
    }
    if (!out.time) {
      const m = s.match(single);
      if (m) {
        let t: TimeHM | null = null;
        if (m[2]) {
          t = toHM(Number(m[2]), Number(m[3] ?? 0), m[4]);
          explicit = !!m[4] || Number(m[2]) > 12 || /^0\d/.test(m[2]);
        } else if (m[5]) {
          t = toHM(Number(m[5]), Number(m[6]), m[7]);
          explicit = !!m[7] || Number(m[5]) > 12 || /^0\d/.test(m[5]);
        } else if (m[8]) {
          const suf = m[9].toLowerCase();
          const ap = suf === 'am' || suf === 'pm' || suf.includes('.') ? suf : undefined;
          t = toHM(Number(m[8]), 0, ap);
          explicit = !!ap || Number(m[8]) > 12;
        }
        if (t) {
          out.time = t;
          s = s.replace(single, (_x, pre: string) => pre);
        }
      }
    }
  }
  if (!out.time && q && (out.kind === 'reminder' || out.kind === 'event' || word(EVENT).test(s))) {
    // «mañana por la tarde» sin hora: una hora típica de esa franja.
    out.time = q === 'am' ? '09:00' : q === 'pm' ? '15:00' : '20:00';
    explicit = true;
  }
  if (out.time && !explicit) {
    // «a las 3 de la tarde» / «a las 4» (de la tarde, salvo alarmas) / «cena a las 8» (de la noche)
    let h = Number(out.time.slice(0, 2));
    const mm = out.time.slice(3);
    if (q === 'am') h = h === 12 ? 0 : h;
    else if (q === 'pm' || q === 'eve') h = h < 12 && (q === 'pm' || h >= 5) ? h + 12 : h === 12 && q === 'eve' ? 0 : h;
    else if (out.kind !== 'alarm' && h >= 1 && h <= 6) h += 12;
    else if (out.kind !== 'alarm' && h >= 7 && h <= 11 && word(EVENING_MEAL).test(s)) h += 12;
    out.time = `${pad(h)}:${mm}`;
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
    .replace(/^\s*(?:de|que|to|que|à|de|zu|an|para|daran|что|о|про)\s+/i, '')
    .replace(/\s+(?:a\s+las|a|at|el|la|on|um|в|à|às|no|na|para)\s*$/i, '')
    .trim()
    .replace(/^[,.;:\-–]+|[,.;:\-–]+$/g, '')
    .trim();
  if (out.title) out.title = out.title[0].toUpperCase() + out.title.slice(1);
  return out;
}
