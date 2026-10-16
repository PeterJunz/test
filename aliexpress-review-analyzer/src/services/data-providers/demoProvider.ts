import type { Dataset, Review, StarRating } from '../../types/review';
import { daysAgo } from '../../utils/date';
import { randomId, stableId } from '../../utils/hash';
import { buildReview } from '../review-normalizer/normalize';

/**
 * Synthetic data for trying the UI and logic. Every dataset produced here is labelled
 * DEMO and uses placeholder images that say so; nothing here comes from AliExpress.
 */
export const DEMO_LABEL = 'DEMO DATA — synthetic reviews, not from AliExpress';

const TEXTS: Record<StarRating, string[]> = {
  5: [
    'Works perfectly, exactly as described. Fast shipping to my door, arrived in 9 days.',
    'Great quality for the price. Very sturdy and well made. Highly recommend!',
    'Love it! Well packaged, no damage. My daughter uses it every day.',
    'Excellent product, good value for money. Charging is quick and the battery lasts long.',
    'As pictured, nice material, feels solid. Seller answered all my questions.',
    'Arrived early and works great. Easy to use, instructions are simple.',
    'Super happy with this purchase, worth every penny.',
    'Muy bien, llegó rápido y funciona perfecto. Recomiendo.',
    'Produto muito bom, chegou rápido. Recomendo!',
    'Très bon produit, conforme à la description. Livraison rapide.',
    'Отлично, всё работает. Рекомендую!',
  ],
  4: [
    'Good product, works well. Slightly smaller than I expected but fine.',
    'Nice quality, shipping took 3 weeks though. Still satisfied.',
    'Works as described. The plastic feels a bit cheap but it does the job.',
    'Good value for money. Box was a bit crushed but the item was fine.',
    'Decent quality, easy to use. Would buy again.',
  ],
  3: [
    'It is ok. Works, but the material feels cheap and it is louder than expected.',
    'Average quality. Took over a month to arrive.',
    'Size is smaller than described. Works fine otherwise.',
    'Not bad, not great. The lid is hard to close.',
  ],
  2: [
    'Smaller than expected and the plastic is flimsy. Not worth the money.',
    'Stopped working after two weeks. Customer service was slow to answer.',
    'Arrived with a missing charging cable. The product itself is ok.',
    'Poor quality, the button already feels loose.',
  ],
  1: [
    'Does not work at all. Dead on arrival, very disappointed.',
    'Arrived broken, the package was damaged. Waste of money.',
    'Not as described, completely different from the pictures.',
    'Stopped working after 3 days. Poor quality, do not buy.',
    'Never arrived after 2 months. Opened a dispute.',
    'Missing parts and no instructions. Hard to use and the motor is weak.',
    'No funciona, muy mala calidad.',
  ],
};

const COUNTRIES: Array<[string, number]> = [
  ['US', 30], ['BR', 10], ['ES', 9], ['FR', 8], ['RU', 7], ['GB', 6], ['DE', 5], ['PL', 5], ['KR', 4], ['IL', 4], ['CA', 4], ['MX', 4], ['AU', 3], ['NL', 1],
];
const VARIANTS = ['Color: Black', 'Color: White', 'Color: Pink', 'Color: Black / Bundle: with 2 cups', 'Color: Green / Bundle: Standard'];

/** Deterministic PRNG so demo data (and tests) are reproducible. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weighted<T>(rand: () => number, items: Array<[T, number]>): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let x = rand() * total;
  for (const [item, w] of items) {
    x -= w;
    if (x <= 0) return item;
  }
  return items[items.length - 1][0];
}

export function generateDemoDataset(options: { count?: number; seed?: number; assetBaseUrl: string; now?: Date }): Dataset {
  const { count = 240, seed = 42, assetBaseUrl, now = new Date() } = options;
  const rand = mulberry32(seed);
  const datasetId = randomId('ds');
  const productId = '1005000000000000';
  const reviews: Review[] = [];
  for (let i = 0; i < count; i++) {
    const rating = weighted<StarRating>(rand, [[5, 55], [4, 18], [3, 9], [2, 6], [1, 12]]);
    const pool = TEXTS[rating];
    const hasText = rand() > 0.2;
    const text = hasText ? pool[Math.floor(rand() * pool.length)] : '';
    const photoChance = rating <= 2 ? 0.45 : 0.25;
    const images = hasText && rand() < photoChance
      ? Array.from({ length: 1 + Math.floor(rand() * 3) }, () => `${assetBaseUrl.replace(/\/$/, '')}/demo/photo-${1 + Math.floor(rand() * 6)}.svg`)
      : [];
    reviews.push(
      buildReview({
        id: stableId(['demo', datasetId, i]),
        datasetId,
        productId,
        rating,
        text,
        date: daysAgo(Math.floor(rand() * 420), now),
        country: weighted(rand, COUNTRIES),
        variant: VARIANTS[Math.floor(rand() * VARIANTS.length)],
        images: [...new Set(images)],
        videos: [],
        sourceUrl: undefined,
        helpfulCount: Math.floor(rand() * rand() * 30),
      }),
    );
  }
  return {
    id: datasetId,
    name: `${DEMO_LABEL} (product ${productId})`,
    origin: 'demo',
    sourceLabel: 'Built-in demo generator',
    productId,
    createdAt: new Date().toISOString(),
    reviews,
    completeness: 'complete',
    notes: [
      'This dataset is synthetic. Ratings, texts, countries and dates were generated locally to exercise the filters and charts.',
      'Photos are labelled placeholder graphics, not customer photos. The demo contains no video reviews.',
    ],
  };
}
