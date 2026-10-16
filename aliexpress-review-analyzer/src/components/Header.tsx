import { useState, type FormEvent } from 'react';
import { CircleAlert, CircleCheck, CircleDashed, FileUp, Link2, RefreshCw, Search, Settings2, ShieldAlert } from 'lucide-react';
import { useApp } from '../hooks/appContext';
import { useAnalyze } from '../hooks/useAnalyze';
import type { ConnectionState } from '../services/data-providers/types';
import { Button, Modal } from './ui';

const STATUS: Record<ConnectionState | 'checking' | 'none', { label: string; tone: string; icon: typeof CircleCheck }> = {
  connected: { label: 'Provider connected', tone: 'text-ok', icon: CircleCheck },
  'not-configured': { label: 'No live source', tone: 'text-ink-3', icon: CircleDashed },
  unreachable: { label: 'Proxy unreachable', tone: 'text-neg', icon: CircleAlert },
  unauthorized: { label: 'Proxy auth failed', tone: 'text-neg', icon: ShieldAlert },
  unsupported: { label: 'Unsupported', tone: 'text-ink-3', icon: CircleDashed },
  local: { label: 'Local files', tone: 'text-ink-2', icon: CircleCheck },
  checking: { label: 'Checking…', tone: 'text-ink-3', icon: RefreshCw },
  none: { label: 'Not checked', tone: 'text-ink-3', icon: CircleDashed },
};

export function Header() {
  const { connection, checkingConnection, recheckConnection, navigate, notify, setPendingProductId, activeDataset } = useApp();
  const { analyze, progress, cancel } = useAnalyze();
  const [input, setInput] = useState('');
  const [error, setError] = useState<string>();
  const [noSource, setNoSource] = useState<{ productId: string; productUrl: string } | null>(null);

  const status = STATUS[checkingConnection ? 'checking' : connection?.state ?? 'none'];
  const StatusIcon = status.icon;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    const outcome = await analyze(input);
    switch (outcome.kind) {
      case 'error':
        setError(outcome.message);
        break;
      case 'no-source':
        setNoSource(outcome);
        break;
      case 'existing':
        notify('info', `Opened the saved dataset for product ${outcome.dataset.productId}.`);
        navigate('overview');
        break;
      case 'fetched':
        notify('success', `Fetched ${outcome.dataset.reviews.length.toLocaleString()} reviews.`);
        navigate('overview');
        break;
      case 'cancelled':
        notify('info', 'Fetching cancelled.');
        break;
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-line bg-surface/95 px-5 backdrop-blur">
      <a href="#/overview" className="flex shrink-0 items-center gap-2.5" aria-label="AliExpress Review Analyzer Pro — overview">
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">AR</span>
        <span className="hidden leading-tight lg:block">
          <span className="block text-sm font-semibold">AliExpress Review Analyzer</span>
          <span className="block text-[11px] font-medium uppercase tracking-wider text-brand">Pro</span>
        </span>
      </a>

      <form onSubmit={onSubmit} className="flex min-w-0 flex-1 items-center gap-2">
        <div className="relative min-w-0 flex-1 max-w-2xl">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(undefined);
            }}
            placeholder="Paste an AliExpress product URL or product ID…"
            aria-label="AliExpress product URL or ID"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'analyze-error' : undefined}
            className={`h-10 w-full rounded-lg border bg-surface-2 pl-9 pr-3 text-sm placeholder:text-ink-3 focus:bg-surface focus:outline-none ${error ? 'border-neg' : 'border-line-strong focus:border-brand'}`}
          />
          {error && (
            <p id="analyze-error" role="alert" className="absolute left-0 top-full mt-1 rounded-md bg-neg px-2 py-1 text-xs text-white shadow">
              {error}
            </p>
          )}
        </div>
        {progress ? (
          <>
            <span className="tabular whitespace-nowrap text-xs text-ink-2">
              Page {progress.page}/{progress.maxPages} · {progress.fetched} reviews
            </span>
            <Button onClick={cancel}>Cancel</Button>
          </>
        ) : (
          <Button type="submit" variant="primary" icon={<Search className="size-4" />} disabled={!input.trim()}>
            Analyze Reviews
          </Button>
        )}
      </form>

      <button
        type="button"
        onClick={recheckConnection}
        title={connection ? `${connection.message}\nChecked ${new Date(connection.checkedAt).toLocaleTimeString()} — click to re-check` : 'Check connection'}
        className={`hidden shrink-0 items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-medium hover:bg-surface-2 md:inline-flex ${status.tone}`}
      >
        <StatusIcon className={`size-3.5 ${checkingConnection ? 'animate-spin' : ''}`} aria-hidden />
        {status.label}
      </button>
      {activeDataset?.origin === 'demo' && (
        <span className="hidden shrink-0 rounded-md bg-warn-soft px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-warn-ink xl:inline">Demo data</span>
      )}

      <Modal
        open={Boolean(noSource)}
        onClose={() => setNoSource(null)}
        title="No live data source connected"
        footer={
          <>
            <Button
              icon={<Settings2 className="size-4" />}
              onClick={() => {
                setNoSource(null);
                navigate('settings');
              }}
            >
              Configure a data provider
            </Button>
            <Button
              variant="primary"
              icon={<FileUp className="size-4" />}
              onClick={() => {
                setPendingProductId(noSource?.productId);
                setNoSource(null);
                navigate('sources');
              }}
            >
              Import a review file
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-ink-2">
          <p>
            Product <strong className="text-ink">{noSource?.productId}</strong> was recognised, but there is no connected source to load its reviews from.
          </p>
          <p>
            AliExpress does not offer a public review API for third-party tools, and this app does not scrape the site. To analyse this product, either:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>import a CSV/JSON export of its reviews that you are allowed to use, or</li>
            <li>connect a licensed review-data provider through the bundled proxy server.</li>
          </ul>
          <p className="text-xs text-ink-3">Proxy status: {connection?.message ?? 'not checked yet'}</p>
        </div>
      </Modal>
    </header>
  );
}
