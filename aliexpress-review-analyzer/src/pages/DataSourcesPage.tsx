import { CircleCheck, CircleDashed, CircleSlash, FileSpreadsheet, FlaskConical, Plug, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../hooks/appContext';
import { Badge, Button, Card, Modal } from '../components/ui';
import { useLoadDemo } from '../hooks/useLoadDemo';
import { ImportWizard } from '../features/import/ImportWizard';
import { useI18n } from '../i18n/context';
import { useConnectionMessage } from '../hooks/useConnectionMessage';

export function DataSourcesPage() {
  const { datasets, activeDataset, setActiveDataset, removeDataset, connection, navigate, notify } = useApp();
  const { t } = useI18n();
  const connectionMessage = useConnectionMessage();
  const loadDemo = useLoadDemo();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const sources = [
    {
      icon: FileSpreadsheet,
      name: t('sources.fileName'),
      status: <Badge tone="pos"><CircleCheck className="size-3" /> {t('sources.ready')}</Badge>,
      body: t('sources.fileBody'),
    },
    {
      icon: Plug,
      name: t('sources.providerName'),
      status:
        connection?.state === 'connected' ? (
          <Badge tone="pos"><CircleCheck className="size-3" /> {t('sources.connected')}</Badge>
        ) : (
          <Badge tone="warn"><CircleDashed className="size-3" /> {t(connection?.state === 'unreachable' ? 'status.unreachable' : 'sources.needsConfig')}</Badge>
        ),
      body: connection ? connectionMessage : t('sources.providerBody'),
      action: <Button size="sm" onClick={() => navigate('settings')}>{t('sources.configure')}</Button>,
    },
    {
      icon: CircleSlash,
      name: t('sources.officialName'),
      status: <Badge><CircleSlash className="size-3" /> {t('sources.notAvailable')}</Badge>,
      body: t('sources.officialBody'),
    },
    {
      icon: FlaskConical,
      name: t('sources.demoName'),
      status: <Badge tone="warn">{t('sources.synthetic')}</Badge>,
      body: t('sources.demoBody'),
      action: <Button size="sm" onClick={loadDemo}>{t('sources.loadDemo')}</Button>,
    },
  ];

  const target = datasets.find((d) => d.id === confirmDelete);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('nav.sources')}</h1>
        <p className="text-sm text-ink-3">{t('sources.subtitle')}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        {sources.map(({ icon: Icon, name, status, body, action }) => (
          <div key={name} className="flex flex-col rounded-xl border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-2">
              <Icon className="size-5 text-ink-2" aria-hidden />
              {status}
            </div>
            <h3 className="mt-3 text-sm font-semibold">{name}</h3>
            <p className="mt-1 flex-1 text-xs leading-relaxed text-ink-2">{body}</p>
            {action && <div className="mt-3">{action}</div>}
          </div>
        ))}
      </div>

      <Card title={t('sources.importTitle')} subtitle={t('sources.importSub')}>
        <ImportWizard />
      </Card>

      <Card title={t('sources.savedTitle')} subtitle={t('sources.savedSub')}>
        {datasets.length ? (
          <ul className="divide-y divide-line">
            {datasets.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {d.origin === 'demo' && <Badge tone="warn">DEMO</Badge>} {d.name}
                  </p>
                  <p className="text-xs text-ink-3">
                    {t('stat.reviews', { count: d.reviews.length })} · {t(`origin.${d.origin}`)} · {t(`completeness.${d.completeness}`)} · {new Date(d.createdAt).toLocaleString()}
                    {d.ai && ` · ${t('sources.aiAnalysed')}`}
                  </p>
                </div>
                {activeDataset?.id === d.id ? (
                  <Badge tone="brand">{t('sources.active')}</Badge>
                ) : (
                  <Button size="sm" onClick={() => setActiveDataset(d.id)}>
                    {t('sources.open')}
                  </Button>
                )}
                <Button size="sm" variant="ghost" aria-label={t('sources.deleteAria', { name: d.name })} icon={<Trash2 className="size-4" />} onClick={() => setConfirmDelete(d.id)} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-3">{t('sources.noDatasets')}</p>
        )}
      </Card>

      <Modal
        open={Boolean(target)}
        onClose={() => setConfirmDelete(null)}
        title={t('sources.deleteTitle')}
        footer={
          <>
            <Button onClick={() => setConfirmDelete(null)}>{t('common.cancel')}</Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (!target) return;
                await removeDataset(target.id);
                setConfirmDelete(null);
                notify('info', t('sources.deleted', { name: target.name }));
              }}
            >
              {t('common.delete')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">
          {t('sources.deleteBody', { name: target?.name ?? '', count: target?.reviews.length ?? 0 })}
        </p>
      </Modal>
    </div>
  );
}
