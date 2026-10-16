import { Eye, EyeOff, KeyRound, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../hooks/appContext';
import { CANONICAL_FIELDS, FIELD_LABELS, type CanonicalField } from '../services/review-normalizer/fields';
import { EMPTY_SECRETS } from '../services/storage/settings';
import { Button, Card, Field, inputClass, Modal, Toggle } from '../components/ui';
import type { DateOrder } from '../utils/date';

function SecretInput({ value, onChange, placeholder, label }: { value: string; onChange(v: string): void; placeholder?: string; label: string }) {
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
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink" aria-label={show ? 'Hide value' : 'Show value'}>
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function SettingsPage() {
  const { settings, updateSettings, secrets, updateSecrets, connection, checkingConnection, recheckConnection, clearAllData, datasets, notify } = useApp();
  const [confirmWipe, setConfirmWipe] = useState(false);
  const setMap = (field: CanonicalField, value: string) => {
    const next = { ...settings.apiMapping, [field]: value.trim() || undefined };
    updateSettings({ apiMapping: Object.fromEntries(Object.entries(next).filter(([, v]) => v)) });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-ink-3">Data source connection, AI analysis, API keys and privacy.</p>
      </div>

      <Card
        title="Data provider (via local proxy)"
        subtitle="The proxy (npm run server) holds the provider endpoint and key; the browser only talks to the proxy."
        actions={
          <Button size="sm" loading={checkingConnection} icon={<RefreshCw className="size-3.5" />} onClick={recheckConnection}>
            Test connection
          </Button>
        }
      >
        <div className="space-y-4">
          <p className={`rounded-lg px-3 py-2 text-sm ${connection?.state === 'connected' ? 'bg-pos-soft text-pos' : 'bg-surface-2 text-ink-2'}`} role="status">
            {checkingConnection ? 'Checking…' : connection ? connection.message : 'Not checked yet.'}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Proxy URL" hint="Default: http://localhost:8787">
              <input className={inputClass} value={settings.proxyUrl} onChange={(e) => updateSettings({ proxyUrl: e.target.value.trim() })} placeholder="http://localhost:8787" />
            </Field>
            <Field label="Proxy access token" hint="APP_ACCESS_TOKEN from the server’s .env (or the temporary token it printed).">
              <SecretInput label="Proxy access token" value={secrets.accessToken} onChange={(v) => updateSecrets({ accessToken: v })} />
            </Field>
            <Field label="Provider API key (optional)" hint="Only needed if REVIEW_API_KEY is not set on the server. Sent to your proxy, never to anyone else.">
              <SecretInput label="Provider API key" value={secrets.providerKey} onChange={(v) => updateSecrets({ providerKey: v })} placeholder="leave empty to use the server key" />
            </Field>
            <Field label="Max pages per analysis" hint="Caps provider calls (quota/cost). Results beyond this are marked partial.">
              <input type="number" min={1} max={50} className={inputClass} value={settings.maxPages} onChange={(e) => updateSettings({ maxPages: Math.min(50, Math.max(1, Number(e.target.value) || 1)) })} />
            </Field>
          </div>

          <details className="rounded-lg border border-line p-3">
            <summary className="cursor-pointer text-sm font-medium">Response mapping (advanced)</summary>
            <p className="mt-2 text-xs text-ink-3">Leave empty to auto-detect. Paths use dots, e.g. <code>data.reviews</code>. Field names refer to keys inside each review object (nested keys flattened as <code>buyer.country</code>).</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Field label="Path to review list">
                <input className={inputClass} value={settings.reviewsPath} onChange={(e) => updateSettings({ reviewsPath: e.target.value.trim() })} placeholder="auto" />
              </Field>
              <Field label="Path to total review count">
                <input className={inputClass} value={settings.totalPath} onChange={(e) => updateSettings({ totalPath: e.target.value.trim() })} placeholder="optional" />
              </Field>
              <Field label="Rating scale">
                <select className={inputClass} value={settings.ratingScale} onChange={(e) => updateSettings({ ratingScale: e.target.value as 'auto' | '5' | '100' })}>
                  <option value="auto">Auto (1–5, or 20–100)</option>
                  <option value="5">1–5</option>
                  <option value="100">20–100 %</option>
                </select>
              </Field>
              <Field label="Ambiguous date order">
                <select className={inputClass} value={settings.dateOrder} onChange={(e) => updateSettings({ dateOrder: e.target.value as DateOrder })}>
                  <option value="MDY">Month/Day/Year</option>
                  <option value="DMY">Day/Month/Year</option>
                </select>
              </Field>
            </div>
            <div className="mt-3 grid gap-x-4 gap-y-2 md:grid-cols-2">
              {CANONICAL_FIELDS.map((f) => (
                <label key={f} className="flex items-center gap-2 text-[13px]">
                  <span className="w-40 shrink-0 text-ink-2">{FIELD_LABELS[f]}</span>
                  <input className={`${inputClass} h-8 text-[13px]`} value={settings.apiMapping[f] ?? ''} onChange={(e) => setMap(f, e.target.value)} placeholder="auto" />
                </label>
              ))}
            </div>
          </details>
        </div>
      </Card>

      <Card title="AI analysis (Claude, via proxy)" subtitle="Off by default. Nothing is sent unless you enable it, consent, and click “Run AI analysis”.">
        <div className="space-y-4">
          <Toggle checked={settings.aiEnabled} onChange={(v) => updateSettings({ aiEnabled: v, ...(v ? {} : { aiConsent: false }) })} label="Enable AI analysis" description="Adds sentiment with confidence and an evidence-cited summary on the Insights page." />
          {settings.aiEnabled && (
            <>
              <label className="flex items-start gap-2.5 rounded-lg border border-line p-3 text-sm">
                <input type="checkbox" className="mt-0.5 size-4 accent-[var(--brand)]" checked={settings.aiConsent} onChange={(e) => updateSettings({ aiConsent: e.target.checked })} />
                <span className="text-ink-2">
                  I understand that when I run an analysis, the selected reviews’ <strong className="text-ink">text, star rating, variant and an internal ID</strong> are sent through my proxy to Anthropic’s API, and that I am allowed to process this review data with a third-party AI service.
                </span>
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Anthropic API key (optional)" hint="Prefer ANTHROPIC_API_KEY in the server .env. If set here it is sent to your proxy per request.">
                  <SecretInput label="Anthropic API key" value={secrets.anthropicKey} onChange={(v) => updateSecrets({ anthropicKey: v })} placeholder="leave empty to use the server key" />
                </Field>
                <Field label="Summary language">
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

      <Card title={<span className="inline-flex items-center gap-2"><KeyRound className="size-4" /> API keys</span>} subtitle="Keys are never written into source code or exports.">
        <div className="space-y-4">
          <Toggle
            checked={settings.rememberSecrets}
            onChange={(v) => updateSettings({ rememberSecrets: v })}
            label="Remember keys on this device"
            description="Off: keys are kept in session storage and cleared when the tab closes. On: kept in local storage — only use on a private computer."
          />
          <ul className="space-y-1 text-sm text-ink-2">
            <li>Proxy token: {secrets.accessToken ? 'set' : 'not set'}</li>
            <li>Provider key (browser): {secrets.providerKey ? 'set' : 'not set (server key used)'}</li>
            <li>Anthropic key (browser): {secrets.anthropicKey ? 'set' : 'not set (server key used)'}</li>
          </ul>
          <Button
            variant="danger"
            icon={<Trash2 className="size-4" />}
            onClick={() => {
              updateSecrets(EMPTY_SECRETS);
              notify('info', 'All keys removed from this browser.');
            }}
          >
            Forget all keys
          </Button>
        </div>
      </Card>

      <Card title={<span className="inline-flex items-center gap-2"><ShieldCheck className="size-4" /> Privacy & data</span>}>
        <div className="space-y-3 text-sm text-ink-2">
          <ul className="list-disc space-y-1 pl-5">
            <li>Imported and fetched reviews are stored only in this browser (IndexedDB). No analytics or tracking.</li>
            <li>Reviewer names, avatars and account IDs are never imported or stored.</li>
            <li>AliExpress login credentials are never requested or stored. The app does not scrape AliExpress or bypass CAPTCHAs/anti-bot measures.</li>
            <li>Review text is always rendered as plain text, never as HTML.</li>
          </ul>
          <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => setConfirmWipe(true)}>
            Delete all data, history and settings
          </Button>
        </div>
      </Card>

      <Modal
        open={confirmWipe}
        onClose={() => setConfirmWipe(false)}
        title="Delete everything?"
        footer={
          <>
            <Button onClick={() => setConfirmWipe(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={async () => {
                await clearAllData();
                setConfirmWipe(false);
                notify('success', 'All local data, keys and settings were deleted.');
              }}
            >
              Delete everything
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">
          This removes {datasets.length} dataset(s), AI results, saved keys and settings from this browser. Data on your proxy server or provider is not affected.
        </p>
      </Modal>
    </div>
  );
}
