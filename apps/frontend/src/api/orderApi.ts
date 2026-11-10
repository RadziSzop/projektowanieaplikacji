import type { Order, OrderPayload } from '../types';
import { post } from './client';

export const OrderApi = {
  create: (payload: OrderPayload) => post<Order>('orders', payload),
};
