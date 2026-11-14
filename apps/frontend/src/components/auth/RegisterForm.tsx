import { useState } from 'react';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import { useAuth } from '../../hooks/useAuth';
import { useForm } from '../../hooks/useForm';
import { registerSchema } from '../../validation/schemas';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { FormField } from '../ui/FormField';

export function RegisterForm() {
  const auth = useAuth();
  const { busy, error, run } = useAsyncAction();
  const [message, setMessage] = useState('');
  const form = useForm(registerSchema, { name: '', email: '', password: '' });

  const submit = form.handleSubmit((payload) =>
    run(async () => {
      setMessage('');
      setMessage(await auth.register(payload));
    }),
  );

  return (
    <form noValidate onSubmit={submit} className="space-y-5">
      <FormField label="Imię" autoComplete="given-name" {...form.field('name')} />
      <FormField label="Adres e-mail" type="email" autoComplete="email" {...form.field('email')} />
      <FormField
        label="Hasło"
        type="password"
        autoComplete="new-password"
        hint="Hasło musi mieć co najmniej 8 znaków."
        {...form.field('password')}
      />
      <Alert>{error}</Alert>
      <Alert tone="info">{message}</Alert>
      <Button type="submit" full disabled={busy}>
        {busy ? 'Zapisywanie…' : 'Utwórz konto'}
      </Button>
    </form>
  );
}
