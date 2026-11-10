import type { Order, OrderDetails, OrderPayload } from '../types';
import { get, post } from './client';

export const OrderApi = {
  create: (payload: OrderPayload) => post<Order>('orders', payload),
  get: (id: number) => get<OrderDetails>(`orders/${id}`),
};
