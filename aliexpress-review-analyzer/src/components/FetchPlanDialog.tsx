import type { FetchPlan } from '../hooks/useAnalyze';
import { useI18n } from '../i18n/context';
import { Button } from './ui';

/** Seconds per page at the polite direct-fetch rate (1 request/s plus transfer). */
const SECONDS_PER_PAGE = 1.3;

function cost(plan: FetchPlan, pages: number): number {
  return Math.max(0, pages - 1) * plan.creditsPerPage;
}

function minutes(pages: number): number {
  return Math.max(1, Math.round((Math.max(0, pages - 1) * SECONDS_PER_PAGE) / 60));
}

export function PlanBody({ plan }: { plan: FetchPlan }) {
  const { t } = useI18n();
  if (plan.mode === 'time') {
    return (
      <div className="space-y-3 text-sm text-ink-2">
        <p>{t('plan.bodyTime', { total: plan.total, pages: plan.totalPages, minutes: minutes(plan.totalPages) })}</p>
        <p className="text-xs text-ink-3">{t('plan.noteTime')}</p>
      </div>
    );
  }
  const all = cost(plan, plan.totalPages);
  return (
    <div className="space-y-3 text-sm text-ink-2">
      <p>{t('plan.body', { total: plan.total, pages: plan.totalPages, credits: all })}</p>
      {plan.creditsRemaining !== undefined && (
        <p className={plan.creditsRemaining < all ? 'font-medium text-neg' : ''}>
          {t('plan.balance', { count: plan.creditsRemaining })}
          {plan.creditsRemaining < all && ` ${t('plan.notEnough')}`}
        </p>
      )}
      <p className="text-xs text-ink-3">{t('plan.note')}</p>
    </div>
  );
}

export function PlanButtons({ plan, onChoose }: { plan: FetchPlan; onChoose(pages: number): void }) {
  const { t } = useI18n();
  const limitReviews = Math.min(plan.total, plan.pageLimit * Math.ceil(plan.total / plan.totalPages));
  return (
    <>
      <Button onClick={() => onChoose(1)}>{t('plan.stop')}</Button>
      {plan.pageLimit > 1 && plan.pageLimit < plan.totalPages && (
        <Button onClick={() => onChoose(plan.pageLimit)}>
          {plan.mode === 'time'
            ? t('plan.limitTime', { pages: plan.pageLimit, reviews: limitReviews, minutes: minutes(plan.pageLimit) })
            : t('plan.limit', { pages: plan.pageLimit, reviews: limitReviews, credits: cost(plan, plan.pageLimit) })}
        </Button>
      )}
      <Button variant="primary" onClick={() => onChoose(plan.totalPages)}>
        {plan.mode === 'time'
          ? t('plan.allTime', { reviews: plan.total, minutes: minutes(plan.totalPages) })
          : t('plan.all', { reviews: plan.total, credits: cost(plan, plan.totalPages) })}
      </Button>
    </>
  );
}
