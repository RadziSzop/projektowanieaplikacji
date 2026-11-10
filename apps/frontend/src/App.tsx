import { Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RequireAuth } from './components/RequireAuth';
import { useAuth } from './hooks/useAuth';
import { useProducts } from './hooks/useProducts';
import { useScrollToTop } from './hooks/useScrollToTop';
import { Shop, Details } from './pages/Shop';
import Cart from './pages/Cart';
import { Checkout, Confirmation } from './pages/Checkout';
import Auth from './pages/Auth';
import NotFound from './pages/NotFound';

export default function App() {
  const auth = useAuth();
  const products = useProducts();
  useScrollToTop();

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 py-10 sm:py-12">
        <ErrorBoundary>
          {auth.loading || products.loading ? (
            <p role="status">Ładowanie…</p>
          ) : (
            <Routes>
              <Route path="/" element={<Shop />} />
              <Route path="/produkt/:id" element={<Details />} />
              <Route path="/koszyk" element={<Cart />} />
              <Route
                path="/zamowienie"
                element={
                  <RequireAuth>
                    <Checkout />
                  </RequireAuth>
                }
              />
              <Route path="/logowanie" element={<Auth key="login" register={false} />} />
              <Route path="/rejestracja" element={<Auth key="register" register />} />
              <Route path="/gotowe" element={<Confirmation />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          )}
        </ErrorBoundary>
      </main>
    </>
  );
}
