import { useNavigate } from 'react-router-dom';
import { OrderApi } from '../api/orderApi';
import type { BuyerDetails } from '../types';
import { useAsyncAction } from './useAsyncAction';
import { useCart } from './useCart';

export function useCheckout() {
  const { items, clear } = useCart();
  const navigate = useNavigate();
  const { busy, error, run } = useAsyncAction();

  function placeOrder(buyer: BuyerDetails) {
    return run(async () => {
      const order = await OrderApi.create({
        ...buyer,
        items: items.map(({ id, quantity }) => ({ id, quantity })),
      });
      clear();
      navigate(`/zamowienia/${order.id}`, { state: { order } });
    });
  }

  return { items, busy, error, placeOrder };
}
