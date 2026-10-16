import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { EMPTY_FILTERS, type ReviewFilters, type SortState } from '../types/filters';
import type { Dataset } from '../types/review';
import { ProxyApiProvider } from '../services/data-providers/proxyApiProvider';
import type { ConnectionStatus } from '../services/data-providers/types';
import { datasetStore } from '../services/storage/datasetStore';
import {
  clearAllLocalState,
  DEFAULT_SETTINGS,
  EMPTY_SECRETS,
  loadSecrets,
  loadSettings,
  saveSecrets,
  saveSettings,
  type AppSettings,
  type Secrets,
} from '../services/storage/settings';
import { AppContext, VIEWS, type AppContextValue, type Toast, type View } from './appContext';

const ACTIVE_KEY = 'aerap.activeDataset';

function viewFromHash(): View {
  const v = window.location.hash.replace(/^#\/?/, '') as View;
  return VIEWS.includes(v) ? v : 'overview';
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState<string>();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>(() => {
    try {
      return localStorage.getItem(ACTIVE_KEY) ?? undefined;
    } catch {
      return undefined;
    }
  });
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [secrets, setSecrets] = useState<Secrets>(loadSecrets);
  const [connection, setConnection] = useState<ConnectionStatus | null>(null);
  const [checkingConnection, setChecking] = useState(false);
  const [filters, setFilters] = useState<ReviewFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortState>({ field: 'date', direction: 'desc' });
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [view, setView] = useState<View>(viewFromHash);
  const [pendingProductId, setPendingProductId] = useState<string>();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  useEffect(() => {
    datasetStore
      .list()
      .then((list) => setDatasets(list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))))
      .catch((e: Error) => setStorageError(`Local storage unavailable — data will not survive a reload (${e.message}).`))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const activeDataset = useMemo(() => datasets.find((d) => d.id === activeId) ?? datasets[0], [datasets, activeId]);

  const setActiveDataset = useCallback((id: string | undefined) => {
    setActiveId(id);
    setSelection(new Set());
    try {
      if (id) localStorage.setItem(ACTIVE_KEY, id);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const notify = useCallback((kind: Toast['kind'], message: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 9000 : 5000);
  }, []);

  const saveDataset = useCallback(async (dataset: Dataset) => {
    setDatasets((list) => [dataset, ...list.filter((d) => d.id !== dataset.id)]);
    try {
      await datasetStore.put(dataset);
    } catch (e) {
      notify('error', `Saved for this session only: ${(e as Error).message}`);
    }
  }, [notify]);

  const removeDataset = useCallback(async (id: string) => {
    setDatasets((list) => list.filter((d) => d.id !== id));
    setSelection(new Set());
    await datasetStore.remove(id).catch(() => undefined);
  }, []);

  const clearAllData = useCallback(async () => {
    setDatasets([]);
    setSelection(new Set());
    setFilters(EMPTY_FILTERS);
    setSettings(DEFAULT_SETTINGS);
    setSecrets(EMPTY_SECRETS);
    setConnection(null);
    clearAllLocalState();
    try {
      localStorage.removeItem(ACTIVE_KEY);
    } catch {
      /* ignore */
    }
    await datasetStore.clear().catch(() => undefined);
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  useEffect(() => {
    saveSecrets(secrets, settings.rememberSecrets);
  }, [secrets, settings.rememberSecrets]);

  const updateSecrets = useCallback((patch: Partial<Secrets>) => setSecrets((s) => ({ ...s, ...patch })), []);

  const provider = useMemo(
    () =>
      new ProxyApiProvider({
        baseUrl: settings.proxyUrl,
        accessToken: secrets.accessToken,
        providerKey: secrets.providerKey || undefined,
        reviewsPath: settings.reviewsPath || undefined,
        totalPath: settings.totalPath || undefined,
        mapping: settings.apiMapping,
        ratingScale: settings.ratingScale,
        dateOrder: settings.dateOrder,
      }),
    [settings.proxyUrl, settings.reviewsPath, settings.totalPath, settings.apiMapping, settings.ratingScale, settings.dateOrder, secrets.accessToken, secrets.providerKey],
  );

  const checkSeq = useRef(0);
  const recheckConnection = useCallback(() => {
    const seq = ++checkSeq.current;
    setChecking(true);
    provider
      .validateConnection()
      .then((status) => seq === checkSeq.current && setConnection(status))
      .catch((e: Error) => seq === checkSeq.current && setConnection({ state: 'unreachable', message: e.message, checkedAt: new Date().toISOString() }))
      .finally(() => seq === checkSeq.current && setChecking(false));
  }, [provider]);

  // Re-validate (debounced) whenever the connection settings change.
  useEffect(() => {
    const t = setTimeout(recheckConnection, 400);
    return () => clearTimeout(t);
  }, [recheckConnection]);

  const navigate = useCallback((v: View) => {
    window.location.hash = `/${v}`;
    setView(v);
  }, []);

  const value: AppContextValue = {
    loaded,
    storageError,
    datasets,
    activeDataset,
    setActiveDataset,
    saveDataset,
    removeDataset,
    clearAllData,
    settings,
    updateSettings,
    secrets,
    updateSecrets,
    provider,
    connection,
    checkingConnection,
    recheckConnection,
    filters,
    setFilters,
    resetFilters: () => setFilters(EMPTY_FILTERS),
    sort,
    setSort,
    selection,
    setSelection,
    view,
    navigate,
    pendingProductId,
    setPendingProductId,
    toasts,
    notify,
    dismissToast: (id) => setToasts((t) => t.filter((x) => x.id !== id)),
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
