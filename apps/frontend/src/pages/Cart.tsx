import { Link } from 'react-router-dom';
import { money, type CartProduct, type User } from '../api';
import { button, link, panel, Summary } from '../components';

type Props = {
  items: CartProduct[];
  user: User | null;
  changeQuantity: (id: number, quantity: number) => void;
  remove: (id: number) => void;
};

export default function Cart({ items, user, changeQuantity, remove }: Props) {
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">Koszyk</h1>
      {!items.length ? <p>Koszyk jest pusty. <Link className={link} to="/">Przejdź do sklepu</Link></p> : (
        <div className="space-y-4">
          {items.map(item => (
            <div className={panel + ' flex flex-wrap items-center gap-4'} key={item.id}>
              <div className="flex-1"><Link to={`/produkt/${item.id}`}>Nova {item.name}</Link><p className="text-sm text-zinc-400">{money(item.price)} / szt.</p></div>
              <label className="flex items-center gap-2 text-sm">Ilość
                <select className="rounded border border-zinc-600 bg-zinc-950 p-2" value={item.quantity} onChange={event => changeQuantity(item.id, Number(event.target.value))}>
                  {Array.from({ length: 10 }, (_, i) => <option key={i + 1}>{i + 1}</option>)}
                </select>
              </label>
              <span>{money(item.price * item.quantity)}</span>
              <button className="cursor-pointer text-sm text-red-300 underline" onClick={() => remove(item.id)}>Usuń</button>
            </div>
          ))}
          <Summary items={items} />
          {!user && <p className="text-sm text-zinc-400">Zaloguj się, aby złożyć zamówienie.</p>}
          <Link className={button} to="/zamowienie">{user ? 'Przejdź do zamówienia' : 'Zaloguj się i zamów'}</Link>
        </div>
      )}
    </>
  );
}
