import { Languages } from 'lucide-react';
import { useI18n, type Lang } from '../i18n/context';

const OPTIONS: Array<{ lang: Lang; short: string; label: string }> = [
  { lang: 'vi', short: 'VI', label: 'Tiếng Việt' },
  { lang: 'en', short: 'EN', label: 'English' },
];

/** Segmented EN/VI switch. Labels are always shown in their own language. */
export function LanguageSwitch() {
  const { lang, setLang, t } = useI18n();
  return (
    <div role="radiogroup" aria-label={t('lang.switch')} className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-line p-0.5">
      <Languages className="ml-1.5 size-3.5 text-ink-3" aria-hidden />
      {OPTIONS.map((o) => (
        <button
          key={o.lang}
          type="button"
          role="radio"
          aria-checked={lang === o.lang}
          title={o.label}
          lang={o.lang}
          onClick={() => setLang(o.lang)}
          className={`rounded-full px-2 py-1 text-[11px] font-semibold ${lang === o.lang ? 'bg-ink text-surface' : 'text-ink-2 hover:text-ink'}`}
        >
          {o.short}
        </button>
      ))}
    </div>
  );
}
