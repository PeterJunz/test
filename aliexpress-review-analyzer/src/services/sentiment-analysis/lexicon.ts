/**
 * Small multilingual sentiment lexicon tuned for e-commerce reviews.
 * English is the most complete; es/pt/fr/de/ru/vi cover the most frequent words only.
 * Weights are in [-3, 3].
 */
export const LEXICON: Record<string, number> = {
  // English – positive
  good: 1.5, great: 2, excellent: 2.5, perfect: 2.5, perfectly: 2, amazing: 2.5, awesome: 2.5, love: 2.5,
  loved: 2.5, loves: 2, nice: 1.5, beautiful: 2, pretty: 1, happy: 2, satisfied: 2, recommend: 1.8,
  recommended: 1.8, fast: 1, quick: 1, quickly: 0.8, sturdy: 1.8, solid: 1.5, durable: 1.8, comfortable: 1.8,
  cute: 1.5, fantastic: 2.5, wonderful: 2.5, best: 2, works: 0.6, worked: 0.6, worth: 1.5, cheap: -0.3,
  thanks: 1, thank: 1, gorgeous: 2.2, superb: 2.5, fine: 0.8, ok: 0.3, okay: 0.3, decent: 0.8, helpful: 1.2,
  exactly: 0.8, accurate: 1.2, fits: 0.8, soft: 0.8, bright: 0.8, easy: 1.2, well: 0.6, glad: 1.8,
  impressed: 2, flawless: 2.5, lovely: 2, elegant: 1.5, fabulous: 2.5, reliable: 1.8, smooth: 1,
  // English – negative
  bad: -2, terrible: -2.8, horrible: -2.8, awful: -2.8, poor: -2, worst: -3, broken: -2.5, broke: -2.2,
  defective: -2.5, faulty: -2.5, useless: -2.5, disappointed: -2.2, disappointing: -2.2, disappointment: -2.2,
  waste: -2.5, scam: -3, fake: -2.2, flimsy: -2, damaged: -2.3, cracked: -2, ripped: -2, torn: -2,
  slow: -1, late: -1, missing: -1.8, wrong: -1.8, smaller: -0.8, bigger: -0.5, junk: -2.8, garbage: -2.8,
  trash: -2.8, refund: -1.5, return: -0.8, returned: -1.2, dispute: -1.8, cheaply: -1.5,
  fragile: -1.2, uncomfortable: -1.8, smell: -1, smells: -1.2, stinks: -2, ugly: -2, problem: -1.2,
  problems: -1.2, issue: -1, issues: -1, unusable: -2.5, dead: -2, leaking: -2, leaks: -2, rust: -1.5,
  rusty: -1.8, stopped: -1.2, failed: -2, fails: -2, dirty: -1.8, scratched: -1.5, overpriced: -2,
  misleading: -2.2, hate: -2.5, hated: -2.5, annoying: -1.5, difficult: -1, hard: -0.4, weak: -1.3,
  // Spanish
  bueno: 1.5, buena: 1.5, excelente: 2.5, perfecto: 2.5, perfecta: 2.5, genial: 2, encanta: 2.5, recomiendo: 1.8,
  rápido: 1, bonito: 1.8, bonita: 1.8, malo: -2, mala: -2, roto: -2.5, rota: -2.5, defectuoso: -2.5,
  pésimo: -2.8, decepcionado: -2.2, lento: -1, falso: -2.2, mal: -1.5,
  // Portuguese
  bom: 1.5, boa: 1.5, ótimo: 2.2, otimo: 2.2, ótima: 2.2, perfeito: 2.5, recomendo: 1.8, lindo: 1.8, linda: 1.8,
  ruim: -2, péssimo: -2.8, pessimo: -2.8, quebrado: -2.5, quebrada: -2.5, defeito: -2.3,
  // French
  bon: 1.5, bonne: 1.5, parfait: 2.5, parfaite: 2.5, génial: 2.2, recommande: 1.8, magnifique: 2.2, super: 1.5,
  mauvais: -2, mauvaise: -2, cassé: -2.5, cassée: -2.5, déçu: -2.2, décevant: -2.2, nul: -2.5, lent: -1,
  // German
  gut: 1.5, toll: 2, perfekt: 2.5, empfehlen: 1.8, schön: 1.8, schlecht: -2, kaputt: -2.5,
  defekt: -2.5, enttäuscht: -2.2, langsam: -1,
  // Russian
  хорошо: 1.5, хороший: 1.5, хорошее: 1.5, отлично: 2.5, отличный: 2.5, отличное: 2.5, рекомендую: 1.8,
  супер: 1.8, спасибо: 1, плохо: -2, плохой: -2, плохое: -2, сломан: -2.5, сломался: -2.5, брак: -2.5,
  ужасно: -2.8, разочарован: -2.2, долго: -0.8,
  // Vietnamese (single syllables are ambiguous, so only the safer ones)
  tốt: 1.5, đẹp: 1.8, tuyệt: 2.2, ưng: 1.8, thích: 1.5, kém: -2, tệ: -2.5, hỏng: -2.5, lỗi: -2, vỡ: -2.3,
  chậm: -1,
};

/** Multi-word expressions checked before single tokens. */
export const PHRASES: Array<[RegExp, number]> = [
  [/\b(stopped|stop) working\b/g, -2.5],
  [/\b(does ?n[o']?t|did ?n[o']?t|do ?n[o']?t|won'?t|will not|is ?n[o']?t) work(ing)?\b/g, -2.5],
  [/\bnot (as|like) (described|pictured|shown|advertised)\b/g, -2.2],
  [/\bfell apart\b|\bfalls apart\b/g, -2.5],
  [/\bwaste of money\b/g, -2.8],
  [/\b(feels?|looks?|felt|looked) (cheap|flimsy|fragile)\b|\bcheaply made\b/g, -1.8],
  [/\b(highly|strongly) recommend(ed)?\b/g, 2.5],
  [/\bworth (it|the money|every penny)\b/g, 2],
  [/\bas described\b|\bexactly as (pictured|shown|described)\b/g, 1.5],
  [/\bvalue for money\b/g, 1.5],
  [/\bmuy bien\b/g, 1.8],
  [/\bno funciona\b/g, -2.5],
  [/\bnão funciona\b|\bnao funciona\b/g, -2.5],
  [/\bne fonctionne pas\b/g, -2.5],
  [/\bfunktioniert nicht\b/g, -2.5],
  [/(?<!\p{L})не работает(?!\p{L})/gu, -2.5],
  [/(?<!\p{L})thất vọng(?!\p{L})/gu, -2.2],
  [/(?<!\p{L})(không|ko) hoạt động(?!\p{L})/gu, -2.5],
  [/(?<!\p{L})rất tốt(?!\p{L})/gu, 2],
  [/\bsehr gut\b/g, 2],
];

/** Words that shift emphasis to the clause that follows ("ok, but cheap"). */
export const CONTRASTS = new Set(['but', 'however', 'although', 'though', 'pero', 'mas', 'mais', 'aber', 'но', 'nhưng']);

export const NEGATORS = new Set([
  'not', 'no', 'never', "don't", 'dont', "doesn't", 'doesnt', "didn't", 'didnt', "isn't", 'isnt', "wasn't",
  'wasnt', "aren't", "won't", 'hardly', 'barely', 'without', 'nor', 'não', 'nao', 'pas', 'jamais', 'nunca',
  'nicht', 'kein', 'keine', 'не', 'нет', 'không', 'ko', 'chẳng', 'chưa',
]);

export const INTENSIFIERS: Record<string, number> = {
  very: 1.4, really: 1.3, super: 1.4, extremely: 1.6, so: 1.2, totally: 1.3, absolutely: 1.5, too: 1.2,
  muy: 1.4, muito: 1.4, très: 1.4, sehr: 1.4, очень: 1.4, rất: 1.4, quá: 1.3, incredibly: 1.6,
};

/** Languages the lexicon covers well enough to trust a text-based verdict. */
export const LEXICON_LANGUAGES = new Set(['en', 'es', 'pt', 'fr', 'de', 'ru', 'vi', 'und']);
