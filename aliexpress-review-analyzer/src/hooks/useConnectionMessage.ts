import { useI18n } from '../i18n/context';
import { useApp } from './appContext';

/** Translated connection message; technical details (e.g. network errors) are appended as-is. */
export function useConnectionMessage(): string {
  const { connection } = useApp();
  const { t } = useI18n();
  if (!connection) return t('status.none');
  switch (connection.code) {
    case 'missing-settings':
      return t('conn.missingSettings');
    case 'no-provider':
      return t('conn.noProvider');
    case 'no-key':
      return t('conn.noKey');
    case 'connected':
      return t('conn.connected', { name: connection.providerName ?? t('conn.unnamed') });
    case 'unauthorized':
      return t('conn.unauthorized');
    case 'unreachable':
      return t('conn.unreachable', { detail: connection.message });
    case 'unsupported':
      return t('conn.unsupported');
    case 'sc-connected':
      return t('conn.scConnected');
    case 'sc-missing-key':
      return t('conn.scMissingKey');
    case 'sc-invalid-key':
      return t('conn.scInvalidKey', { detail: connection.message });
    case 'sc-error':
      return t('conn.scError', { detail: connection.message });
    default:
      return connection.message;
  }
}
