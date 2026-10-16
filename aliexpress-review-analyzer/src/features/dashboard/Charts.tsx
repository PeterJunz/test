import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DashboardStats, TrendPoint } from './stats';

const AXIS = { fontSize: 11, fill: 'var(--ink-3)' };

function TooltipBox({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-ink">{title}</p>
      {rows.map(([k, v]) => (
        <p key={k} className="flex justify-between gap-4 text-ink-2">
          <span>{k}</span>
          <span className="tabular font-medium text-ink">{v}</span>
        </p>
      ))}
    </div>
  );
}

export function RatingDistributionChart({ stats }: { stats: DashboardStats }) {
  const data = stats.distribution.map((d) => ({ ...d, label: `${d.stars} ★` }));
  return (
    <div className="h-56" role="img" aria-label={`Star distribution: ${data.map((d) => `${d.stars} stars ${d.count}`).join(', ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 4 }} barCategoryGap={6}>
          <CartesianGrid horizontal={false} stroke="var(--grid)" />
          <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="label" tick={{ ...AXIS, fill: 'var(--ink-2)' }} axisLine={false} tickLine={false} width={36} />
          <Tooltip
            cursor={{ fill: 'var(--surface-3)' }}
            content={({ active, payload }) => {
              const p = active && payload?.[0]?.payload;
              return p ? <TooltipBox title={`${p.stars}-star reviews`} rows={[['Reviews', p.count.toLocaleString()], ['Share', `${(p.share * 100).toFixed(1)}%`]]} /> : null;
            }}
          />
          <Bar
            dataKey="count"
            fill="var(--pos)"
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
            label={{ position: 'right', fontSize: 11, fill: 'var(--ink-2)', formatter: (v: unknown) => Number(v).toLocaleString() }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const monthLabel = (m: string) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
};

export function TrendCharts({ trend }: { trend: TrendPoint[] }) {
  const data = trend.map((t) => ({ ...t, label: monthLabel(t.month), avg: Number.isNaN(t.averageRating) ? null : Number(t.averageRating.toFixed(2)) }));
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <figure>
        <figcaption className="mb-2 text-xs font-medium text-ink-2">Reviews per month</figcaption>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="label" tick={AXIS} axisLine={{ stroke: 'var(--line-strong)' }} tickLine={false} interval="preserveStartEnd" minTickGap={12} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: 'var(--surface-3)' }}
                content={({ active, payload }) => {
                  const p = active && payload?.[0]?.payload;
                  return p ? <TooltipBox title={p.label} rows={[['Reviews', p.count.toLocaleString()], ['Avg rating', p.avg === null ? '—' : p.avg.toFixed(2)]]} /> : null;
                }}
              />
              <Bar dataKey="count" fill="var(--pos)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </figure>
      <figure>
        <figcaption className="mb-2 text-xs font-medium text-ink-2">Average rating per month</figcaption>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="label" tick={AXIS} axisLine={{ stroke: 'var(--line-strong)' }} tickLine={false} interval="preserveStartEnd" minTickGap={12} />
              <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={AXIS} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ stroke: 'var(--line-strong)' }}
                content={({ active, payload }) => {
                  const p = active && payload?.[0]?.payload;
                  return p ? <TooltipBox title={p.label} rows={[['Avg rating', p.avg === null ? 'no reviews' : p.avg.toFixed(2)], ['Reviews', p.count.toLocaleString()]]} /> : null;
                }}
              />
              <Line type="monotone" dataKey="avg" stroke="var(--brand)" strokeWidth={2} dot={{ r: 3, fill: 'var(--brand)', stroke: 'var(--surface)', strokeWidth: 2 }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </figure>
    </div>
  );
}

export function SentimentBar({ stats }: { stats: DashboardStats }) {
  const parts = [
    { key: 'Positive', value: stats.positive, color: 'var(--pos)' },
    { key: 'Neutral', value: stats.neutral, color: 'var(--neu)' },
    { key: 'Negative', value: stats.negative, color: 'var(--neg)' },
    { key: 'Uncertain', value: stats.uncertain, color: 'var(--unc)' },
  ];
  const total = stats.total || 1;
  return (
    <div>
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label={parts.map((p) => `${p.key} ${p.value}`).join(', ')}>
        {parts.filter((p) => p.value).map((p) => (
          <div key={p.key} title={`${p.key}: ${p.value.toLocaleString()} (${((p.value / total) * 100).toFixed(1)}%)`} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5 text-ink-2">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: p.color }} aria-hidden />
            {p.key}
            <span className="tabular ml-auto font-medium text-ink">{((p.value / total) * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
