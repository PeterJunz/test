import { createContext, useContext } from 'react';
import type { MessageKey } from './en';

export type Lang = 'en' | 'vi';
export type Vars = Record<string, string | number>;
export type TFunction = (key: MessageKey, vars?: Vars) => string;

export interface I18nValue {
  lang: Lang;
  setLang(lang: Lang): void;
  t: TFunction;
  /** BCP-47 locale for Intl formatting (dates, numbers, country names). */
  locale: string;
}

export const I18nContext = createContext<I18nValue | null>(null);

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
