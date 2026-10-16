import { BarChart3, Camera, Database, Download, LayoutDashboard, List, Settings, Sparkles, ThumbsDown, ThumbsUp, Video } from 'lucide-react';
import { useMemo } from 'react';
import { useApp, type View } from '../hooks/appContext';
import { effectiveSentiment } from '../features/filters/filterReviews';

const ITEMS: Array<{ view: View; label: string; icon: typeof List; group?: string }> = [
  { view: 'overview', label: 'Overview', icon: LayoutDashboard },
  { view: 'all', label: 'All Reviews', icon: List },
  { view: 'positive', label: 'Positive Reviews', icon: ThumbsUp },
  { view: 'negative', label: 'Negative Reviews', icon: ThumbsDown },
  { view: 'photos', label: 'Photo Reviews', icon: Camera },
  { view: 'videos', label: 'Video Reviews', icon: Video },
  { view: 'insights', label: 'Review Insights', icon: Sparkles },
  { view: 'export', label: 'Export Data', icon: Download, group: 'Data' },
  { view: 'sources', label: 'Data Sources & Import', icon: Database },
  { view: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const { view, navigate, activeDataset, datasets, setActiveDataset } = useApp();
  const counts = useMemo(() => {
    const r = activeDataset?.reviews ?? [];
    return {
      all: r.length,
      positive: r.filter((x) => effectiveSentiment(x) === 'positive').length,
      negative: r.filter((x) => effectiveSentiment(x) === 'negative').length,
      photos: r.filter((x) => x.images.length).length,
      videos: r.filter((x) => x.videos.length).length,
    } as Partial<Record<View, number>>;
  }, [activeDataset]);

  return (
    <nav aria-label="Main" className="flex w-60 shrink-0 flex-col border-r border-line bg-surface">
      <div className="border-b border-line p-3">
        <label className="mb-1 block px-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3" htmlFor="dataset-select">
          Dataset
        </label>
        {datasets.length ? (
          <select
            id="dataset-select"
            value={activeDataset?.id ?? ''}
            onChange={(e) => setActiveDataset(e.target.value)}
            className="h-9 w-full truncate rounded-lg border border-line-strong bg-surface-2 px-2 text-[13px]"
          >
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.origin === 'demo' ? '[DEMO] ' : ''}
                {d.name} ({d.reviews.length})
              </option>
            ))}
          </select>
        ) : (
          <p className="px-1 text-xs text-ink-3">No data loaded yet.</p>
        )}
      </div>
      <ul className="flex-1 space-y-0.5 overflow-y-auto p-2 scrollbar-thin">
        {ITEMS.map(({ view: v, label, icon: Icon, group }) => (
          <li key={v}>
            {group && <div className="mx-2 mb-1.5 mt-4 border-t border-line pt-3 text-[11px] font-semibold uppercase tracking-wider text-ink-3">{group}</div>}
            <button
              type="button"
              onClick={() => navigate(v)}
              aria-current={view === v ? 'page' : undefined}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${
                view === v ? 'bg-brand-soft text-brand-ink' : 'text-ink-2 hover:bg-surface-3 hover:text-ink'
              }`}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="flex-1 text-left">{label}</span>
              {counts[v] !== undefined && activeDataset && <span className="tabular text-[11px] text-ink-3">{counts[v]!.toLocaleString()}</span>}
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2 border-t border-line p-3 text-[11px] text-ink-3">
        <BarChart3 className="size-3.5" aria-hidden />
        Data stays in this browser.
      </div>
    </nav>
  );
}
