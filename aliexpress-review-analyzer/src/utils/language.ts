/**
 * Lightweight language identification for review text. It is a heuristic: script
 * detection for non-Latin alphabets and stop-word voting for Latin ones. Short texts
 * return `und` (undetermined) instead of guessing.
 */
const STOPWORDS: Record<string, string[]> = {
  en: ['the', 'and', 'is', 'it', 'very', 'good', 'not', 'this', 'with', 'for', 'was', 'but', 'arrived', 'product', 'great', 'quality', 'my', 'are', 'you', 'have'],
  es: ['el', 'la', 'de', 'que', 'y', 'muy', 'es', 'en', 'los', 'buena', 'bueno', 'producto', 'llegó', 'pero', 'calidad', 'con', 'para', 'todo', 'bien', 'una'],
  pt: ['o', 'a', 'de', 'que', 'e', 'muito', 'é', 'em', 'os', 'bom', 'boa', 'produto', 'chegou', 'mas', 'qualidade', 'com', 'para', 'tudo', 'não', 'uma'],
  fr: ['le', 'la', 'de', 'et', 'est', 'très', 'les', 'un', 'une', 'pour', 'bien', 'produit', 'qualité', 'mais', 'pas', 'avec', 'arrivé', 'je', 'il', 'du'],
  de: ['der', 'die', 'das', 'und', 'ist', 'sehr', 'gut', 'nicht', 'ein', 'eine', 'mit', 'für', 'aber', 'qualität', 'produkt', 'ich', 'es', 'auch', 'war', 'angekommen'],
  it: ['il', 'la', 'di', 'che', 'e', 'molto', 'è', 'un', 'una', 'per', 'buono', 'bene', 'prodotto', 'qualità', 'ma', 'non', 'con', 'arrivato', 'sono', 'tutto'],
  nl: ['de', 'het', 'een', 'en', 'is', 'zeer', 'goed', 'niet', 'met', 'voor', 'maar', 'kwaliteit', 'product', 'ik', 'dat', 'van', 'mooi', 'snel', 'geleverd', 'erg'],
  pl: ['i', 'w', 'nie', 'jest', 'na', 'się', 'bardzo', 'dobry', 'dobra', 'to', 'z', 'ale', 'produkt', 'jakość', 'polecam', 'szybko', 'dla', 'że', 'jak', 'zgodny'],
  tr: ['ve', 'bir', 'bu', 'çok', 'iyi', 'ürün', 'güzel', 'için', 'ama', 'kalite', 'değil', 'geldi', 'ile', 'da', 'de', 'gibi', 'tavsiye', 'ederim', 'teşekkürler', 'hızlı'],
  vi: ['và', 'là', 'của', 'rất', 'tốt', 'không', 'hàng', 'sản', 'phẩm', 'chất', 'lượng', 'giao', 'nhanh', 'đẹp', 'có', 'được', 'cho', 'này', 'mình', 'shop'],
};

const SCRIPT_RULES: Array<[RegExp, string]> = [
  [/[぀-ヿ]/, 'ja'],
  [/[가-힯]/, 'ko'],
  [/[一-鿿]/, 'zh'],
  [/[֐-׿]/, 'he'],
  [/[؀-ۿ]/, 'ar'],
  [/[฀-๿]/, 'th'],
  [/[Ͱ-Ͽ]/, 'el'],
];

const VI_DIACRITICS = /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;
const UK_LETTERS = /[іїєґ]/i;

export function detectLanguage(text: string): string {
  const value = text.trim().toLowerCase();
  if (value.length < 8) return 'und';
  for (const [re, lang] of SCRIPT_RULES) if (re.test(value)) return lang;
  if (/[Ѐ-ӿ]/.test(value)) return UK_LETTERS.test(value) ? 'uk' : 'ru';
  if (VI_DIACRITICS.test(value)) return 'vi';

  const words = value.split(/[^\p{L}]+/u).filter(Boolean);
  if (words.length < 2) return 'und';
  let best = 'und';
  let bestScore = 0;
  let second = 0;
  for (const [lang, list] of Object.entries(STOPWORDS)) {
    const set = new Set(list);
    const score = words.reduce((acc, w) => acc + (set.has(w) ? 1 : 0), 0);
    if (score > bestScore) {
      second = bestScore;
      bestScore = score;
      best = lang;
    } else if (score > second) {
      second = score;
    }
  }
  // Require a clear winner; ties between e.g. es/pt stay undetermined.
  if (bestScore === 0 || bestScore === second) return 'und';
  return best;
}

let names: Intl.DisplayNames | undefined;

export function languageName(code: string): string {
  if (!code || code === 'und') return 'Undetermined';
  try {
    names ??= new Intl.DisplayNames(['en'], { type: 'language' });
    return names.of(code) ?? code;
  } catch {
    return code;
  }
}

export function normalizeLanguageCode(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const v = raw.trim().toLowerCase().replace('_', '-');
  const m = v.match(/^([a-z]{2,3})(?:-[a-z0-9]+)*$/);
  return m ? m[1] : undefined;
}
