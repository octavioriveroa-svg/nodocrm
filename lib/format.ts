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
