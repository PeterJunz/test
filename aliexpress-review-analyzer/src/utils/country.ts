/** Common spellings seen in review exports, mapped to ISO 3166-1 alpha-2. */
const ALIASES: Record<string, string> = {
  'united states': 'US', 'united states of america': 'US', usa: 'US', 'u.s.': 'US', 'u.s.a.': 'US', america: 'US',
  'united kingdom': 'GB', uk: 'GB', 'great britain': 'GB', england: 'GB', britain: 'GB',
  canada: 'CA', australia: 'AU', 'new zealand': 'NZ', ireland: 'IE', germany: 'DE', deutschland: 'DE',
  france: 'FR', spain: 'ES', españa: 'ES', espana: 'ES', italy: 'IT', italia: 'IT', netherlands: 'NL',
  holland: 'NL', belgium: 'BE', poland: 'PL', polska: 'PL', portugal: 'PT', brazil: 'BR', brasil: 'BR',
  mexico: 'MX', méxico: 'MX', chile: 'CL', colombia: 'CO', argentina: 'AR', peru: 'PE', russia: 'RU',
  'russian federation': 'RU', ukraine: 'UA', belarus: 'BY', kazakhstan: 'KZ', turkey: 'TR', türkiye: 'TR',
  israel: 'IL', 'saudi arabia': 'SA', 'united arab emirates': 'AE', uae: 'AE', egypt: 'EG', morocco: 'MA',
  'south africa': 'ZA', nigeria: 'NG', japan: 'JP', 'south korea': 'KR', korea: 'KR', 'republic of korea': 'KR',
  china: 'CN', taiwan: 'TW', 'hong kong': 'HK', singapore: 'SG', malaysia: 'MY', thailand: 'TH',
  vietnam: 'VN', 'viet nam': 'VN', 'việt nam': 'VN', philippines: 'PH', indonesia: 'ID', india: 'IN',
  pakistan: 'PK', sweden: 'SE', norway: 'NO', denmark: 'DK', finland: 'FI', switzerland: 'CH', austria: 'AT',
  czechia: 'CZ', 'czech republic': 'CZ', slovakia: 'SK', hungary: 'HU', romania: 'RO', bulgaria: 'BG',
  greece: 'GR', croatia: 'HR', serbia: 'RS', slovenia: 'SI', lithuania: 'LT', latvia: 'LV', estonia: 'EE',
};

/** Normalises a country value to an ISO alpha-2 code when recognised. */
export function normalizeCountry(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const value = raw.trim();
  if (!value) return undefined;
  if (/^[a-z]{2}$/i.test(value)) {
    const code = value.toUpperCase();
    return code === 'UK' ? 'GB' : code;
  }
  const alias = ALIASES[value.toLowerCase()];
  if (alias) return alias;
  return value.slice(0, 60);
}

const displayNames = new Map<string, Intl.DisplayNames>();

export function countryName(code: string | undefined, lang = 'en'): string {
  if (!code) return lang === 'vi' ? 'Không rõ' : 'Unknown';
  if (!/^[A-Z]{2}$/.test(code)) return code;
  try {
    if (!displayNames.has(lang)) displayNames.set(lang, new Intl.DisplayNames([lang], { type: 'region' }));
    return displayNames.get(lang)!.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Regional-indicator flag emoji for an alpha-2 code; empty string otherwise. */
export function countryFlag(code: string | undefined): string {
  if (!code || !/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
