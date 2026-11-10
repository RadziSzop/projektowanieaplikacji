import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PageLayout } from '../components/layout/PageLayout';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { Panel } from '../components/ui/Panel';
import { TextLink } from '../components/ui/TextLink';
import { useAuth } from '../hooks/useAuth';
import { errorMessage } from '../lib/errors';
import type { RegisterPayload } from '../types';

export default function Auth({ register }: { register: boolean }) {
  const auth = useAuth();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from === '/zamowienie' ? '/zamowienie' : '/';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const data = Object.fromEntries(new FormData(event.currentTarget)) as RegisterPayload;
    try {
      if (register) {
        setMessage(await auth.register(data));
      } else {
        await auth.login(data);
        navigate(from, { replace: true });
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <PageLayout
      title={register ? 'Rejestracja' : 'Logowanie'}
      description={
        from === '/zamowienie'
          ? 'Zaloguj się, aby złożyć zamówienie.'
          : register
            ? 'Podaj dane do utworzenia konta.'
            : 'Wprowadź dane swojego konta.'
      }
      width="narrow"
    >
      <Panel>
        <form onSubmit={submit} className="space-y-5">
          {register && (
            <FormField label="Imię" name="name" autoComplete="given-name" required maxLength={80} />
          )}
          <FormField
            label="Adres e-mail"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={200}
          />
          <FormField
            label="Hasło"
            name="password"
            type="password"
            autoComplete={register ? 'new-password' : 'current-password'}
            hint={register ? 'Hasło musi mieć co najmniej 8 znaków.' : undefined}
            required
            minLength={register ? 8 : 1}
            maxLength={128}
          />
          <Alert>{error}</Alert>
          <Alert tone="info">{message}</Alert>
          <Button type="submit" full disabled={busy}>
            {busy ? 'Zapisywanie…' : register ? 'Utwórz konto' : 'Zaloguj się'}
          </Button>
        </form>
      </Panel>
      <TextLink
        className="block text-center"
        to={register ? '/logowanie' : '/rejestracja'}
        state={{ from }}
      >
        {register ? 'Masz konto? Zaloguj się' : 'Nie masz konta? Zarejestruj się'}
      </TextLink>
    </PageLayout>
  );
}
