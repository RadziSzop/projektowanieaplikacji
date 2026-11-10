import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { link } from './components/ui';
import Navbar from './components/Navbar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useShop } from './useShop';
import { useCart } from './hooks/useCart';
import { useProducts } from './hooks/useProducts';
import { Shop, Details } from './pages/Shop';
import Cart from './pages/Cart';
import { Checkout, Confirmation } from './pages/Checkout';
import Auth from './pages/Auth';

export default function App() {
  const { loaded, user, setUser, order, completeOrder, logout } = useShop();
  const { count } = useCart();
  const { loading } = useProducts();

  return (
    <>
      <Navbar count={count} user={user} onLogout={logout} />
      <main className="mx-auto max-w-5xl px-6 py-10 sm:py-12">
        <ErrorBoundary>
          {!loaded || loading ? (
            <p role="status">Ładowanie…</p>
          ) : (
            <Routes>
              <Route path="/" element={<Shop />} />
              <Route path="/produkt/:id" element={<Details />} />
              <Route path="/koszyk" element={<Cart user={user} />} />
              <Route
                path="/zamowienie"
                element={
                  !user ? (
                    <Navigate to="/logowanie" state={{ from: '/zamowienie' }} replace />
                  ) : (
                    <Checkout user={user} onOrder={completeOrder} />
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
        </ErrorBoundary>
      </main>
    </>
  );
}
