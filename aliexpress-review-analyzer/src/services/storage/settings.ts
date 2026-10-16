import type { FieldMapping } from '../review-normalizer/fields';
import type { DateOrder } from '../../utils/date';

export interface AppSettings {
  proxyUrl: string;
  /** Dot path to the review array in the provider response (blank = auto). */
  reviewsPath: string;
  totalPath: string;
  apiMapping: FieldMapping;
  ratingScale: 'auto' | '5' | '100';
  dateOrder: DateOrder;
  /** Upper bound of pages fetched per "Analyze" run, to respect provider quotas. */
  maxPages: number;
  aiEnabled: boolean;
  /** The user explicitly agreed to send review text to Anthropic through the proxy. */
  aiConsent: boolean;
  aiLanguage: 'en' | 'vi';
  /** Store secrets in localStorage (persist) instead of sessionStorage (cleared on tab close). */
  rememberSecrets: boolean;
}

export interface Secrets {
  accessToken: string;
  providerKey: string;
  anthropicKey: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  proxyUrl: 'http://localhost:8787',
  reviewsPath: '',
  totalPath: '',
  apiMapping: {},
  ratingScale: 'auto',
  dateOrder: 'MDY',
  maxPages: 5,
  aiEnabled: false,
  aiConsent: false,
  aiLanguage: 'en',
  rememberSecrets: false,
};

export const EMPTY_SECRETS: Secrets = { accessToken: '', providerKey: '', anthropicKey: '' };

const SETTINGS_KEY = 'aerap.settings.v1';
const SECRETS_KEY = 'aerap.secrets.v1';

function safeGet(storage: Storage | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(storage: Storage | undefined, key: string, value: string | null) {
  try {
    if (value === null) storage?.removeItem(key);
    else storage?.setItem(key, value);
  } catch {
    /* storage may be unavailable (private mode); settings then last for the session only */
  }
}

const local = () => (typeof localStorage === 'undefined' ? undefined : localStorage);
const session = () => (typeof sessionStorage === 'undefined' ? undefined : sessionStorage);

export function loadSettings(): AppSettings {
  const raw = safeGet(local(), SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed, maxPages: Math.min(50, Math.max(1, Number(parsed.maxPages) || DEFAULT_SETTINGS.maxPages)) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings) {
  safeSet(local(), SETTINGS_KEY, JSON.stringify(settings));
}

export function loadSecrets(): Secrets {
  const raw = safeGet(session(), SECRETS_KEY) ?? safeGet(local(), SECRETS_KEY);
  if (!raw) return EMPTY_SECRETS;
  try {
    return { ...EMPTY_SECRETS, ...(JSON.parse(raw) as Partial<Secrets>) };
  } catch {
    return EMPTY_SECRETS;
  }
}

export function saveSecrets(secrets: Secrets, remember: boolean) {
  const value = JSON.stringify(secrets);
  safeSet(session(), SECRETS_KEY, value);
  safeSet(local(), SECRETS_KEY, remember ? value : null);
}

export function clearAllLocalState() {
  safeSet(local(), SETTINGS_KEY, null);
  safeSet(local(), SECRETS_KEY, null);
  safeSet(session(), SECRETS_KEY, null);
}
