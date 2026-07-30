/**
 * Date/time formatting utilities — always in UK time (Europe/London).
 *
 * Europe/London automatically handles GMT (UTC+0) in winter and
 * BST (UTC+1) in summer, so timestamps stored as UTC in the database
 * always display in the correct local UK time regardless of the season
 * or the timezone of the device/server rendering the page.
 *
 * Usage:
 *   import { fmtDate, fmtDateTime, fmtTime } from '@/lib/date';
 *
 *   fmtDate('2024-07-12T10:30:00Z')          → "12 Jul 2024"
 *   fmtDate('2024-07-12T10:30:00Z', 'long')  → "12 July 2024"
 *   fmtDateTime('2024-07-12T10:30:00Z')       → "12 Jul 2024 at 11:30"  (BST)
 *   fmtTime('2024-07-12T10:30:00Z')           → "11:30"                 (BST)
 */

const TZ = 'Europe/London';
const LOCALE = 'en-GB';

/** Parse a value that may be a string, number, or Date into a Date object. */
function toDate(value: string | number | Date): Date {
  if (value instanceof Date) return value;
  // SQLite stores datetimes as "YYYY-MM-DD HH:MM:SS" (no T, no Z).
  // Treat those as UTC by replacing the space with T and appending Z.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value)) {
    return new Date(value.replace(' ', 'T') + 'Z');
  }
  return new Date(value);
}

/**
 * Format a date only — no time component.
 * @param monthStyle  'short' (default) → "12 Jul 2024"
 *                    'long'            → "12 July 2024"
 *                    'numeric'         → "12/07/2024"
 */
export function fmtDate(
  value: string | number | Date | null | undefined,
  monthStyle: 'short' | 'long' | 'numeric' = 'short',
): string {
  if (!value) return '—';
  try {
    const d = toDate(value);
    if (isNaN(d.getTime())) return '—';
    if (monthStyle === 'numeric') {
      return d.toLocaleDateString(LOCALE, { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    return d.toLocaleDateString(LOCALE, { timeZone: TZ, day: 'numeric', month: monthStyle, year: 'numeric' });
  } catch {
    return '—';
  }
}

/**
 * Format a date + time.
 * e.g. "12 Jul 2024 at 11:30"
 */
export function fmtDateTime(
  value: string | number | Date | null | undefined,
  monthStyle: 'short' | 'long' = 'short',
): string {
  if (!value) return '—';
  try {
    const d = toDate(value);
    if (isNaN(d.getTime())) return '—';
    const datePart = d.toLocaleDateString(LOCALE, { timeZone: TZ, day: 'numeric', month: monthStyle, year: 'numeric' });
    const timePart = d.toLocaleTimeString(LOCALE, { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
    return `${datePart} at ${timePart}`;
  } catch {
    return '—';
  }
}

/**
 * Format a time only — no date component.
 * e.g. "11:30"
 */
export function fmtTime(
  value: string | number | Date | null | undefined,
  includeSeconds = false,
): string {
  if (!value) return '—';
  try {
    const d = toDate(value);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString(LOCALE, {
      timeZone: TZ,
      hour: '2-digit',
      minute: '2-digit',
      ...(includeSeconds ? { second: '2-digit' } : {}),
    });
  } catch {
    return '—';
  }
}

/**
 * Format a month + year only.
 * e.g. "July 2024"
 */
export function fmtMonthYear(
  value: string | number | Date | null | undefined,
): string {
  if (!value) return '—';
  try {
    const d = toDate(value);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(LOCALE, { timeZone: TZ, month: 'long', year: 'numeric' });
  } catch {
    return '—';
  }
}
