import { ChevronLeft, ChevronRight, ExternalLink, ImageOff, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/context';

/** Review photo thumbnail. Loads from the source URL only; shows a notice if it fails. */
export function Thumb({ src, alt, onClick, size = 'md' }: { src: string; alt: string; onClick?(): void; size?: 'sm' | 'md' | 'lg' }) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  const dims = size === 'sm' ? 'size-10' : size === 'lg' ? 'size-full aspect-square' : 'size-16';
  if (failed) {
    return (
      <span className={`${dims} flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-line-strong bg-surface-2 text-[9px] text-ink-3`} title={t('media.couldNotLoad', { src })}>
        <ImageOff className="size-3.5" aria-hidden />
        {t('media.unavailable')}
      </span>
    );
  }
  return (
    <button type="button" onClick={onClick} className={`${dims} shrink-0 overflow-hidden rounded-md border border-line bg-surface-2 hover:ring-2 hover:ring-brand`} aria-label={t('media.enlarge', { alt })}>
      <img src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="size-full object-cover" />
    </button>
  );
}

export function Lightbox({ images, index, onClose, caption }: { images: string[]; index: number; onClose(): void; caption?: string }) {
  const { t } = useI18n();
  const [i, setI] = useState(index);
  const [failed, setFailed] = useState<Set<number>>(new Set());
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((x) => (x + 1) % images.length);
      if (e.key === 'ArrowLeft') setI((x) => (x - 1 + images.length) % images.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [images.length, onClose]);
  const src = images[i];
  return (
    <div role="dialog" aria-modal="true" aria-label={t('media.reviewPhoto')} className="fixed inset-0 z-[60] flex flex-col bg-black/90" onClick={onClose}>
      <div className="flex items-center justify-between px-5 py-3 text-sm text-white/80" onClick={(e) => e.stopPropagation()}>
        <span className="tabular">
          {t('media.photoOf', { n: i + 1, total: images.length })}
          {caption && <span className="ml-3 text-white/60">{caption}</span>}
        </span>
        <div className="flex items-center gap-2">
          <a href={src} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-white/10">
            <ExternalLink className="size-4" aria-hidden /> {t('media.openOriginal')}
          </a>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 hover:bg-white/10" aria-label={t('common.close')}>
            <X className="size-5" />
          </button>
        </div>
      </div>
      <div className="relative flex flex-1 items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
        {images.length > 1 && (
          <button type="button" className="absolute left-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" onClick={() => setI((x) => (x - 1 + images.length) % images.length)} aria-label={t('media.prev')}>
            <ChevronLeft className="size-6" />
          </button>
        )}
        {failed.has(i) ? (
          <div className="flex flex-col items-center gap-2 text-white/70">
            <ImageOff className="size-10" aria-hidden />
            <p>{t('media.loadFailed')}</p>
          </div>
        ) : (
          <img src={src} alt={t('media.photoN', { n: i + 1 })} referrerPolicy="no-referrer" onError={() => setFailed((s) => new Set(s).add(i))} className="max-h-full max-w-full rounded-lg object-contain" />
        )}
        {images.length > 1 && (
          <button type="button" className="absolute right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" onClick={() => setI((x) => (x + 1) % images.length)} aria-label={t('media.next')}>
            <ChevronRight className="size-6" />
          </button>
        )}
      </div>
    </div>
  );
}

const PLAYABLE = /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i;

export function VideoPreview({ src }: { src: string }) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  if (!PLAYABLE.test(src) || failed) {
    return (
      <a href={src} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-ink-2 hover:bg-surface-2">
        <ExternalLink className="size-4" aria-hidden /> {t(failed ? 'media.videoFailed' : 'media.openVideo')}
      </a>
    );
  }
  return <video src={src} controls preload="metadata" className="max-h-80 w-full rounded-lg bg-black" onError={() => setFailed(true)} />;
}
