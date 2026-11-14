import type { CartItem, CartProduct, Product } from '../types';

const STORAGE_KEY = 'koszyk';
export const MAX_QUANTITY = 10;

function isCartItem(value: unknown): value is CartItem {
  const item = value as CartItem;
  return (
    typeof item?.id === 'number' &&
    Number.isInteger(item.quantity) &&
    item.quantity >= 1 &&
    item.quantity <= MAX_QUANTITY
  );
}

function quantityOf(cart: CartItem[], id: number) {
  return cart.find((item) => item.id === id)?.quantity ?? 0;
}

export const CartService = {
  load(): CartItem[] {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(saved) ? saved.filter(isCartItem) : [];
    } catch {
      return [];
    }
  },

  save(cart: CartItem[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  },

  canAdd(cart: CartItem[], id: number) {
    return quantityOf(cart, id) < MAX_QUANTITY;
  },

  add(cart: CartItem[], id: number): CartItem[] {
    const quantity = quantityOf(cart, id);
    if (quantity >= MAX_QUANTITY) return cart;
    return quantity
      ? cart.map((item) => (item.id === id ? { ...item, quantity: quantity + 1 } : item))
      : [...cart, { id, quantity: 1 }];
  },

  setQuantity(cart: CartItem[], id: number, quantity: number): CartItem[] {
    const safe = Math.min(Math.max(Math.trunc(quantity), 1), MAX_QUANTITY);
    return cart.map((item) => (item.id === id ? { ...item, quantity: safe } : item));
  },

  remove(cart: CartItem[], id: number): CartItem[] {
    return cart.filter((item) => item.id !== id);
  },

  count(cart: CartItem[]) {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  },

  withProducts(cart: CartItem[], products: Product[]): CartProduct[] {
    return cart.flatMap((item) => {
      const product = products.find((p) => p.id === item.id);
      return product ? [{ ...product, quantity: item.quantity }] : [];
    });
  },

  total(items: CartProduct[]) {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  },
};
