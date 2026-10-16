import { useApp } from './hooks/appContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Toasts } from './components/Toasts';
import { NoDataState } from './components/NoDataState';
import { Spinner } from './components/ui';
import { OverviewPage } from './pages/OverviewPage';
import { InsightsPage } from './pages/InsightsPage';
import { ExportPage } from './pages/ExportPage';
import { DataSourcesPage } from './pages/DataSourcesPage';
import { SettingsPage } from './pages/SettingsPage';
import { ReviewsView } from './features/reviews/ReviewsView';
import type { Scope } from './features/filters/scope';

const TITLES: Record<Scope, string> = {
  all: 'All reviews',
  positive: 'Positive reviews',
  negative: 'Negative reviews',
  photos: 'Photo reviews',
  videos: 'Video reviews',
};

function Content() {
  const { view, activeDataset, loaded } = useApp();
  if (!loaded) return <Spinner label="Loading saved data…" />;
  if (view === 'settings') return <SettingsPage />;
  if (view === 'sources') return <DataSourcesPage />;
  if (!activeDataset) return <NoDataState />;
  switch (view) {
    case 'overview':
      return <OverviewPage dataset={activeDataset} />;
    case 'insights':
      return <InsightsPage dataset={activeDataset} />;
    case 'export':
      return <ExportPage dataset={activeDataset} />;
    default: {
      const scope = view as Scope;
      return (
        <div className="space-y-3">
          <h1 className="text-xl font-semibold tracking-tight">{TITLES[scope]}</h1>
          <ReviewsView key={scope} dataset={activeDataset} scope={scope} />
        </div>
      );
    }
  }
}

export default function App() {
  const { storageError } = useApp();
  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto p-5 scrollbar-thin">
          {storageError && <p className="mb-4 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn-ink">{storageError}</p>}
          <Content />
        </main>
      </div>
      <Toasts />
    </div>
  );
}
