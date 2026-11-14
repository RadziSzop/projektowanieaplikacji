import { EmptyCart } from '../components/cart/EmptyCart';
import { OrderSummary } from '../components/cart/OrderSummary';
import { BuyerForm } from '../components/checkout/BuyerForm';
import { PageLayout } from '../components/layout/PageLayout';
import { useAuth } from '../hooks/useAuth';
import { useCheckout } from '../hooks/useCheckout';

export default function Checkout() {
  const user = useAuth().user!;
  const { items, busy, error, placeOrder } = useCheckout();

  return (
    <PageLayout title="Zamówienie">
      {!items.length ? (
        <EmptyCart />
      ) : (
        <div className="grid items-start gap-6 md:grid-cols-2">
          <BuyerForm user={user} busy={busy} error={error} onSubmit={placeOrder} />
          <OrderSummary items={items} />
        </div>
      )}
    </PageLayout>
  );
}
