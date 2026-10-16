import { Database, FileUp, FlaskConical, Plug } from 'lucide-react';
import { useApp } from '../hooks/appContext';
import { useLoadDemo } from '../hooks/useLoadDemo';
import { Button, EmptyState } from './ui';

export function NoDataState() {
  const { navigate } = useApp();
  const loadDemo = useLoadDemo();
  return (
    <EmptyState
      icon={<Database className="size-5" />}
      title="No review data yet"
      actions={
        <>
          <Button variant="primary" icon={<FileUp className="size-4" />} onClick={() => navigate('sources')}>
            Import CSV / JSON
          </Button>
          <Button icon={<Plug className="size-4" />} onClick={() => navigate('settings')}>
            Connect a data provider
          </Button>
          <Button variant="ghost" icon={<FlaskConical className="size-4" />} onClick={loadDemo}>
            Load labelled demo data
          </Button>
        </>
      }
    >
      <p>
        Import a review export you are allowed to use, or connect a licensed review-data API through the bundled proxy, then paste a product URL above. Every number on this dashboard is computed from the data you load — nothing is pre-filled.
      </p>
    </EmptyState>
  );
}
