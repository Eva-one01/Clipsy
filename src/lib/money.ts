import { intlLocale } from '@/i18n';

const cache = new Map<string, Intl.NumberFormat>();

function fmt(currency: string, compact: boolean) {
  const loc = intlLocale();
  const key = `${loc}-${currency}-${compact}`;
  let f = cache.get(key);
  if (!f) {
    const noDecimals = ['COP', 'CLP', 'JPY', 'PYG', 'KRW', 'ARS'].includes(currency);
    f = new Intl.NumberFormat(loc, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: compact || noDecimals ? 0 : 2,
      minimumFractionDigits: compact || noDecimals ? 0 : 2,
      ...(compact ? { notation: 'compact' as const } : {}),
    });
    cache.set(key, f);
  }
  return f;
}

export function formatMoney(value: number, currency: string, opts: { compact?: boolean; sign?: boolean } = {}) {
  try {
    const s = fmt(currency, !!opts.compact).format(Math.abs(value));
    if (!opts.sign) return value < 0 ? `−${s}` : s;
    return `${value < 0 ? '−' : '+'}${s}`;
  } catch {
    return `${value < 0 ? '−' : ''}${Math.abs(value).toFixed(2)} ${currency}`;
  }
}

/** Acepta "12.500,50", "12,500.50", "12500" y devuelve número o NaN. */
export function parseAmount(input: string): number {
  const raw = input.replace(/[^\d.,]/g, '');
  if (!raw) return NaN;
  const hasComma = raw.includes(',');
  const hasDot = raw.includes('.');

  if (hasComma && hasDot) {
    const dec = raw.lastIndexOf(',') > raw.lastIndexOf('.') ? ',' : '.';
    const thou = dec === ',' ? '.' : ',';
    return Number(raw.split(thou).join('').replace(dec, '.'));
  }
  if (hasComma || hasDot) {
    const sep = hasComma ? ',' : '.';
    const parts = raw.split(sep);
    // "1.250.000" o "12.500" → miles; "12,5" o "9.99" → decimales
    if (parts.length > 2 || parts[parts.length - 1].length === 3) return Number(parts.join(''));
    return Number(parts.join('.'));
  }
  return Number(raw);
}

export const currencies = [
  { code: 'COP', name: 'Peso colombiano' },
  { code: 'USD', name: 'Dólar estadounidense' },
  { code: 'EUR', name: 'Euro' },
  { code: 'MXN', name: 'Peso mexicano' },
  { code: 'ARS', name: 'Peso argentino' },
  { code: 'CLP', name: 'Peso chileno' },
  { code: 'PEN', name: 'Sol peruano' },
  { code: 'BRL', name: 'Real brasileño' },
  { code: 'GBP', name: 'Libra esterlina' },
  { code: 'CAD', name: 'Dólar canadiense' },
];
