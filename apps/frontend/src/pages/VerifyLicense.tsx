import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { button, Field, panel } from '../components/ui';

const results = {
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
  const [status, setStatus] = useState<keyof typeof results | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !key.trim()) return;
    setBusy(true);
    setStatus(null);
    setError('');
    try {
      const response = await api<{ status: string }>(
        'licenses/verify',
        { key: key.trim() },
        AbortSignal.timeout(6000),
      );
      if (!response || !Object.hasOwn(results, response.status))
        throw new Error('Invalid response');
      setStatus(response.status as keyof typeof results);
    } catch {
      setError('Nie udało się sprawdzić licencji. Spróbuj ponownie za chwilę.');
    } finally {
      setBusy(false);
    }
  }

  const result = status ? results[status] : null;
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">Sprawdź licencję</h1>
      <p className="mb-7 text-sm leading-6 text-zinc-400">
        Wklej klucz z wiadomości e-mail, aby sprawdzić jego aktualny status. Nie musisz się logować.
      </p>
      <form onSubmit={submit} className={panel + ' space-y-5'} aria-busy={busy}>
        <Field
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
          required
          disabled={busy}
        />
        <button className={button + ' w-full'} disabled={busy || !key.trim()}>
          {busy ? 'Sprawdzanie…' : 'Sprawdź licencję'}
        </button>
        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}
      </form>
      <div role="status" aria-live="polite" aria-atomic="true" className="mt-5">
        {result && (
          <div className={'rounded-lg border p-5 ' + result.color}>
            <h2 className="font-semibold">{result.title}</h2>
            <p className="mt-1 text-sm leading-6">{result.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}
