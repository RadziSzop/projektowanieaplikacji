import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AuthApi } from './api/authApi';
import { ProductApi } from './api/productApi';
import { useToast } from './components/Toast';
import { errorMessage } from './lib/errors';
import type { CartItem, Order, Product, User } from './types';

function readCart(): CartItem[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem('koszyk') || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export function useShop() {
  const { pathname } = useLocation();
  const [products, setProducts] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [cart, setCart] = useState<CartItem[]>(readCart);
  const [order, setOrder] = useState<Order | null>(null);
  const toast = useToast();

  useEffect(() => {
    Promise.all([ProductApi.list(), AuthApi.me()])
      .then(([products, user]) => {
        setProducts(products);
        setUser(user);
      })
      .catch((e) => toast(errorMessage(e), 'error'))
      .finally(() => setLoaded(true));
  }, [toast]);
  useEffect(() => {
    localStorage.setItem('koszyk', JSON.stringify(cart));
  }, [cart]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  function add(product: Product) {
    const current = cart.find((item) => item.id === product.id);
    if (current && current.quantity >= 10) {
      toast('Maksymalnie 10 sztuk produktu.', 'error');
      return;
    }
    setCart(
      current
        ? cart.map((item) =>
            item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
          )
        : [...cart, { id: product.id, quantity: 1 }],
    );
    toast(`Dodano Nova ${product.name} do koszyka.`);
  }
  function changeQuantity(id: number, quantity: number) {
    setCart(cart.map((item) => (item.id === id ? { ...item, quantity } : item)));
  }
  async function logout() {
    try {
      await AuthApi.logout();
      setUser(null);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }
  const items = cart.flatMap((item) => {
    const product = products.find((p) => p.id === item.id);
    return product ? [{ ...product, quantity: item.quantity }] : [];
  });
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);

  function remove(id: number) {
    setCart(cart.filter((item) => item.id !== id));
  }
  function completeOrder(result: Order) {
    setOrder(result);
    setCart([]);
  }
  return {
    products,
    loaded,
    user,
    setUser,
    order,
    items,
    count,
    add,
    changeQuantity,
    remove,
    completeOrder,
    logout,
  };
}
