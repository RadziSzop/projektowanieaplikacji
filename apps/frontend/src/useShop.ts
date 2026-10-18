import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api, readCart, type CartItem, type Order, type Product, type User } from './api';

export function useShop() {
  const { pathname } = useLocation();
  const [products, setProducts] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [cart, setCart] = useState<CartItem[]>(readCart);
  const [order, setOrder] = useState<Order | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api<Product[]>('products'), api<User | null>('me')])
      .then(([products, user]) => {
        setProducts(products);
        setUser(user);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true));
  }, []);
  useEffect(() => {
    localStorage.setItem('koszyk', JSON.stringify(cart));
  }, [cart]);
  useEffect(() => {
    window.scrollTo(0, 0);
    setMessage('');
  }, [pathname]);

  function add(product: Product) {
    const current = cart.find((item) => item.id === product.id);
    if (current && current.quantity >= 10) {
      setMessage('Maksymalnie 10 sztuk produktu.');
      return;
    }
    setCart(
      current
        ? cart.map((item) =>
            item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
          )
        : [...cart, { id: product.id, quantity: 1 }],
    );
    setMessage(`Dodano Nova ${product.name} do koszyka.`);
  }
  function changeQuantity(id: number, quantity: number) {
    setCart(cart.map((item) => (item.id === id ? { ...item, quantity } : item)));
  }
  async function logout() {
    try {
      await api('logout', {});
      setUser(null);
    } catch (e) {
      setError((e as Error).message);
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
    message,
    error,
    items,
    count,
    add,
    changeQuantity,
    remove,
    completeOrder,
    logout,
  };
}
