import { createContext, useContext } from 'react';
import type { ReviewFilters, SortState } from '../types/filters';
import type { Dataset } from '../types/review';
import type { ConnectionStatus, ReviewProvider } from '../services/data-providers/types';
import type { AppSettings, Secrets } from '../services/storage/settings';

export type View =
  | 'overview'
  | 'all'
  | 'positive'
  | 'negative'
  | 'photos'
  | 'videos'
  | 'insights'
  | 'export'
  | 'sources'
  | 'settings';

export const VIEWS: View[] = ['overview', 'all', 'positive', 'negative', 'photos', 'videos', 'insights', 'export', 'sources', 'settings'];

export interface Toast {
  id: number;
  kind: 'info' | 'success' | 'error';
  message: string;
}

export interface AppContextValue {
  loaded: boolean;
  storageError?: string;
  datasets: Dataset[];
  activeDataset?: Dataset;
  setActiveDataset(id: string | undefined): void;
  saveDataset(dataset: Dataset): Promise<void>;
  removeDataset(id: string): Promise<void>;
  clearAllData(): Promise<void>;

  settings: AppSettings;
  updateSettings(patch: Partial<AppSettings>): void;
  secrets: Secrets;
  updateSecrets(patch: Partial<Secrets>): void;

  provider: ReviewProvider;
  connection: ConnectionStatus | null;
  checkingConnection: boolean;
  recheckConnection(): void;

  filters: ReviewFilters;
  setFilters(update: ReviewFilters | ((prev: ReviewFilters) => ReviewFilters)): void;
  resetFilters(): void;
  sort: SortState;
  setSort(sort: SortState): void;
  selection: Set<string>;
  setSelection(next: Set<string>): void;

  view: View;
  navigate(view: View): void;
  /** Product id typed in the header, used to pre-fill imports. */
  pendingProductId?: string;
  setPendingProductId(id: string | undefined): void;

  toasts: Toast[];
  notify(kind: Toast['kind'], message: string): void;
  dismissToast(id: number): void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
