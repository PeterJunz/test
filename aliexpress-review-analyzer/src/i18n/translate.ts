import { en, type MessageKey } from './en';
import { vi } from './vi';
import type { Lang, Vars } from './context';

export const DICTIONARIES: Record<Lang, Partial<Record<MessageKey, string>>> = { en, vi };

/**
 * Looks up a message and fills {placeholders}. With a numeric `count`, a `<key>_one`
 * variant is used for 1 when the dictionary has one (English plurals).
 */
export function translate(lang: Lang, key: MessageKey, vars?: Vars): string {
  const dict = DICTIONARIES[lang];
  let template: string = dict[key] ?? en[key] ?? key;
  if (vars && vars.count === 1) {
    const one = `${key}_one` as MessageKey;
    const singular = dict[one];
    if (singular) template = singular;
  }
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) => {
    const v = vars[name];
    if (v === undefined) return m;
    return typeof v === 'number' ? v.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US') : v;
  });
}

export function detectInitialLang(): Lang {
  try {
    const saved = localStorage.getItem('aerap.lang');
    if (saved === 'en' || saved === 'vi') return saved;
  } catch {
    /* ignore */
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('vi') ? 'vi' : 'en';
}
