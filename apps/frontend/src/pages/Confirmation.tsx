import { useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { OrderApi } from '../api/orderApi';
import { OrderKeys } from '../components/checkout/OrderKeys';
import { OrderProgress } from '../components/checkout/OrderProgress';
import { PageLayout } from '../components/layout/PageLayout';
import { Alert } from '../components/ui/Alert';
import { useResource } from '../hooks/useResource';
import { orderProgress } from '../services/orderStatus';
import type { OrderDetails } from '../types';

const REFRESH_MS = 3000;

export default function Confirmation() {
  const id = Number(useParams().id);
  const placed: OrderDetails | undefined = useLocation().state?.order;
  const {
    data: order,
    error,
    loading,
    reload,
  } = useResource(() => OrderApi.get(id), String(id), placed ?? null);
  const progress = order?.jobs ? orderProgress(order.jobs) : null;

  useEffect(() => {
    if (!progress?.pending) return;
    const timer = setTimeout(reload, REFRESH_MS);
    return () => clearTimeout(timer);
  }, [order, progress?.pending, reload]);

  if (!order)
    return (
      <PageLayout
        title={loading ? 'Ładowanie zamówienia…' : 'Nie znaleziono zamówienia'}
        width="medium"
        back
      >
        <Alert>{error}</Alert>
      </PageLayout>
    );
  return (
    <PageLayout
      title={placed ? 'Zamówienie złożone' : `Zamówienie nr ${order.id}`}
      description="Klucze wysyłamy również na adres e-mail podany w zamówieniu."
      width="medium"
      back
    >
      {progress && <OrderProgress progress={progress} />}
      <OrderKeys order={order} />
      <Alert>{error}</Alert>
    </PageLayout>
  );
}
