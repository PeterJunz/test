import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { MessageKey } from './en';
import { I18nContext, type I18nValue, type Lang, type Vars } from './context';
import { detectInitialLang, translate } from './translate';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectInitialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem('aerap.lang', next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang,
      locale: lang === 'vi' ? 'vi-VN' : 'en-US',
      t: (key: MessageKey, vars?: Vars) => translate(lang, key, vars),
    }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
