/** Canonical fields the importer understands. Only `rating` is required. */
export const CANONICAL_FIELDS = [
  'rating',
  'review_text',
  'review_date',
  'reviewer_country',
  'product_variant',
  'review_images',
  'review_video',
  'source_url',
  'language',
  'helpful_count',
  'product_id',
  'review_id',
] as const;

export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

export type FieldMapping = Partial<Record<CanonicalField, string>>;

export const REQUIRED_FIELDS: CanonicalField[] = ['rating'];

export const FIELD_LABELS: Record<CanonicalField, string> = {
  rating: 'Star rating (1–5)',
  review_text: 'Review text',
  review_date: 'Review date',
  reviewer_country: 'Reviewer country',
  product_variant: 'Product variant / SKU',
  review_images: 'Review image URLs',
  review_video: 'Review video URL(s)',
  source_url: 'Source URL',
  language: 'Language code',
  helpful_count: 'Helpful votes',
  product_id: 'Product ID',
  review_id: 'Original review ID',
};

/**
 * Known column names per field, compared after lower-casing and stripping
 * non-alphanumerics. Includes the field names of common third-party exports.
 */
const SYNONYMS: Record<CanonicalField, string[]> = {
  rating: ['rating', 'stars', 'star', 'starrating', 'score', 'buyereval', 'evalstar', 'reviewrating', 'ratingvalue', 'reviewstar', 'reviewstars'],
  review_text: ['reviewtext', 'text', 'content', 'review', 'comment', 'body', 'feedback', 'buyerfeedback', 'reviewcontent', 'reviewbody', 'message', 'translatedcontent', 'buyertranslationfeedback'],
  review_date: ['reviewdate', 'date', 'createdat', 'created', 'time', 'evaldate', 'reviewtime', 'datepublished', 'publishedat', 'postedat', 'timestamp'],
  reviewer_country: ['reviewercountry', 'country', 'buyercountry', 'countrycode', 'location', 'buyerlocation', 'region'],
  product_variant: ['productvariant', 'variant', 'sku', 'skuinfo', 'option', 'options', 'productoption', 'skuattr', 'color', 'specification'],
  review_images: ['reviewimages', 'images', 'image', 'photos', 'photo', 'pictures', 'imageurls', 'imgs', 'images0', 'reviewphotos'],
  review_video: ['reviewvideo', 'video', 'videos', 'videourl', 'videourls'],
  source_url: ['sourceurl', 'url', 'reviewurl', 'link', 'permalink'],
  language: ['language', 'lang', 'locale', 'reviewlanguage'],
  helpful_count: ['helpfulcount', 'helpful', 'likes', 'upvotes', 'usefulcount', 'helpfulvotes'],
  product_id: ['productid', 'itemid', 'productcode', 'asin'],
  review_id: ['reviewid', 'id', 'evaluationid', 'feedbackid', 'commentid'],
};

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Guesses a mapping from the source's column names. Each column is used at most once. */
export function autoDetectMapping(columns: string[]): FieldMapping {
  const mapping: FieldMapping = {};
  const used = new Set<string>();
  for (const field of CANONICAL_FIELDS) {
    const candidates = SYNONYMS[field];
    const hit =
      columns.find((c) => !used.has(c) && squash(c) === squash(field)) ??
      candidates.map((syn) => columns.find((c) => !used.has(c) && squash(c) === syn)).find(Boolean);
    if (hit) {
      mapping[field] = hit;
      used.add(hit);
    }
  }
  return mapping;
}

export function missingRequired(mapping: FieldMapping): CanonicalField[] {
  return REQUIRED_FIELDS.filter((f) => !mapping[f]);
}
