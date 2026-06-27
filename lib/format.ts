/**
 * Centralized formatting utilities for NodoCRM using es-MX locale.
 */

/** Thousands-separated number: 1,234,567.89 */
export function fmtNum(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined || isNaN(Number(n))) return '—';
  return Number(n).toLocaleString('es-MX', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Currency: $1,234,567.00 or USD 1,234,567.00 */
export function fmtCurrency(n: number | null | undefined, currency: string = 'MXN'): string {
  if (n === null || n === undefined || isNaN(Number(n))) return '—';
  const val = Number(n);
  try {
    return val.toLocaleString('es-MX', {
      style: 'currency',
      currency: currency || 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  } catch {
    // Fallback if currency code is not supported
    return `$${val.toLocaleString('es-MX', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })} ${currency}`;
  }
}

/** Compact currency: $1.2M, $340k, or normal if small */
export function fmtCurrencyCompact(n: number | null | undefined, currency: string = 'MXN'): string {
  if (n === null || n === undefined || isNaN(Number(n))) return '—';
  const val = Number(n);
  const symbol = currency === 'USD' ? 'USD ' : '$';
  if (Math.abs(val) >= 1_000_000) {
    return `${symbol}${(val / 1_000_000).toLocaleString('es-MX', { maximumFractionDigits: 1 })} M`;
  }
  if (Math.abs(val) >= 1_000) {
    return `${symbol}${(val / 1_000).toLocaleString('es-MX', { maximumFractionDigits: 1 })} k`;
  }
  return fmtCurrency(val, currency);
}

/** Compact: 1.2M, 340k, 123 (for dashboard KPIs) */
export function fmtCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(Number(n))) return '—';
  const val = Number(n);
  if (Math.abs(val) >= 1_000_000) {
    return `${(val / 1_000_000).toLocaleString('es-MX', { maximumFractionDigits: 1 })} M`;
  }
  if (Math.abs(val) >= 1_000) {
    return `${(val / 1_000).toLocaleString('es-MX', { maximumFractionDigits: 1 })} k`;
  }
  return val.toLocaleString('es-MX', { maximumFractionDigits: 1 });
}

/** Units: "1,234.5 kWp", "500 kWh", etc. */
export function fmtUnit(n: number | null | undefined, unit: string, decimals?: number): string {
  if (n === null || n === undefined || isNaN(Number(n))) return '—';
  const formatted = fmtNum(n, decimals);
  return `${formatted} ${unit}`;
}

/** Percentage: "85.3%" */
export function fmtPct(n: number | null | undefined, decimals = 1): string {
  if (n === null || n === undefined || isNaN(Number(n))) return '—';
  return `${Number(n).toLocaleString('es-MX', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

/** Parse string with commas to a raw number */
export function parseNum(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  const clean = v.replace(/,/g, '').trim();
  if (!clean || isNaN(Number(clean))) return 0;
  return Number(clean);
}

/** Formats a text input value dynamically to include thousands separators */
export function formatNumberInput(value: string): string {
  // Remove everything except digits and dot
  const clean = value.replace(/[^\d.]/g, '');
  
  // Handle decimal dots
  const parts = clean.split('.');
  if (parts.length > 2) {
    parts[1] = parts.slice(1).join('').replace(/\./g, '');
    parts.length = 2;
  }
  
  let integerPart = parts[0];
  const decimalPart = parts[1];
  
  // Format the integer part with commas
  if (integerPart) {
    // Strip leading zeros unless it's just '0'
    if (integerPart.length > 1 && integerPart.startsWith('0')) {
      integerPart = integerPart.replace(/^0+/, '');
      if (integerPart === '') integerPart = '0';
    }
    const num = Number(integerPart);
    if (!isNaN(num)) {
      integerPart = num.toLocaleString('es-MX', { maximumFractionDigits: 0 });
    }
  }
  
  if (parts.length === 2) {
    return `${integerPart}.${decimalPart}`;
  }
  return integerPart;
}
