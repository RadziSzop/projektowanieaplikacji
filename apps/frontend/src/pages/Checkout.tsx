import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, money, type CartProduct, type Order, type User } from '../api';
import { button, Field, link, panel, Summary } from '../components';

export function Checkout({ items, user, onOrder }: { items: CartProduct[]; user: User; onOrder: (order: Order) => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const order = await api<Order>('orders', { ...data, items: items.map(item => ({ id: item.id, quantity: item.quantity })) });
      onOrder(order);
      navigate('/gotowe');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  if (!items.length) return <p>Koszyk jest pusty. <Link className={link} to="/">Przejdź do sklepu</Link></p>;
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">Zamówienie</h1>
      <div className="grid items-start gap-5 md:grid-cols-2">
        <form className={panel + ' space-y-4'} onSubmit={submit}>
          <h2 className="font-semibold">Dane kupującego</h2>
          <Field label="Imię i nazwisko" name="name" autoComplete="name" defaultValue={user.name} required maxLength={80} />
          <Field label="Adres e-mail" name="email" type="email" autoComplete="email" defaultValue={user.email} required maxLength={200} />
          <Field label="Ulica i numer" name="address" autoComplete="street-address" required maxLength={200} />
          <Field label="Kod pocztowy" name="postcode" autoComplete="postal-code" placeholder="00-001" pattern="[0-9]{2}-[0-9]{3}" required />
          <Field label="Miejscowość" name="city" autoComplete="address-level2" required maxLength={80} />
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <button className={button} disabled={busy}>{busy ? 'Zapisywanie…' : 'Zamów i zapłać'}</button>
        </form>
        <Summary items={items} />
      </div>
    </>
  );
}

export function Confirmation({ order }: { order: Order | null }) {
  return (
    <div className="max-w-xl space-y-5">
      <h1 className="text-2xl font-semibold">{order ? 'Zamówienie złożone' : 'Brak zamówienia'}</h1>
      {order && <div className={panel + ' space-y-4'}>
        <p>Zamówienie nr {order.id}</p>
        {order.items.map(item => <div key={item.name}>
          <h2 className="mb-2 font-semibold">Nova {item.name}</h2>
          {item.keys.map(key => <code className="block break-all text-sm" key={key}>{key}</code>)}
        </div>)}
        <p>Razem: {money(order.total)}</p>
      </div>}
      <Link className={link} to="/">Wróć do sklepu</Link>
    </div>
  );
}
