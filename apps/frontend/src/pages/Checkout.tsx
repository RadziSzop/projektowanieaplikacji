import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { OrderApi } from '../api/orderApi';
import { OrderSummary } from '../components/cart/OrderSummary';
import { PageLayout } from '../components/layout/PageLayout';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { Panel, Section } from '../components/ui/Panel';
import { TextLink } from '../components/ui/TextLink';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';
import { errorMessage } from '../lib/errors';
import { money } from '../lib/money';
import type { BuyerDetails, Order } from '../types';

export function Checkout() {
  const user = useAuth().user!;
  const { items, clear } = useCart();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    const data = Object.fromEntries(new FormData(event.currentTarget)) as BuyerDetails;
    try {
      const order = await OrderApi.create({
        ...data,
        items: items.map((item) => ({ id: item.id, quantity: item.quantity })),
      });
      clear();
      navigate('/gotowe', { state: { order } });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  if (!items.length)
    return (
      <PageLayout title="Zamówienie">
        <p>
          Koszyk jest pusty. <TextLink to="/">Przejdź do sklepu</TextLink>
        </p>
      </PageLayout>
    );
  return (
    <PageLayout title="Zamówienie">
      <div className="grid items-start gap-6 md:grid-cols-2">
        <Panel>
          <form className="space-y-5" onSubmit={submit}>
            <h2 className="font-semibold">Dane kupującego</h2>
            <FormField
              label="Imię i nazwisko"
              name="name"
              autoComplete="name"
              defaultValue={user.name}
              required
              maxLength={80}
            />
            <FormField
              label="Adres e-mail"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={user.email}
              required
              maxLength={200}
            />
            <FormField
              label="Ulica i numer"
              name="address"
              autoComplete="street-address"
              required
              maxLength={200}
            />
            <FormField
              label="Kod pocztowy"
              name="postcode"
              autoComplete="postal-code"
              placeholder="00-001"
              pattern="[0-9]{2}-[0-9]{3}"
              required
            />
            <FormField
              label="Miejscowość"
              name="city"
              autoComplete="address-level2"
              required
              maxLength={80}
            />
            <Alert>{error}</Alert>
            <Button type="submit" disabled={busy}>
              {busy ? 'Zapisywanie…' : 'Zamów i zapłać'}
            </Button>
          </form>
        </Panel>
        <OrderSummary items={items} />
      </div>
    </PageLayout>
  );
}

export function Confirmation() {
  const order: Order | null = useLocation().state?.order ?? null;
  return (
    <PageLayout title={order ? 'Zamówienie złożone' : 'Brak zamówienia'} width="medium" back>
      {order && (
        <Section title={`Zamówienie nr ${order.id}`}>
          {order.items.map((item) => (
            <div key={item.name}>
              <h3 className="mb-2 font-semibold">Nova {item.name}</h3>
              {item.keys.map((key) => (
                <code className="block break-all text-sm" key={key}>
                  {key}
                </code>
              ))}
            </div>
          ))}
          <p className="border-t border-zinc-700 pt-4 font-semibold">Razem: {money(order.total)}</p>
        </Section>
      )}
    </PageLayout>
  );
}
