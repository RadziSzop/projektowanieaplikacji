import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useToast } from '../components/Toast';
import { CartService, MAX_QUANTITY } from '../services/cartService';
import type { CartItem, CartProduct, Product } from '../types';
import { useProducts } from './useProducts';

type CartState = {
  items: CartProduct[];
  count: number;
  total: number;
  add: (product: Product) => void;
  changeQuantity: (id: number, quantity: number) => void;
  remove: (id: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const { products } = useProducts();
  const [cart, setCart] = useState<CartItem[]>(CartService.load);

  useEffect(() => CartService.save(cart), [cart]);

  const items = CartService.withProducts(cart, products);

  function add(product: Product) {
    if (!CartService.canAdd(cart, product.id)) {
      toast(`Maksymalnie ${MAX_QUANTITY} sztuk produktu.`, 'error');
      return;
    }
    setCart(CartService.add(cart, product.id));
    toast(`Dodano Nova ${product.name} do koszyka.`);
  }

  const value: CartState = {
    items,
    count: CartService.count(cart),
    total: CartService.total(items),
    add,
    changeQuantity: (id, quantity) => setCart(CartService.setQuantity(cart, id, quantity)),
    remove: (id) => setCart(CartService.remove(cart, id)),
    clear: () => setCart([]),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart wymaga CartProvider.');
  return context;
}
