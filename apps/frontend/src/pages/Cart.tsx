import { CartRow } from '../components/cart/CartRow';
import { EmptyCart } from '../components/cart/EmptyCart';
import { OrderSummary } from '../components/cart/OrderSummary';
import { PageLayout } from '../components/layout/PageLayout';
import { ButtonLink } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';

export default function Cart() {
  const { user } = useAuth();
  const { items, changeQuantity, remove } = useCart();
  return (
    <PageLayout title="Koszyk">
      {!items.length ? (
        <EmptyCart />
      ) : (
        <div className="space-y-6">
          {items.map((item) => (
            <CartRow
              key={item.id}
              item={item}
              onQuantityChange={(quantity) => changeQuantity(item.id, quantity)}
              onRemove={() => remove(item.id)}
            />
          ))}
          <OrderSummary items={items} />
          {!user && <p className="text-sm text-zinc-400">Zaloguj się, aby złożyć zamówienie.</p>}
          <ButtonLink to="/zamowienie">
            {user ? 'Przejdź do zamówienia' : 'Zaloguj się i zamów'}
          </ButtonLink>
        </div>
      )}
    </PageLayout>
  );
}
