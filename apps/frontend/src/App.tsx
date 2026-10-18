import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api, readCart, type CartItem, type Order, type Product, type User } from './api';
import { link } from './components';
import { Shop, Details } from './pages/Shop';
import Cart from './pages/Cart';
import { Checkout, Confirmation } from './pages/Checkout';
import Auth from './pages/Auth';

export default function App() {
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

  return (
    <>
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            Sklep z kluczami
          </Link>
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `rounded-md px-3 py-2 ${isActive ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`
              }
            >
              Sklep
            </NavLink>
            <NavLink
              to="/koszyk"
              className={({ isActive }) =>
                `rounded-md px-3 py-2 ${isActive ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`
              }
            >
              Koszyk ({count})
            </NavLink>
            {user ? (
              <button
                className="cursor-pointer px-3 py-2 text-zinc-400 hover:text-white"
                onClick={logout}
              >
                Wyloguj ({user.name})
              </button>
            ) : (
              <Link
                className="rounded-md border border-zinc-700 px-3 py-2 hover:bg-zinc-800"
                to="/logowanie"
              >
                Zaloguj się
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10 sm:py-12">
        {message && (
          <p
            role="status"
            className="mb-6 rounded-lg border border-zinc-700 px-4 py-3 text-sm text-zinc-300"
          >
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="mb-6 text-sm text-red-300">
            {error}
          </p>
        )}
        {!loaded ? (
          <p role="status">Ładowanie…</p>
        ) : (
          <Routes>
            <Route path="/" element={<Shop products={products} add={add} />} />
            <Route path="/produkt/:id" element={<Details products={products} add={add} />} />
            <Route
              path="/koszyk"
              element={
                <Cart
                  items={items}
                  user={user}
                  changeQuantity={changeQuantity}
                  remove={(id) => setCart(cart.filter((item) => item.id !== id))}
                />
              }
            />
            <Route
              path="/zamowienie"
              element={
                !user ? (
                  <Navigate to="/logowanie" state={{ from: '/zamowienie' }} replace />
                ) : (
                  <Checkout
                    items={items}
                    user={user}
                    onOrder={(result) => {
                      setOrder(result);
                      setCart([]);
                    }}
                  />
                )
              }
            />
            <Route
              path="/logowanie"
              element={<Auth key="login" register={false} onLogin={setUser} />}
            />
            <Route
              path="/rejestracja"
              element={<Auth key="register" register onLogin={setUser} />}
            />
            <Route path="/gotowe" element={<Confirmation order={order} />} />
            <Route
              path="*"
              element={
                <>
                  <h1 className="mb-4 text-2xl font-semibold">Nie znaleziono strony</h1>
                  <Link className={link} to="/">
                    Wróć do sklepu
                  </Link>
                </>
              }
            />
          </Routes>
        )}
      </main>
    </>
  );
}
