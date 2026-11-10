import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AuthApi } from './api/authApi';
import { useToast } from './components/Toast';
import { useCart } from './hooks/useCart';
import { errorMessage } from './lib/errors';
import type { Order, User } from './types';

export function useShop() {
  const { pathname } = useLocation();
  const [loaded, setLoaded] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const toast = useToast();
  const { clear } = useCart();

  useEffect(() => {
    AuthApi.me()
      .then(setUser)
      .catch((e) => toast(errorMessage(e), 'error'))
      .finally(() => setLoaded(true));
  }, [toast]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  async function logout() {
    try {
      await AuthApi.logout();
      setUser(null);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }
  function completeOrder(result: Order) {
    setOrder(result);
    clear();
  }
  return { loaded, user, setUser, order, completeOrder, logout };
}
