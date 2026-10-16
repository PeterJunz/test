import type { TFunction } from '../../i18n/context';
import type { ReviewTag } from '../../types/review';
import type { Caution, SummaryItem } from './insights';

export function tagText(tag: ReviewTag, t: TFunction): string {
  return t(`tag.${tag}`);
}

export function formatSummaryItem(item: SummaryItem, t: TFunction): string {
  return t('summary.item', { label: tagText(item.tag, t), count: item.count, total: item.withText, pct: Math.round(item.share * 100) });
}

export function formatCaution(c: Caution, t: TFunction): string {
  switch (c.kind) {
    case 'small-sample':
      return t('caution.smallSample', { total: c.total });
    case 'little-text':
      return t('caution.littleText', { noText: c.noText, total: c.total, withText: c.withText });
    case 'non-english':
      return t('caution.nonEnglish', { count: c.count });
    case 'functional-problems':
      return t('caution.functional');
  }
}
