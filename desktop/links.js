// Enlaces clipsy:// que envían las otras apps de Razor (FileNote): añadir una tarea o un recordatorio.
// Todo se valida aquí: un enlace mal formado o con datos raros se ignora.
const MAX_TITLE = 300;
const DAY = 86400000;

function parse(raw) {
  let u;
  try {
    u = new URL(String(raw));
  } catch {
    return null;
  }
  if (u.protocol !== 'clipsy:') return null;
  const action = (u.hostname || u.pathname.replace(/^\/+/, '').split('/')[0] || '').toLowerCase();
  const q = u.searchParams;
  const title = (q.get('title') || '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, MAX_TITLE);
  if (!title) return null;
  const notes = (q.get('notes') || '').slice(0, 2000);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(q.get('date') || '') ? q.get('date') : null;
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(q.get('time') || '') ? q.get('time') : null;
  if (action === 'task') return { kind: 'task', title, due: date, time: date ? time : null, notes };
  if (action === 'reminder') {
    const at = Number(q.get('at'));
    if (!Number.isFinite(at) || at < Date.now() - DAY || at > Date.now() + 5 * 365 * DAY) return null;
    return { kind: 'reminder', title, at: Math.round(at) };
  }
  return null;
}

const isLink = (s) => typeof s === 'string' && s.toLowerCase().startsWith('clipsy://');

module.exports = { parse, isLink };
