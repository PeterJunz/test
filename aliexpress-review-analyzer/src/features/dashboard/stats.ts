import type { Review } from '../../types/review';
import { effectiveSentiment } from '../filters/filterReviews';

export interface TrendPoint {
  /** yyyy-mm */
  month: string;
  count: number;
  averageRating: number;
  negativeShare: number;
}

export interface DashboardStats {
  total: number;
  averageRating: number | null;
  positive: number;
  neutral: number;
  negative: number;
  uncertain: number;
  photos: number;
  videos: number;
  withText: number;
  withoutDate: number;
  distribution: Array<{ stars: number; count: number; share: number }>;
  trend: TrendPoint[];
  firstDate?: string;
  lastDate?: string;
  usCount: number;
  usAverage: number | null;
}

export function computeStats(reviews: Review[]): DashboardStats {
  const dist = [0, 0, 0, 0, 0];
  let sum = 0;
  let positive = 0, neutral = 0, negative = 0, uncertain = 0, photos = 0, videos = 0, withText = 0, withoutDate = 0;
  let usCount = 0, usSum = 0;
  let firstDate: string | undefined;
  let lastDate: string | undefined;
  const months = new Map<string, { count: number; sum: number; neg: number }>();

  for (const r of reviews) {
    dist[r.rating - 1]++;
    sum += r.rating;
    const s = effectiveSentiment(r);
    if (s === 'positive') positive++;
    else if (s === 'negative') negative++;
    else if (s === 'neutral') neutral++;
    else uncertain++;
    if (r.images.length) photos++;
    if (r.videos.length) videos++;
    if (r.text.trim()) withText++;
    if (r.country === 'US') {
      usCount++;
      usSum += r.rating;
    }
    if (r.date) {
      if (!firstDate || r.date < firstDate) firstDate = r.date;
      if (!lastDate || r.date > lastDate) lastDate = r.date;
      const key = r.date.slice(0, 7);
      const m = months.get(key) ?? { count: 0, sum: 0, neg: 0 };
      m.count++;
      m.sum += r.rating;
      if (s === 'negative') m.neg++;
      months.set(key, m);
    } else {
      withoutDate++;
    }
  }

  const total = reviews.length;
  return {
    total,
    averageRating: total ? sum / total : null,
    positive,
    neutral,
    negative,
    uncertain,
    photos,
    videos,
    withText,
    withoutDate,
    distribution: [5, 4, 3, 2, 1].map((stars) => ({ stars, count: dist[stars - 1], share: total ? dist[stars - 1] / total : 0 })),
    trend: fillMonths([...months.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([month, m]) => ({
      month,
      count: m.count,
      averageRating: m.sum / m.count,
      negativeShare: m.neg / m.count,
    }))),
    firstDate,
    lastDate,
    usCount,
    usAverage: usCount ? usSum / usCount : null,
  };
}

/** Inserts empty months so gaps are visible instead of silently interpolated. */
function fillMonths(points: TrendPoint[]): TrendPoint[] {
  if (points.length < 2) return points;
  const out: TrendPoint[] = [];
  const byMonth = new Map(points.map((p) => [p.month, p]));
  let [y, m] = points[0].month.split('-').map(Number);
  const last = points[points.length - 1].month;
  for (let guard = 0; guard < 600; guard++) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    out.push(byMonth.get(key) ?? { month: key, count: 0, averageRating: NaN, negativeShare: NaN });
    if (key === last) break;
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

export function pct(part: number, total: number): string {
  if (!total) return '—';
  return `${((part / total) * 100).toFixed(part / total < 0.1 && part > 0 ? 1 : 0)}%`;
}
