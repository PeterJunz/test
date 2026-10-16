import { Database, FileUp, FlaskConical, Plug } from 'lucide-react';
import { useApp } from '../hooks/appContext';
import { useLoadDemo } from '../hooks/useLoadDemo';
import { useI18n } from '../i18n/context';
import { Button, EmptyState } from './ui';

export function NoDataState() {
  const { navigate } = useApp();
  const { t } = useI18n();
  const loadDemo = useLoadDemo();
  return (
    <EmptyState
      icon={<Database className="size-5" />}
      title={t('empty.title')}
      actions={
        <>
          <Button variant="primary" icon={<FileUp className="size-4" />} onClick={() => navigate('sources')}>
            {t('empty.import')}
          </Button>
          <Button icon={<Plug className="size-4" />} onClick={() => navigate('settings')}>
            {t('empty.connect')}
          </Button>
          <Button variant="ghost" icon={<FlaskConical className="size-4" />} onClick={loadDemo}>
            {t('empty.demo')}
          </Button>
        </>
      }
    >
      <p>{t('empty.body')}</p>
    </EmptyState>
  );
}
