import { generateDemoDataset } from '../services/data-providers/demoProvider';
import { useApp } from './appContext';
import { useI18n } from '../i18n/context';

export function useLoadDemo() {
  const { saveDataset, setActiveDataset, notify } = useApp();
  const { t } = useI18n();
  return async () => {
    const generated = generateDemoDataset({ seed: Date.now() % 100000 });
    const dataset = {
      ...generated,
      name: t('demo.datasetName', { id: generated.productId ?? '' }),
      sourceLabel: t('demo.sourceLabel'),
      notes: [t('demo.note1'), t('demo.note2')],
    };
    await saveDataset(dataset);
    setActiveDataset(dataset.id);
    notify('info', t('demo.loaded'));
  };
}
