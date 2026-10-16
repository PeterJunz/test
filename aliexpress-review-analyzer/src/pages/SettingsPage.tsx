import { ExternalLink, Eye, EyeOff, KeyRound, Languages, Plug, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../hooks/appContext';
import { useConnectionMessage } from '../hooks/useConnectionMessage';
import { useI18n, type Lang } from '../i18n/context';
import type { MessageKey } from '../i18n/en';
import { AE_LANGUAGES, AE_PAGE_SIZE, isExtensionContext, type AeLanguage } from '../services/data-providers/aliexpressDirectProvider';

const SOURCE_LABEL: Record<'aliexpress' | 'socialcrawl' | 'proxy', MessageKey> = {
  aliexpress: 'settings.srcAe',
  socialcrawl: 'settings.srcSocialcrawl',
  proxy: 'settings.srcProxy',
};
const SOURCE_HINT: Record<'aliexpress' | 'socialcrawl' | 'proxy', MessageKey> = {
  aliexpress: 'settings.srcAeHint',
  socialcrawl: 'settings.srcSocialcrawlHint',
  proxy: 'settings.srcProxyHint',
};
import { CANONICAL_FIELDS, type CanonicalField } from '../services/review-normalizer/fields';
import { EMPTY_SECRETS, MAX_PAGES_LIMIT } from '../services/storage/settings';
import { estimateCredits, SOCIALCRAWL_LANGUAGES, SOCIALCRAWL_SIGNUP_URL, SOCIALCRAWL_PAGE_SIZE, type SocialCrawlLanguage } from '../services/data-providers/socialCrawlProvider';
import { Button, Card, Field, inputClass, Modal, Toggle } from '../components/ui';
import type { DateOrder } from '../utils/date';

function SecretInput({ value, onChange, placeholder, label }: { value: string; onChange(v: string): void; placeholder?: string; label: string }) {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        autoComplete="off"
        spellCheck={false}
        aria-label={label}
        className={`${inputClass} pr-9 font-mono`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.trim())}
      />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink" aria-label={t(show ? 'settings.hideValue' : 'settings.showValue')}>
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function SettingsPage() {
  const { settings, updateSettings, secrets, updateSecrets, connection, checkingConnection, recheckConnection, clearAllData, datasets, notify } = useApp();
  const { t, lang, setLang } = useI18n();
  const connectionMessage = useConnectionMessage();
  const [confirmWipe, setConfirmWipe] = useState(false);
  const setMap = (field: CanonicalField, value: string) => {
    const next = { ...settings.apiMapping, [field]: value.trim() || undefined };
    updateSettings({ apiMapping: Object.fromEntries(Object.entries(next).filter(([, v]) => v)) });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('nav.settings')}</h1>
        <p className="text-sm text-ink-3">{t('settings.subtitle')}</p>
      </div>

      <Card title={<span className="inline-flex items-center gap-2"><Languages className="size-4" /> {t('settings.langTitle')}</span>} subtitle={t('settings.langSub')}>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('lang.switch')}>
          {([
            ['vi', 'Tiếng Việt'],
            ['en', 'English'],
          ] as Array<[Lang, string]>).map(([code, label]) => (
            <label key={code} lang={code} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${lang === code ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line text-ink-2 hover:border-line-strong'}`}>
              <input type="radio" name="ui-language" className="accent-[var(--brand)]" checked={lang === code} onChange={() => setLang(code)} />
              {label}
            </label>
          ))}
        </div>
      </Card>

      <Card
        title={<span className="inline-flex items-center gap-2"><Plug className="size-4" /> {t('settings.sourceTitle')}</span>}
        subtitle={t('settings.sourceSub')}
        actions={
          <Button size="sm" loading={checkingConnection} icon={<RefreshCw className="size-3.5" />} onClick={recheckConnection}>
            {t('settings.test')}
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-2 md:grid-cols-3" role="radiogroup" aria-label={t('settings.sourceTitle')}>
            {(['aliexpress', 'socialcrawl', 'proxy'] as const).map((src) => (
              <label key={src} className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm ${settings.dataSource === src ? 'border-brand bg-brand-soft/50' : 'border-line hover:border-line-strong'}`}>
                <input type="radio" name="data-source" className="mt-0.5 accent-[var(--brand)]" checked={settings.dataSource === src} onChange={() => updateSettings({ dataSource: src })} />
                <span>
                  <span className="block font-medium text-ink">{t(SOURCE_LABEL[src])}</span>
                  <span className="mt-0.5 block text-xs text-ink-3">{t(SOURCE_HINT[src])}</span>
                </span>
              </label>
            ))}
          </div>
          <p className={`rounded-lg px-3 py-2 text-sm ${connection?.state === 'connected' ? 'bg-pos-soft text-pos' : 'bg-surface-2 text-ink-2'}`} role="status">
            {checkingConnection ? t('status.checking') : connection ? connectionMessage : t('settings.notChecked')}
          </p>

          {settings.dataSource === 'aliexpress' && (
            <div className="space-y-4">
              {!isExtensionContext() && (
                <div className="rounded-lg border border-warn-ink/30 bg-warn-soft p-3 text-sm text-warn-ink">
                  <p className="font-medium">{t('settings.aeNeedExt')}</p>
                  <ol className="mt-1.5 list-decimal space-y-0.5 pl-5">
                    <li>{t('settings.aeExt1')}</li>
                    <li>{t('settings.aeExt2')}</li>
                    <li>{t('settings.aeExt3')}</li>
                    <li>{t('settings.aeExt4')}</li>
                  </ol>
                </div>
              )}
              <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-2">{t('settings.aeRules')}</p>
              <Field label={t('settings.scLanguage')} hint={t('settings.aeLanguageHint')}>
                <select className={`${inputClass} max-w-60`} value={settings.aeLanguage} onChange={(e) => updateSettings({ aeLanguage: e.target.value as AeLanguage })}>
                  {AE_LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          {settings.dataSource === 'socialcrawl' && (
            <div className="space-y-4">
              <ol className="list-decimal space-y-1 rounded-lg bg-surface-2 py-2.5 pl-8 pr-3 text-sm text-ink-2">
                <li>
                  {t('settings.scStep1')}{' '}
                  <a href={SOCIALCRAWL_SIGNUP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-ink hover:underline">
                    socialcrawl.dev <ExternalLink className="size-3" />
                  </a>
                </li>
                <li>{t('settings.scStep2')}</li>
                <li>{t('settings.scStep3')}</li>
              </ol>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={t('settings.scKey')} hint={t('settings.scKeyHint')}>
                  <SecretInput label={t('settings.scKey')} value={secrets.socialcrawlKey} onChange={(v) => updateSecrets({ socialcrawlKey: v })} placeholder="sc_…" />
                </Field>
                <Field label={t('settings.scLanguage')} hint={t('settings.scLanguageHint')}>
                  <select className={inputClass} value={settings.socialcrawlLanguage} onChange={(e) => updateSettings({ socialcrawlLanguage: e.target.value as SocialCrawlLanguage })}>
                    {SOCIALCRAWL_LANGUAGES.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t('settings.scSort')}>
                  <select className={inputClass} value={settings.socialcrawlSort} onChange={(e) => updateSettings({ socialcrawlSort: e.target.value as 'default' | 'newest' })}>
                    <option value="newest">{t('sort.newest')}</option>
                    <option value="default">{t('settings.scSortDefault')}</option>
                  </select>
                </Field>
              </div>
              <Toggle checked={settings.rememberSecrets} onChange={(v) => updateSettings({ rememberSecrets: v })} label={t('settings.remember')} description={t('settings.rememberHint')} />
            </div>
          )}

          <Field
            label={t('settings.maxPages')}
            hint={
              settings.dataSource === 'aliexpress'
                ? t('settings.maxPagesAe', { reviews: settings.maxPages * AE_PAGE_SIZE })
                : t('settings.maxPagesEstimate', {
                    reviews: settings.maxPages * SOCIALCRAWL_PAGE_SIZE,
                    credits: estimateCredits(settings.maxPages * SOCIALCRAWL_PAGE_SIZE).credits,
                  })
            }
          >
            <input
              type="number"
              min={1}
              max={MAX_PAGES_LIMIT}
              className={`${inputClass} max-w-40`}
              value={settings.maxPages}
              onChange={(e) => updateSettings({ maxPages: Math.min(MAX_PAGES_LIMIT, Math.max(1, Number(e.target.value) || 1)) })}
            />
          </Field>
        </div>
      </Card>

      {settings.dataSource === 'proxy' && (
      <Card
        title={t('settings.providerTitle')}
        subtitle={t('settings.providerSub')}
      >
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t('settings.proxyUrl')} hint={t('settings.proxyUrlHint')}>
              <input className={inputClass} value={settings.proxyUrl} onChange={(e) => updateSettings({ proxyUrl: e.target.value.trim() })} placeholder="http://localhost:8787" />
            </Field>
            <Field label={t('settings.token')} hint={t('settings.tokenHint')}>
              <SecretInput label={t('settings.token')} value={secrets.accessToken} onChange={(v) => updateSecrets({ accessToken: v })} />
            </Field>
            <Field label={t('settings.providerKey')} hint={t('settings.providerKeyHint')}>
              <SecretInput label={t('settings.providerKey')} value={secrets.providerKey} onChange={(v) => updateSecrets({ providerKey: v })} placeholder={t('settings.useServerKey')} />
            </Field>
          </div>

          <details className="rounded-lg border border-line p-3">
            <summary className="cursor-pointer text-sm font-medium">{t('settings.mapping')}</summary>
            <p className="mt-2 text-xs text-ink-3">{t('settings.mappingHint')}</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Field label={t('settings.reviewsPath')}>
                <input className={inputClass} value={settings.reviewsPath} onChange={(e) => updateSettings({ reviewsPath: e.target.value.trim() })} placeholder={t('settings.auto')} />
              </Field>
              <Field label={t('settings.totalPath')}>
                <input className={inputClass} value={settings.totalPath} onChange={(e) => updateSettings({ totalPath: e.target.value.trim() })} placeholder={t('settings.optional')} />
              </Field>
              <Field label={t('import.ratingScale')}>
                <select className={inputClass} value={settings.ratingScale} onChange={(e) => updateSettings({ ratingScale: e.target.value as 'auto' | '5' | '100' })}>
                  <option value="auto">{t('settings.scaleAuto')}</option>
                  <option value="5">1–5</option>
                  <option value="100">20–100 %</option>
                </select>
              </Field>
              <Field label={t('settings.dateOrder')}>
                <select className={inputClass} value={settings.dateOrder} onChange={(e) => updateSettings({ dateOrder: e.target.value as DateOrder })}>
                  <option value="MDY">{t('settings.mdy')}</option>
                  <option value="DMY">{t('settings.dmy')}</option>
                </select>
              </Field>
            </div>
            <div className="mt-3 grid gap-x-4 gap-y-2 md:grid-cols-2">
              {CANONICAL_FIELDS.map((f) => (
                <label key={f} className="flex items-center gap-2 text-[13px]">
                  <span className="w-40 shrink-0 text-ink-2">{t(`field.${f}`)}</span>
                  <input className={`${inputClass} h-8 text-[13px]`} value={settings.apiMapping[f] ?? ''} onChange={(e) => setMap(f, e.target.value)} placeholder={t('settings.auto')} />
                </label>
              ))}
            </div>
          </details>
        </div>
      </Card>
      )}

      <Card title={t('settings.aiTitle')} subtitle={t('settings.aiSub')}>
        <div className="space-y-4">
          <Toggle checked={settings.aiEnabled} onChange={(v) => updateSettings({ aiEnabled: v, ...(v ? {} : { aiConsent: false }) })} label={t('settings.aiEnable')} description={t('settings.aiEnableHint')} />
          {settings.aiEnabled && (
            <>
              <label className="flex items-start gap-2.5 rounded-lg border border-line p-3 text-sm">
                <input type="checkbox" className="mt-0.5 size-4 accent-[var(--brand)]" checked={settings.aiConsent} onChange={(e) => updateSettings({ aiConsent: e.target.checked })} />
                <span className="text-ink-2">{t('settings.aiConsent')}</span>
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={t('settings.anthropicKey')} hint={t('settings.anthropicKeyHint')}>
                  <SecretInput label={t('settings.anthropicKey')} value={secrets.anthropicKey} onChange={(v) => updateSecrets({ anthropicKey: v })} placeholder={t('settings.useServerKey')} />
                </Field>
                <Field label={t('settings.aiLanguage')}>
                  <select className={inputClass} value={settings.aiLanguage} onChange={(e) => updateSettings({ aiLanguage: e.target.value as 'en' | 'vi' })}>
                    <option value="en">English</option>
                    <option value="vi">Tiếng Việt</option>
                  </select>
                </Field>
              </div>
            </>
          )}
        </div>
      </Card>

      <Card title={<span className="inline-flex items-center gap-2"><KeyRound className="size-4" /> {t('settings.keysTitle')}</span>} subtitle={t('settings.keysSub')}>
        <div className="space-y-4">
          <Toggle checked={settings.rememberSecrets} onChange={(v) => updateSettings({ rememberSecrets: v })} label={t('settings.remember')} description={t('settings.rememberHint')} />
          <ul className="space-y-1 text-sm text-ink-2">
            <li>{t('settings.tokenState', { state: t(secrets.accessToken ? 'settings.set' : 'settings.notSet') })}</li>
            <li>{t('settings.providerKeyState', { state: t(secrets.providerKey ? 'settings.set' : 'settings.notSetServer') })}</li>
            <li>{t('settings.anthropicKeyState', { state: t(secrets.anthropicKey ? 'settings.set' : 'settings.notSetServer') })}</li>
          </ul>
          <Button
            variant="danger"
            icon={<Trash2 className="size-4" />}
            onClick={() => {
              updateSecrets(EMPTY_SECRETS);
              notify('info', t('settings.keysForgotten'));
            }}
          >
            {t('settings.forgetKeys')}
          </Button>
        </div>
      </Card>

      <Card title={<span className="inline-flex items-center gap-2"><ShieldCheck className="size-4" /> {t('settings.privacyTitle')}</span>}>
        <div className="space-y-3 text-sm text-ink-2">
          <ul className="list-disc space-y-1 pl-5">
            <li>{t('settings.privacy1')}</li>
            <li>{t('settings.privacy2')}</li>
            <li>{t('settings.privacy3')}</li>
            <li>{t('settings.privacy4')}</li>
          </ul>
          <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => setConfirmWipe(true)}>
            {t('settings.wipe')}
          </Button>
        </div>
      </Card>

      <Modal
        open={confirmWipe}
        onClose={() => setConfirmWipe(false)}
        title={t('settings.wipeTitle')}
        footer={
          <>
            <Button onClick={() => setConfirmWipe(false)}>{t('common.cancel')}</Button>
            <Button
              variant="danger"
              onClick={async () => {
                await clearAllData();
                setConfirmWipe(false);
                notify('success', t('settings.wiped'));
              }}
            >
              {t('settings.wipeConfirm')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">{t('settings.wipeBody', { count: datasets.length })}</p>
      </Modal>
    </div>
  );
}
