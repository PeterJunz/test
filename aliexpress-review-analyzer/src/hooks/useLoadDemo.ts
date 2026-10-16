import { generateDemoDataset } from '../services/data-providers/demoProvider';
import { useApp } from './appContext';

export function useLoadDemo() {
  const { saveDataset, setActiveDataset, notify } = useApp();
  return async () => {
    const dataset = generateDemoDataset({ assetBaseUrl: new URL(import.meta.env.BASE_URL, window.location.origin).toString(), seed: Date.now() % 100000 });
    await saveDataset(dataset);
    setActiveDataset(dataset.id);
    notify('info', 'Demo dataset loaded. It is synthetic and clearly labelled as DEMO.');
  };
}
