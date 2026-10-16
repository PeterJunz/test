export type DateOrder = 'MDY' | 'DMY';

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5,
  jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function build(y: number, m: number, d: number): string | undefined {
  if (y < 1995 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return undefined;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * Parses the date formats commonly found in review exports into `yyyy-mm-dd`.
 * Returns undefined when the value is not a real calendar date.
 * `order` resolves ambiguous numeric dates such as 03/04/2024.
 */
export function parseReviewDate(raw: unknown, order: DateOrder = 'MDY'): string | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === 'number') return fromEpoch(raw);
  if (raw instanceof Date) return isNaN(raw.getTime()) ? undefined : raw.toISOString().slice(0, 10);
  const value = String(raw).trim();
  if (!value) return undefined;

  if (/^\d{10}$|^\d{13}$/.test(value)) return fromEpoch(Number(value));

  // ISO: 2024-03-05, 2024-03-05T10:00:00Z, 2024/03/05, 2024.03.05
  let m = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/);
  if (m) return build(+m[1], +m[2], +m[3]);

  // Numeric with year last: 03/05/2024, 5.3.2024, 05-03-2024
  m = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:\s.*)?$/);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    const y = +m[3];
    if (a > 12) return build(y, b, a);
    if (b > 12) return build(y, a, b);
    return order === 'DMY' ? build(y, b, a) : build(y, a, b);
  }

  // 05 Mar 2024 / 5 March, 2024
  m = value.match(/^(\d{1,2})\s+([a-z]+)\.?,?\s+(\d{4})/i);
  if (m && MONTHS[m[2].toLowerCase()]) return build(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);

  // Mar 5, 2024 / March 05 2024
  m = value.match(/^([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i);
  if (m && MONTHS[m[1].toLowerCase()]) return build(+m[3], MONTHS[m[1].toLowerCase()], +m[2]);

  return undefined;
}

function fromEpoch(n: number): string | undefined {
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const ms = n < 1e12 ? n * 1000 : n;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return undefined;
  return build(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** yyyy-mm-dd for "today minus n days", in UTC. */
export function daysAgo(n: number, now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export function formatDate(iso: string | undefined, locale = 'en-US'): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale, {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}
