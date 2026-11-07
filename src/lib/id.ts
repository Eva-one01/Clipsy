let counter = 0;

/** ID corto, ordenable y suficientemente único para datos locales. */
export function uid(): string {
  counter = (counter + 1) % 1296;
  return Date.now().toString(36) + counter.toString(36).padStart(2, '0') + Math.random().toString(36).slice(2, 6);
}
