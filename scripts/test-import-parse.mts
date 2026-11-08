// Pruebas de la importación: npm run test:import
// Fecha fija: viernes 6 de noviembre de 2026.
import { amountOf, dateOf, daysIn, interpret, timesIn, weekdayOf, type ImportItem } from '../src/lib/importParse.ts';

const now = new Date(2026, 10, 6, 10, 0);
let fails = 0;
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) {
    fails++;
    console.log(`✗ ${name}\n    got  ${g}\n    want ${w}`);
  } else console.log(`✓ ${name}`);
}
const pick = (items: ImportItem[], keys: (keyof ImportItem)[]) => items.map((i) => Object.fromEntries(keys.map((k) => [k, i[k]])));

// Piezas
eq('weekdayOf Miércoles', weekdayOf('Miércoles'), 3);
eq('weekdayOf LUN.', weekdayOf('LUN.'), 1);
eq('weekdayOf Gimnasio', weekdayOf('Gimnasio'), null);
eq('daysIn lunes a viernes', daysIn('Lunes a viernes 8:00 Trabajo'), [1, 2, 3, 4, 5]);
eq('daysIn L-V', daysIn('L-V 7:00 Gym'), [1, 2, 3, 4, 5]);
eq('daysIn lista', daysIn('lunes, miércoles y viernes 18:00 Inglés'), [1, 3, 5]);
eq('daysIn todos los días', daysIn('Todos los días 7:00 Desayuno'), [0, 1, 2, 3, 4, 5, 6]);
eq('daysIn mon-fri', daysIn('Mon-Fri 9am standup'), [1, 2, 3, 4, 5]);
eq('timesIn rango', timesIn('7:00 - 8:00'), ['07:00', '08:00']);
eq('timesIn foto 1 3:00', timesIn('1 3:00 14:00'), ['13:00', '14:00']);
eq('timesIn pm', timesIn('5 pm a 6:30 pm'), ['17:00', '18:30']);
eq('timesIn número suelto', timesIn('Calle 45'), []);
eq('dateOf ISO', dateOf('2026-11-15', now), '2026-11-15');
eq('dateOf dd/mm/yyyy', dateOf('15/11/2026', now), '2026-11-15');
eq('dateOf EE. UU.', dateOf('11/25/2026', now), '2026-11-25');
eq('dateOf hora no', dateOf('7:00', now), null);
eq('amountOf $35.000', amountOf('$35.000'), 35000);
eq('amountOf 1.234,56', amountOf('1.234,56'), 1234.56);
eq('amountOf 1,234.56', amountOf('1,234.56'), 1234.56);
eq('amountOf -120000', amountOf('-120000'), -120000);
eq('amountOf (50)', amountOf('(50)'), -50);
eq('amountOf COP 20 000', amountOf('COP 20 000'), 20000);
eq('amountOf texto', amountOf('Calle 45'), null);

// Rutina: tabla con los días en columnas (como la de la foto de prueba)
const photo = [
  ['Hora', '', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
  ['7:00', '8:00', 'Gimnasio', '', 'Gimnasio', '', 'Gimnasio'],
  ['9:00', '10:30', 'Inglés', 'Matemáticas', 'Inglés', 'Matemáticas', 'Inglés'],
  ['1 3:00', '14:00', 'Almuerzo', 'Almuerzo', 'Almuerzo', 'Almuerzo', 'Almuerzo'],
  ['18:30', '19:30', '', 'Yoga', '', 'Yoga', ''],
];
eq('rutina (foto)', pick(interpret(photo, 'routine', now), ['title', 'start', 'end', 'days', 'repeat', 'date']), [
  { title: 'Gimnasio', start: '07:00', end: '08:00', days: [1, 3, 5], repeat: 'weekly', date: '2026-11-06' },
  { title: 'Inglés', start: '09:00', end: '10:30', days: [1, 3, 5], repeat: 'weekly', date: '2026-11-06' },
  { title: 'Matemáticas', start: '09:00', end: '10:30', days: [2, 4], repeat: 'weekly', date: '2026-11-10' },
  { title: 'Almuerzo', start: '13:00', end: '14:00', days: [1, 2, 3, 4, 5], repeat: 'weekdays', date: '2026-11-06' },
  { title: 'Yoga', start: '18:30', end: '19:30', days: [2, 4], repeat: 'weekly', date: '2026-11-10' },
]);

// Rutina: Word con líneas y tabla
const docx = [
  ['Mi rutina'],
  ['Lunes a viernes 8:00 Trabajo'],
  ['Sábado', '10:00', 'Mercado'],
  ['Hora', 'Lunes', 'Martes', 'Miércoles'],
  ['6:30', 'Correr', '', 'Correr'],
  ['20:00 - 21:00', 'Leer', 'Leer', 'Leer'],
  [],
  ['Todos los días 7:00 Desayuno'],
];
eq('rutina (Word)', pick(interpret(docx, 'routine', now), ['title', 'start', 'end', 'days', 'repeat']), [
  { title: 'Correr', start: '06:30', end: '07:30', days: [1, 3], repeat: 'weekly' },
  { title: 'Desayuno', start: '07:00', end: '08:00', days: [1, 2, 3, 4, 5, 6, 0], repeat: 'daily' },
  { title: 'Trabajo', start: '08:00', end: '09:00', days: [1, 2, 3, 4, 5], repeat: 'weekdays' },
  { title: 'Mercado', start: '10:00', end: '11:00', days: [6], repeat: 'weekly' },
  { title: 'Leer', start: '20:00', end: '21:00', days: [1, 2, 3], repeat: 'weekly' },
]);

// Finanzas: Excel con encabezado
const xlsx = [
  ['Fecha', 'Descripción', 'Monto'],
  ['2026-10-30', 'Almuerzo & café', '35000'],
  ['2026-10-31', 'Mercado semanal', '-120000'],
  ['2026-11-01', 'Sueldo noviembre', '2500000'],
];
eq('finanzas (Excel)', pick(interpret(xlsx, 'finance', now), ['type', 'title', 'amount', 'date', 'category']), [
  { type: 'expense', title: 'Almuerzo & café', amount: 35000, date: '2026-10-30', category: 'food' },
  { type: 'expense', title: 'Mercado semanal', amount: 120000, date: '2026-10-31', category: 'food' },
  { type: 'income', title: 'Sueldo noviembre', amount: 2500000, date: '2026-11-01', category: 'salary' },
]);

// Finanzas: columnas de ingreso y gasto (extracto)
const bank = [
  ['Fecha', 'Concepto', 'Cargo', 'Abono'],
  ['03/11/2026', 'Netflix', '$45.900', ''],
  ['05/11/2026', 'Transferencia cliente', '', '$800.000'],
];
eq('finanzas (extracto)', pick(interpret(bank, 'finance', now), ['type', 'title', 'amount', 'date', 'category']), [
  { type: 'expense', title: 'Netflix', amount: 45900, date: '2026-11-03', category: 'subscriptions' },
  { type: 'income', title: 'Transferencia cliente', amount: 800000, date: '2026-11-05', category: 'freelance' },
]);

// Finanzas: texto suelto
eq('finanzas (texto)', pick(interpret([['Uber 18.500'], ['+2000 salario']], 'finance', now), ['type', 'title', 'amount', 'category']), [
  { type: 'expense', title: 'Uber', amount: 18500, category: 'transport' },
  { type: 'income', title: 'Salario', amount: 2000, category: 'salary' },
]);

// Tareas: CSV
const csv = [
  ['Tarea', 'Fecha'],
  ['Pagar luz', '15/11/2026'],
  ['Llamar a Ana; urgente', ''],
  ['- Comprar regalo de mamá', '20/11/2026'],
];
eq('tareas (CSV)', pick(interpret(csv, 'tasks', now), ['title', 'date']), [
  { title: 'Pagar luz', date: '2026-11-15' },
  { title: 'Llamar a Ana; urgente', date: null },
  { title: 'Comprar regalo de mamá', date: '2026-11-20' },
]);

// Agenda
const agenda = [
  ['Fecha', 'Hora', 'Evento'],
  ['15/11/2026', '10:00', 'Dentista'],
  ['20/11/2026', '18:00 - 20:00', 'Cumpleaños de Laura'],
  ['', '', 'Sin fecha'],
];
eq('agenda', pick(interpret(agenda, 'agenda', now), ['title', 'date', 'start', 'end']), [
  { title: 'Dentista', date: '2026-11-15', start: '10:00', end: '11:00' },
  { title: 'Cumpleaños de Laura', date: '2026-11-20', start: '18:00', end: '20:00' },
]);

console.log(fails ? `\n${fails} con fallos` : '\nTodo bien');
process.exit(fails ? 1 : 0);
