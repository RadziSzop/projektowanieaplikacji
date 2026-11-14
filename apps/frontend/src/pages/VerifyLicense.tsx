import { useState, type FormEvent } from 'react';
import { LicenseApi } from '../api/licenseApi';
import { PageLayout } from '../components/layout/PageLayout';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { Panel } from '../components/ui/Panel';
import type { LicenseStatus } from '../types';

const TIMEOUT_MS = 6000;

const results: Record<LicenseStatus, { title: string; description: string; color: string }> = {
  VALID: {
    title: 'Licencja jest ważna',
    description: 'Klucz jest poprawny, a licencja jest aktywna.',
    color: 'border-emerald-800 bg-emerald-950/30 text-emerald-200',
  },
  INVALID: {
    title: 'Nieprawidłowy klucz',
    description: 'Sprawdź, czy skopiowano cały klucz z wiadomości e-mail.',
    color: 'border-red-900 bg-red-950/30 text-red-200',
  },
  EXPIRED: {
    title: 'Licencja wygasła',
    description: 'Okres ważności tej licencji już się zakończył.',
    color: 'border-amber-800 bg-amber-950/30 text-amber-200',
  },
  REVOKED: {
    title: 'Licencja została unieważniona',
    description: 'Ten klucz nie uprawnia już do korzystania z licencji.',
    color: 'border-red-900 bg-red-950/30 text-red-200',
  },
};

export default function VerifyLicense() {
  const [key, setKey] = useState('');
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !key.trim()) return;
    setBusy(true);
    setStatus(null);
    setError('');
    try {
      const response = await LicenseApi.verify(key.trim(), AbortSignal.timeout(TIMEOUT_MS));
      if (!response || !Object.hasOwn(results, response.status))
        throw new Error('Invalid response');
      setStatus(response.status);
    } catch {
      setError('Nie udało się sprawdzić licencji. Spróbuj ponownie za chwilę.');
    } finally {
      setBusy(false);
    }
  }

  const result = status ? results[status] : null;
  return (
    <PageLayout
      title="Sprawdź licencję"
      description="Wklej klucz z wiadomości e-mail, aby sprawdzić jego aktualny status. Nie musisz się logować."
      width="medium"
    >
      <Panel>
        <form onSubmit={submit} className="space-y-5" aria-busy={busy}>
          <FormField
            label="Klucz licencyjny"
            name="license-key"
            value={key}
            onChange={(event) => {
              setKey(event.target.value);
              setStatus(null);
              setError('');
            }}
            placeholder="NOVA-…"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={512}
            disabled={busy}
          />
          <Button type="submit" full disabled={busy || !key.trim()}>
            {busy ? 'Sprawdzanie…' : 'Sprawdź licencję'}
          </Button>
          <Alert>{error}</Alert>
        </form>
      </Panel>
      <div role="status" aria-live="polite" aria-atomic="true">
        {result && (
          <div className={`rounded-lg border p-5 ${result.color}`}>
            <h2 className="font-semibold">{result.title}</h2>
            <p className="mt-1 text-sm leading-6">{result.description}</p>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
