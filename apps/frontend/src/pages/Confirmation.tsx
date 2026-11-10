import { useLocation } from 'react-router-dom';
import { OrderKeys } from '../components/checkout/OrderKeys';
import { PageLayout } from '../components/layout/PageLayout';
import type { Order } from '../types';

export default function Confirmation() {
  const order: Order | null = useLocation().state?.order ?? null;
  return (
    <PageLayout title={order ? 'Zamówienie złożone' : 'Brak zamówienia'} width="medium" back>
      {order && <OrderKeys order={order} />}
    </PageLayout>
  );
}
