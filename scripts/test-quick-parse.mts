// Pruebas del alta rápida (escrita y dictada): node scripts/test-quick-parse.mts
// Fecha fija: viernes 6 de noviembre de 2026, 10:00 (hora local).
import { parseQuick, type QuickParsed } from '../src/lib/quickParse.ts';

const now = new Date(2026, 10, 6, 10, 0);
type Want = Partial<QuickParsed>;
const cases: [string, Want][] = [
  // Lo que ya entendía (no debe cambiar)
  ['Reunión con Ana mañana a las 10', { kind: 'event', title: 'Reunión con Ana', date: '2026-11-07', time: '10:00', end: '11:00' }],
  ['Llamar al banco el viernes !!', { kind: 'task', title: 'Llamar al banco', date: '2026-11-13', priority: 2 }],
  ['Recuérdame pagar el arriendo el 30/11', { kind: 'reminder', title: 'Pagar el arriendo', date: '2026-11-30', time: '09:00' }],
  ['Netflix $15', { kind: 'expense', title: 'Netflix', amount: 15, category: 'subscriptions' }],
  ['gasté 20 en café', { kind: 'expense', title: 'Café', amount: 20, category: 'food' }],
  ['+2000 salario', { kind: 'income', title: 'Salario', amount: 2000, category: 'salary' }],
  ['idea: app de recetas', { kind: 'idea', title: 'app de recetas' }],
  ['Reunión 10:30-12', { kind: 'event', time: '10:30', end: '12:00' }],
  ['at 5pm call mom', { kind: 'event', title: 'Call mom', time: '17:00' }],
  ['um 17 Uhr Training', { kind: 'event', title: 'Training', time: '17:00' }],
  ['в 17:00 встреча', { kind: 'event', title: 'Встреча', time: '17:00' }],
  ['17h30 rdv médecin', { kind: 'event', title: 'Rdv médecin', time: '17:30' }],
  ['comprar leche', { kind: 'task', title: 'Comprar leche', date: null }],
  ['pagar luz el 15/11 !', { kind: 'task', title: 'Pagar luz', date: '2026-11-15', priority: 1 }],
  ['Remind me to call mom tomorrow', { kind: 'reminder', title: 'Call mom', date: '2026-11-07', time: '09:00' }],
  ['Gym 7am', { kind: 'event', title: 'Gym', date: '2026-11-07', time: '07:00' }],
  ['en 3 días entregar informe', { kind: 'task', title: 'Entregar informe', date: '2026-11-09' }],
  // Hora sin am/pm entre la 1 y las 6: de la tarde
  ['dentista el viernes a las 4', { kind: 'event', title: 'Dentista', date: '2026-11-13', time: '16:00' }],
  // Dictado (con puntuación y números en palabras)
  ['Recuérdame llamar a Juan en 20 minutos.', { kind: 'reminder', title: 'Llamar a Juan', date: '2026-11-06', time: '10:20' }],
  ['Recuérdame llamar a Juan en veinte minutos', { kind: 'reminder', title: 'Llamar a Juan', time: '10:20' }],
  ['Recuérdame tomar agua en media hora.', { kind: 'reminder', title: 'Tomar agua', time: '10:30' }],
  ['Remind me in 2 hours to stretch', { kind: 'reminder', title: 'Stretch', time: '12:00' }],
  ['Напомни позвонить маме через 20 минут', { kind: 'reminder', title: 'Позвонить маме', time: '10:20' }],
  ["Rappelle-moi d'appeler Paul dans 10 minutes", { kind: 'reminder', time: '10:10' }],
  ['Erinnere mich in 20 Minuten an den Anruf', { kind: 'reminder', title: 'Den Anruf', time: '10:20' }],
  ['Me lembre de ligar para o Pedro em 15 minutos', { kind: 'reminder', title: 'Ligar para o Pedro', time: '10:15' }],
  ['Agenda reunión con el equipo el jueves a las diez.', { kind: 'event', title: 'Agenda reunión con el equipo', date: '2026-11-12', time: '10:00' }],
  ['Recuérdame pagar el arriendo mañana a las 3 de la tarde', { kind: 'reminder', title: 'Pagar el arriendo', date: '2026-11-07', time: '15:00' }],
  ['Reunión mañana a las 9 de la mañana', { kind: 'event', title: 'Reunión', date: '2026-11-07', time: '09:00' }],
  ['Cena con Laura el viernes a las 8', { kind: 'event', title: 'Cena con Laura', date: '2026-11-13', time: '20:00' }],
  ['Recuérdame ir al banco a las 3:00 p. m.', { kind: 'reminder', title: 'Ir al banco', time: '15:00' }],
  ['Встреча с командой завтра в 10', { kind: 'event', title: 'Встреча с командой', date: '2026-11-07', time: '10:00' }],
  // Alarmas
  ['Pon una alarma a las 6 y media', { kind: 'alarm', title: '', time: '06:30' }],
  ['Despiértame a las siete', { kind: 'alarm', time: '07:00' }],
  ['Set an alarm for 6:45', { kind: 'alarm', time: '06:45' }],
  ['Weck mich um halb sieben', { kind: 'alarm', time: '06:30' }],
  ['Разбуди меня в 7 утра', { kind: 'alarm', time: '07:00' }],
  // Dinero dictado: miles, monedas y categorías
  ['Gasté 35 mil en almuerzo', { kind: 'expense', title: 'Almuerzo', amount: 35000, category: 'food' }],
  ['Gasté $35.000 en taxi.', { kind: 'expense', title: 'Taxi', amount: 35000, category: 'transport' }],
  ['gasté 12.500 pesos en la farmacia', { kind: 'expense', amount: 12500, category: 'health' }],
  ['I spent $20 on lunch', { kind: 'expense', title: 'Lunch', amount: 20, category: 'food' }],
  ['Gastei 50 reais no mercado', { kind: 'expense', amount: 50, category: 'food' }],
  ["J'ai dépensé 30 euros au restaurant", { kind: 'expense', amount: 30, category: 'food' }],
  ['Потратил 500 рублей на такси', { kind: 'expense', amount: 500, category: 'transport' }],
  ['Me pagaron el sueldo, 2.500.000 pesos', { kind: 'income', amount: 2500000, category: 'salary' }],
  ['pagué el arriendo 1.200.000', { kind: 'expense', amount: 1200000, category: 'home' }],
];

let fail = 0;
for (const [text, want] of cases) {
  const got = parseQuick(text, now);
  const bad = (Object.keys(want) as (keyof QuickParsed)[]).filter((k) => got[k] !== want[k]);
  if (bad.length) {
    fail++;
    console.log(`✗ ${text}`);
    for (const k of bad) console.log(`    ${k}: esperado ${JSON.stringify(want[k])}, obtenido ${JSON.stringify(got[k])}`);
  }
}
console.log(`${cases.length - fail}/${cases.length} frases bien`);
process.exit(fail ? 1 : 0);
