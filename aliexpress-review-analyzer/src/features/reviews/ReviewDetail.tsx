import { ExternalLink, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Review } from '../../types/review';
import { useI18n } from '../../i18n/context';
import { countryFlag, countryName } from '../../utils/country';
import { formatDate } from '../../utils/date';
import { languageName } from '../../utils/language';
import { Badge, SentimentBadge, Stars } from '../../components/ui';
import { Lightbox, Thumb, VideoPreview } from './media';

export function ReviewDetail({ review, onClose }: { review: Review; onClose(): void }) {
  const { t, lang, locale } = useI18n();
  const [lightbox, setLightbox] = useState<number | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && lightbox === null && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, lightbox]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <aside role="dialog" aria-modal="true" aria-label={t('detail.aria')} className="flex h-full w-full max-w-lg flex-col border-l border-line bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div className="flex items-center gap-3">
            <Stars rating={review.rating} size={16} />
            <span className="text-sm text-ink-2">{formatDate(review.date, locale)}</span>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-ink-3 hover:bg-surface-3 hover:text-ink" aria-label={t('detail.close')}>
            <X className="size-5" />
          </button>
        </header>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 scrollbar-thin">
          <section>
            <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-3">{t('detail.customerReview')}</h3>
            {review.text ? (
              // Rendered as plain text (React escapes it). whitespace-pre-line keeps line breaks.
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink">{review.text}</p>
            ) : (
              <p className="text-sm italic text-ink-3">{t('detail.noText')}</p>
            )}
          </section>

          {review.images.length > 0 && (
            <section>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-3">{t('detail.photos', { count: review.images.length })}</h3>
              <div className="grid grid-cols-4 gap-2">
                {review.images.map((src, i) => (
                  <Thumb key={src} src={src} alt={t('media.photoN', { n: i + 1 })} size="lg" onClick={() => setLightbox(i)} />
                ))}
              </div>
            </section>
          )}
          {review.videos.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">{t('detail.videos', { count: review.videos.length })}</h3>
              {review.videos.map((v) => (
                <VideoPreview key={v} src={v} />
              ))}
            </section>
          )}

          <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-ink-3">{t('col.country')}</dt>
            <dd>{review.country ? `${countryFlag(review.country)} ${countryName(review.country, lang)}` : '—'}</dd>
            <dt className="text-ink-3">{t('col.variant')}</dt>
            <dd>{review.variant ?? '—'}</dd>
            <dt className="text-ink-3">{t('filters.language')}</dt>
            <dd>
              {languageName(review.language, lang)}
              {review.languageDetected && <span className="ml-1 text-xs text-ink-3">{t('detail.detected')}</span>}
            </dd>
            {review.helpfulCount !== undefined && (
              <>
                <dt className="text-ink-3">{t('detail.helpful')}</dt>
                <dd className="tabular">{review.helpfulCount}</dd>
              </>
            )}
            <dt className="text-ink-3">{t('col.sentiment')}</dt>
            <dd className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <SentimentBadge result={review.sentiment} />
                <span className="text-xs text-ink-3">{t(`method.${review.sentiment.method}`)}</span>
              </div>
              <p className="text-xs text-ink-3">{review.sentiment.reason}</p>
              {review.aiSentiment && (
                <>
                  <div className="flex items-center gap-2">
                    <SentimentBadge result={review.aiSentiment} />
                  </div>
                  <p className="text-xs text-ink-3">AI: {review.aiSentiment.reason}</p>
                </>
              )}
            </dd>
            <dt className="text-ink-3">{t('detail.themes')}</dt>
            <dd className="flex flex-wrap gap-1">
              {review.tags.length ? review.tags.map((tag) => <Badge key={tag}>{t(`tag.${tag}`)}</Badge>) : <span className="text-ink-3">—</span>}
            </dd>
            <dt className="text-ink-3">{t('detail.mentions')}</dt>
            <dd className="flex flex-wrap gap-1">
              {review.aspects.length ? review.aspects.map((a) => <Badge key={a}>{t(`aspect.${a}`)}</Badge>) : <span className="text-ink-3">—</span>}
            </dd>
          </dl>
        </div>
        <footer className="border-t border-line px-5 py-3">
          {review.sourceUrl ? (
            <a href={review.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-ink hover:underline">
              <ExternalLink className="size-4" aria-hidden /> {t('reviews.openOriginal')}
            </a>
          ) : (
            <p className="text-xs text-ink-3">{t('detail.noLink')}</p>
          )}
        </footer>
      </aside>
      {lightbox !== null && <Lightbox images={review.images} index={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}
