import { useForm } from '../../hooks/useForm';
import type { BuyerDetails, User } from '../../types';
import { buyerSchema } from '../../validation/schemas';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { FormField } from '../ui/FormField';
import { Section } from '../ui/Panel';

type Props = {
  user: User;
  busy: boolean;
  error: string;
  onSubmit: (buyer: BuyerDetails) => void;
};

export function BuyerForm({ user, busy, error, onSubmit }: Props) {
  const form = useForm(buyerSchema, {
    name: user.name,
    email: user.email,
    address: '',
    postcode: '',
    city: '',
  });

  return (
    <Section title="Dane kupującego">
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField label="Imię i nazwisko" autoComplete="name" {...form.field('name')} />
        <FormField
          label="Adres e-mail"
          type="email"
          autoComplete="email"
          {...form.field('email')}
        />
        <FormField label="Ulica i numer" autoComplete="street-address" {...form.field('address')} />
        <FormField
          label="Kod pocztowy"
          autoComplete="postal-code"
          placeholder="00-001"
          inputMode="numeric"
          {...form.field('postcode')}
        />
        <FormField label="Miejscowość" autoComplete="address-level2" {...form.field('city')} />
        <Alert>{error}</Alert>
        <Button type="submit" disabled={busy}>
          {busy ? 'Zapisywanie…' : 'Zamów i zapłać'}
        </Button>
      </form>
    </Section>
  );
}
