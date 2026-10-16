import { CircleCheck, CircleDashed, CircleSlash, FileSpreadsheet, FlaskConical, Plug, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApp } from '../hooks/appContext';
import { AliExpressOpenPlatformProvider } from '../services/data-providers/aliexpressOpenPlatform';
import { Badge, Button, Card, Modal } from '../components/ui';
import { useLoadDemo } from '../hooks/useLoadDemo';
import { ImportWizard } from '../features/import/ImportWizard';

export function DataSourcesPage() {
  const { datasets, activeDataset, setActiveDataset, removeDataset, connection, navigate, notify } = useApp();
  const loadDemo = useLoadDemo();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const official = useMemo(() => new AliExpressOpenPlatformProvider(), []);

  const sources = [
    {
      icon: FileSpreadsheet,
      name: 'File import (CSV / JSON)',
      status: <Badge tone="pos"><CircleCheck className="size-3" /> Ready</Badge>,
      body: 'Import an export you are entitled to use: your own store’s review export, a review app export, or a data provider’s download. Parsed locally.',
    },
    {
      icon: Plug,
      name: 'Licensed data provider (via local proxy)',
      status:
        connection?.state === 'connected' ? (
          <Badge tone="pos"><CircleCheck className="size-3" /> Connected</Badge>
        ) : (
          <Badge tone="warn"><CircleDashed className="size-3" /> {connection?.state === 'unreachable' ? 'Proxy unreachable' : 'Needs configuration'}</Badge>
        ),
      body: connection?.message ?? 'Connect any third-party review API (one you have a plan with) through server/. Configure the endpoint and key on the server.',
      action: <Button size="sm" onClick={() => navigate('settings')}>Configure</Button>,
    },
    {
      icon: CircleSlash,
      name: official.name,
      status: <Badge><CircleSlash className="size-3" /> Not available</Badge>,
      body: official.description,
    },
    {
      icon: FlaskConical,
      name: 'Demo generator',
      status: <Badge tone="warn">Synthetic</Badge>,
      body: 'Creates a clearly labelled synthetic dataset to try the filters and charts. Not real reviews.',
      action: <Button size="sm" onClick={loadDemo}>Load demo</Button>,
    },
  ];

  const target = datasets.find((d) => d.id === confirmDelete);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Data sources & import</h1>
        <p className="text-sm text-ink-3">Where review data can come from, and what each source can actually deliver.</p>
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

      <Card title="Import a review file" subtitle="CSV or JSON · column mapping · validation report before anything is saved">
        <ImportWizard />
      </Card>

      <Card title="Saved datasets" subtitle="Stored in this browser only (IndexedDB)">
        {datasets.length ? (
          <ul className="divide-y divide-line">
            {datasets.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {d.origin === 'demo' && <Badge tone="warn">DEMO</Badge>} {d.name}
                  </p>
                  <p className="text-xs text-ink-3">
                    {d.reviews.length.toLocaleString()} reviews · {d.origin} · {d.completeness} · {new Date(d.createdAt).toLocaleString()}
                    {d.ai && ' · AI analysed'}
                  </p>
                </div>
                {activeDataset?.id === d.id ? (
                  <Badge tone="brand">Active</Badge>
                ) : (
                  <Button size="sm" onClick={() => setActiveDataset(d.id)}>
                    Open
                  </Button>
                )}
                <Button size="sm" variant="ghost" aria-label={`Delete ${d.name}`} icon={<Trash2 className="size-4" />} onClick={() => setConfirmDelete(d.id)} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-3">No datasets yet.</p>
        )}
      </Card>

      <Modal
        open={Boolean(target)}
        onClose={() => setConfirmDelete(null)}
        title="Delete dataset?"
        footer={
          <>
            <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (!target) return;
                await removeDataset(target.id);
                setConfirmDelete(null);
                notify('info', `Deleted “${target.name}”.`);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">
          “{target?.name}” and its {target?.reviews.length.toLocaleString()} reviews will be removed from this browser. This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
