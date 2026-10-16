import { BarChart3, Camera, Database, Download, LayoutDashboard, List, Settings, Sparkles, ThumbsDown, ThumbsUp, Video } from 'lucide-react';
import { useMemo } from 'react';
import { useApp, type View } from '../hooks/appContext';
import { useI18n } from '../i18n/context';
import type { MessageKey } from '../i18n/en';
import { effectiveSentiment } from '../features/filters/filterReviews';

const ITEMS: Array<{ view: View; label: MessageKey; icon: typeof List; group?: MessageKey }> = [
  { view: 'overview', label: 'nav.overview', icon: LayoutDashboard },
  { view: 'all', label: 'nav.all', icon: List },
  { view: 'positive', label: 'nav.positive', icon: ThumbsUp },
  { view: 'negative', label: 'nav.negative', icon: ThumbsDown },
  { view: 'photos', label: 'nav.photos', icon: Camera },
  { view: 'videos', label: 'nav.videos', icon: Video },
  { view: 'insights', label: 'nav.insights', icon: Sparkles },
  { view: 'export', label: 'nav.export', icon: Download, group: 'nav.groupData' },
  { view: 'sources', label: 'nav.sources', icon: Database },
  { view: 'settings', label: 'nav.settings', icon: Settings },
];

export function Sidebar() {
  const { view, navigate, activeDataset, datasets, setActiveDataset } = useApp();
  const { t } = useI18n();
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
    <nav aria-label={t('nav.aria')} className="flex w-60 shrink-0 flex-col border-r border-line bg-surface">
      <div className="border-b border-line p-3">
        <label className="mb-1 block px-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3" htmlFor="dataset-select">
          {t('nav.dataset')}
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
          <p className="px-1 text-xs text-ink-3">{t('nav.noData')}</p>
        )}
      </div>
      <ul className="flex-1 space-y-0.5 overflow-y-auto p-2 scrollbar-thin">
        {ITEMS.map(({ view: v, label, icon: Icon, group }) => (
          <li key={v}>
            {group && <div className="mx-2 mb-1.5 mt-4 border-t border-line pt-3 text-[11px] font-semibold uppercase tracking-wider text-ink-3">{t(group)}</div>}
            <button
              type="button"
              onClick={() => navigate(v)}
              aria-current={view === v ? 'page' : undefined}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${
                view === v ? 'bg-brand-soft text-brand-ink' : 'text-ink-2 hover:bg-surface-3 hover:text-ink'
              }`}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="flex-1 text-left">{t(label)}</span>
              {counts[v] !== undefined && activeDataset && <span className="tabular text-[11px] text-ink-3">{counts[v]!.toLocaleString()}</span>}
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2 border-t border-line p-3 text-[11px] text-ink-3">
        <BarChart3 className="size-3.5" aria-hidden />
        {t('nav.footer')}
      </div>
    </nav>
  );
}
