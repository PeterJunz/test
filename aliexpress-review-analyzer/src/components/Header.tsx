import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CircleAlert, CircleCheck, CircleDashed, FileUp, Link2, RefreshCw, Search, Settings2, ShieldAlert } from 'lucide-react';
import { useApp } from '../hooks/appContext';
import { useAnalyze, type FetchPlan } from '../hooks/useAnalyze';
import { PlanBody, PlanButtons } from './FetchPlanDialog';
import { useI18n } from '../i18n/context';
import type { MessageKey } from '../i18n/en';
import type { ConnectionState } from '../services/data-providers/types';
import { useConnectionMessage } from '../hooks/useConnectionMessage';
import { Button, Modal } from './ui';
import { LanguageSwitch } from './LanguageSwitch';

const STATUS: Record<ConnectionState | 'checking' | 'none', { label: MessageKey; tone: string; icon: typeof CircleCheck }> = {
  connected: { label: 'status.connected', tone: 'text-ok', icon: CircleCheck },
  'not-configured': { label: 'status.notConfigured', tone: 'text-ink-3', icon: CircleDashed },
  unreachable: { label: 'status.unreachable', tone: 'text-neg', icon: CircleAlert },
  unauthorized: { label: 'status.unauthorized', tone: 'text-neg', icon: ShieldAlert },
  unsupported: { label: 'status.unsupported', tone: 'text-ink-3', icon: CircleDashed },
  local: { label: 'status.local', tone: 'text-ink-2', icon: CircleCheck },
  checking: { label: 'status.checking', tone: 'text-ink-3', icon: RefreshCw },
  none: { label: 'status.none', tone: 'text-ink-3', icon: CircleDashed },
};

export function Header() {
  const { connection, checkingConnection, recheckConnection, navigate, notify, setPendingProductId, activeDataset, view } = useApp();
  const { t } = useI18n();
  const connectionMessage = useConnectionMessage();
  const { analyze, progress, cancel, lastCredits } = useAnalyze();
  const [initialProduct] = useState(() => new URLSearchParams(window.location.search).get('product') ?? '');
  const [input, setInput] = useState(initialProduct);
  // The error belongs to the page it was raised on and disappears when the user navigates.
  const [errorState, setErrorState] = useState<{ message: string; view: string } | null>(null);
  const error = errorState?.view === view ? errorState.message : undefined;
  const setError = (message: string | undefined) => setErrorState(message ? { message, view } : null);
  const [noSource, setNoSource] = useState<{ productId: string; productUrl: string } | null>(null);
  const [plan, setPlan] = useState<{ plan: FetchPlan; resolve(pages: number): void } | null>(null);
  const choose = (pages: number) => {
    plan?.resolve(pages);
    setPlan(null);
  };

  const status = STATUS[checkingConnection ? 'checking' : connection?.state ?? 'none'];
  const StatusIcon = status.icon;

  const run = async (value: string) => {
    setError(undefined);
    const outcome = await analyze(value, (p) => new Promise<number>((resolve) => setPlan({ plan: p, resolve })));
    switch (outcome.kind) {
      case 'error':
        setError(outcome.message);
        break;
      case 'no-source':
        setNoSource(outcome);
        break;
      case 'existing':
        notify('info', t('analyze.openedExisting', { id: outcome.dataset.productId ?? '' }));
        navigate('overview');
        break;
      case 'fetched':
        notify(
          'success',
          `${t(outcome.dataset.completeness === 'complete' ? 'analyze.fetchedAll' : 'analyze.fetched', { count: outcome.dataset.reviews.length })}${
            lastCredits.current !== undefined ? ` ${t('analyze.creditsLeft', { count: lastCredits.current })}` : ''
          }`,
        );
        navigate('overview');
        break;
      case 'cancelled':
        notify('info', t('analyze.cancelled'));
        break;
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void run(input);
  };

  // The extension opens the app with ?product=<id> when clicked on an AliExpress product page.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current || !initialProduct || connection?.state !== 'connected') return;
    autoRan.current = true;
    void run(initialProduct);
  });

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-line bg-surface/95 px-5 backdrop-blur">
      <a href="#/overview" className="flex shrink-0 items-center gap-2.5" aria-label={t('header.homeAria')}>
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">AR</span>
        <span className="hidden leading-tight lg:block">
          <span className="block text-sm font-semibold">AliExpress Review Analyzer</span>
          <span className="block text-[11px] font-medium uppercase tracking-wider text-brand">Pro</span>
        </span>
      </a>

      <form onSubmit={onSubmit} className="flex min-w-0 flex-1 items-center gap-2">
        <div className="relative min-w-0 max-w-2xl flex-1">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(undefined);
            }}
            placeholder={t('header.placeholder')}
            aria-label={t('header.inputAria')}
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
              {progress.total !== undefined
                ? t('header.progressTotal', { page: progress.page, max: progress.maxPages, count: progress.fetched, total: progress.total })
                : t('header.progress', { page: progress.page, max: progress.maxPages, count: progress.fetched })}
            </span>
            <Button onClick={cancel}>{t('common.cancel')}</Button>
          </>
        ) : (
          <Button type="submit" variant="primary" icon={<Search className="size-4" />} disabled={!input.trim()}>
            {t('header.analyze')}
          </Button>
        )}
      </form>

      <button
        type="button"
        onClick={recheckConnection}
        title={connection ? t('header.statusTitle', { message: connectionMessage, time: new Date(connection.checkedAt).toLocaleTimeString() }) : t('header.checkConnection')}
        className={`hidden shrink-0 items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-medium hover:bg-surface-2 md:inline-flex ${status.tone}`}
      >
        <StatusIcon className={`size-3.5 ${checkingConnection ? 'animate-spin' : ''}`} aria-hidden />
        {t(status.label)}
      </button>
      {activeDataset?.origin === 'demo' && (
        <span className="hidden shrink-0 rounded-md bg-warn-soft px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-warn-ink xl:inline">{t('header.demoBadge')}</span>
      )}
      <LanguageSwitch />

      <Modal
        open={Boolean(plan)}
        onClose={() => choose(1)}
        title={t('plan.title')}
        footer={plan && <PlanButtons plan={plan.plan} onChoose={choose} />}
      >
        {plan && <PlanBody plan={plan.plan} />}
      </Modal>

      <Modal
        open={Boolean(noSource)}
        onClose={() => setNoSource(null)}
        title={t('noSource.title')}
        footer={
          <>
            <Button
              icon={<Settings2 className="size-4" />}
              onClick={() => {
                setNoSource(null);
                navigate('settings');
              }}
            >
              {t('noSource.enterKey')}
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
              {t('noSource.import')}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-ink-2">
          <p>{t('noSource.recognised', { id: noSource?.productId ?? '' })}</p>
          <p>{t('noSource.explain')}</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t('noSource.optionImport')}</li>
            <li>{t('noSource.optionSocialcrawl')}</li>
            <li>{t('noSource.optionProvider')}</li>
          </ul>
          <p className="text-xs text-ink-3">{t('noSource.proxyStatus', { message: connection ? connectionMessage : t('status.none') })}</p>
        </div>
      </Modal>
    </header>
  );
}
