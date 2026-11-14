import type { Product } from '../types';
import { get } from './client';

export const ProductApi = {
  list: () => get<Product[]>('products'),
};
