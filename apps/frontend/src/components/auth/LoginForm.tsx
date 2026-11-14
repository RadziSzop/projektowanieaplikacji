import { useAsyncAction } from '../../hooks/useAsyncAction';
import { useAuth } from '../../hooks/useAuth';
import { useForm } from '../../hooks/useForm';
import { loginSchema } from '../../validation/schemas';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { FormField } from '../ui/FormField';

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const auth = useAuth();
  const { busy, error, run } = useAsyncAction();
  const form = useForm(loginSchema, { email: '', password: '' });

  const submit = form.handleSubmit((credentials) =>
    run(async () => {
      await auth.login(credentials);
      onSuccess();
    }),
  );

  return (
    <form noValidate onSubmit={submit} className="space-y-5">
      <FormField label="Adres e-mail" type="email" autoComplete="email" {...form.field('email')} />
      <FormField
        label="Hasło"
        type="password"
        autoComplete="current-password"
        {...form.field('password')}
      />
      <Alert>{error}</Alert>
      <Button type="submit" full disabled={busy}>
        {busy ? 'Logowanie…' : 'Zaloguj się'}
      </Button>
    </form>
  );
}
