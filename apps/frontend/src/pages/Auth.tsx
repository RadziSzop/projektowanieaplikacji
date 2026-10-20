import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api, type User } from '../api';
import { button, Field, link, panel } from '../components/ui';

export default function Auth({
  register,
  onLogin,
}: {
  register: boolean;
  onLogin: (user: User) => void;
}) {
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
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (register) {
        const result = await api<{ message: string }>('register', data);
        setMessage(result.message);
      } else {
        onLogin(await api<User>('login', data));
        navigate(from, { replace: true });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">
        {register ? 'Rejestracja' : 'Logowanie'}
      </h1>
      <p className="mb-7 text-sm text-zinc-400">
        {register ? 'Podaj dane do utworzenia konta.' : 'Wprowadź dane swojego konta.'}
      </p>
      {from === '/zamowienie' && (
        <p className="mb-4 text-sm text-zinc-400">Zaloguj się, aby złożyć zamówienie.</p>
      )}
      <form onSubmit={submit} className={panel + ' space-y-5'}>
        {register && (
          <Field label="Imię" name="name" autoComplete="given-name" required maxLength={80} />
        )}
        <Field
          label="Adres e-mail"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={200}
        />
        <Field
          label="Hasło"
          name="password"
          type="password"
          autoComplete={register ? 'new-password' : 'current-password'}
          required
          minLength={register ? 8 : 1}
          maxLength={128}
        />
        {register && <p className="text-xs text-zinc-400">Hasło musi mieć co najmniej 8 znaków.</p>}
        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
        <button className={button + ' w-full'} disabled={busy}>
          {busy ? 'Zapisywanie…' : register ? 'Utwórz konto' : 'Zaloguj się'}
        </button>
      </form>
      <Link
        className={link + ' mt-6 block text-center'}
        to={register ? '/logowanie' : '/rejestracja'}
        state={{ from }}
      >
        {register ? 'Masz konto? Zaloguj się' : 'Nie masz konta? Zarejestruj się'}
      </Link>
    </div>
  );
}
