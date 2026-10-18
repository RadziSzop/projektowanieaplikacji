import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { link } from './components/ui';
import Navbar from './components/Navbar';
import { useShop } from './useShop';
import { Shop, Details } from './pages/Shop';
import Cart from './pages/Cart';
import { Checkout, Confirmation } from './pages/Checkout';
import Auth from './pages/Auth';

export default function App() {
  const {
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
  } = useShop();

  return (
    <>
      <Navbar count={count} user={user} onLogout={logout} />
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
          <p
            role="alert"
            className="mb-6 rounded-lg border border-red-900/60 bg-red-950/20 px-4 py-3 text-sm text-red-300"
          >
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
                <Cart items={items} user={user} changeQuantity={changeQuantity} remove={remove} />
              }
            />
            <Route
              path="/zamowienie"
              element={
                !user ? (
                  <Navigate to="/logowanie" state={{ from: '/zamowienie' }} replace />
                ) : (
                  <Checkout items={items} user={user} onOrder={completeOrder} />
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
