import { StrictMode, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import './style.css';

type Product = { id: number; name: string; description: string; price: number; features: string[] };
type CartItem = { id: number; quantity: number };
type User = { name: string; email: string };
type Order = { id: number; total: number; items: { name: string; keys: string[] }[] };
const money = (price: number) => (price / 100).toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' });
async function api(path: string, body?: object) {
  const response = await fetch(`/api/${path}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Nie udało się połączyć z serwerem.');
  return data;
}
function readCart(): CartItem[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem('koszyk') || '[]');
    return Array.isArray(saved) ? saved.filter(i => Number.isInteger(i?.id) && Number.isInteger(i?.quantity) && i.quantity > 0 && i.quantity <= 10).slice(0, 3) : [];
  } catch { return []; }
}
function KeyIcon({ small = false }: { small?: boolean }) {
  return <svg width={small ? 20 : 38} height={small ? 20 : 38} viewBox="0 0 40 40" fill="none" aria-hidden="true"><circle cx="25" cy="14" r="9" stroke="currentColor" strokeWidth="2.5" /><path d="m19 21-13 13H2v-5l5-5h5v-5h5" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" /></svg>;
}
function Cover({ product, large = false }: { product: Product; large?: boolean }) {
  return <div className={`cover cover-${product.id} ${large ? 'cover-large' : ''}`}><div className="cover-orbit" /><div className="software-box"><div className="box-top">NOVA <span>↗</span></div><KeyIcon /><div><strong>{product.name}</strong><small>EDYCJA CYFROWA</small></div></div><span className="cover-label">NOVA / {product.name.toUpperCase()}</span></div>;
}
function App() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadError, setLoadError] = useState('');
  const [cart, setCart] = useState<CartItem[]>(readCart);
  const [user, setUser] = useState<User | null>(null);
  const [notice, setNotice] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  useEffect(() => { api('products').then(setProducts).catch(e => setLoadError(e.message)); api('me').then(setUser).catch(() => {}); }, []);
  useEffect(() => { localStorage.setItem('koszyk', JSON.stringify(cart)); }, [cart]);
  useEffect(() => { if (notice) { const timer = setTimeout(() => setNotice(''), 3000); return () => clearTimeout(timer); } }, [notice]);
  const add = (product: Product) => {
    const existing = cart.find(i => i.id === product.id);
    if (existing && existing.quantity >= 10) { setNotice('Możesz dodać maksymalnie 10 sztuk.'); return; }
    setCart(existing ? cart.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i) : [...cart, { id: product.id, quantity: 1 }]);
    setNotice(`Dodano Nova ${product.name} do koszyka`);
  };
  const entries = cart.flatMap(item => { const product = products.find(p => p.id === item.id); return product ? [{ ...product, quantity: item.quantity }] : []; });
  const total = entries.reduce((sum, p) => sum + p.price * p.quantity, 0);
  const count = cart.reduce((sum, p) => sum + p.quantity, 0);
  const summary = <div className="panel summary"><p className="eyebrow">TWOJE ZAMÓWIENIE</p><h2>Podsumowanie</h2>{entries.map(p => <div className="flex justify-between gap-4 text-sm" key={p.id}><span className="muted">Nova {p.name} × {p.quantity}</span><span>{money(p.price * p.quantity)}</span></div>)}<div className="flex justify-between text-sm"><span className="muted">Dostawa cyfrowa</span><span className="text-lime-300">Bezpłatnie</span></div><div className="total"><span>Razem</span><strong>{money(total)}</strong></div><p className="muted text-xs">Cena zawiera VAT. Jednorazowy zakup.</p></div>;
  return <div className="min-h-screen flex flex-col">
    <header><div className="shell flex items-center justify-between gap-4"><Link className="brand" to="/"><span className="brand-symbol"><KeyIcon small /></span>klucz<span className="text-lime-300">.</span></Link><nav className="flex items-center gap-5 sm:gap-8"><NavLink to="/" end>Sklep</NavLink><NavLink to="/koszyk">Koszyk <span className="counter">{count}</span></NavLink>{user ? <button onClick={async () => { try { await api('logout', {}); setUser(null); setNotice('Wylogowano.'); } catch (e) { setNotice((e as Error).message); } }}>Wyloguj <span className="hidden sm:inline">({user.name})</span></button> : <NavLink className="login-link" to="/logowanie">Zaloguj się <span aria-hidden="true">↗</span></NavLink>}</nav></div></header>
    <main className="shell flex-1">
      {notice && <div className="toast" role="status">✓ {notice}</div>}
      {loadError && <p className="error" role="alert">{loadError} Odśwież stronę, aby spróbować ponownie.</p>}
      <Routes>
        <Route path="/" element={<>
          <section className="hero"><div><p className="eyebrow"><span className="status-dot" /> CYFROWE LICENCJE. PROSTY WYBÓR.</p><h1>Dobry program.<br /><span className="muted">Twój klucz do możliwości.</span></h1><p className="hero-description">Wybierz swoją edycję Nova i zacznij działać.<br className="hidden sm:block" /> Jeden zakup, pełna licencja, zero abonamentów.</p><a href="#licencje" className="button inline-flex">Wybierz licencję <span>↓</span></a></div><div className="hero-art" aria-hidden="true"><div className="hero-ring ring-two" /><div className="hero-ring" /><div className="hero-key"><KeyIcon /></div><span className="art-caption">MNIEJ OGRANICZEŃ.<br />WIĘCEJ MOŻLIWOŚCI.</span><span className="art-plus">+</span></div></section>
          <section id="licencje" className="pb-14"><div className="section-heading"><div><p className="eyebrow">JEDEN PROGRAM, TRZY MOŻLIWOŚCI</p><h2>Znajdź swoją edycję</h2></div><span className="muted text-sm">03 licencje do wyboru</span></div>{!products.length && !loadError && <p role="status">Ładowanie licencji…</p>}<div className="grid md:grid-cols-3 gap-5">{products.map(p => <article className={`product ${p.id === 2 ? 'featured' : ''}`} key={p.id}><Link to={`/produkt/${p.id}`} aria-label={`Zobacz Nova ${p.name}`}><Cover product={p} /></Link><div className="product-body"><div className="flex justify-between items-center gap-2"><span className="eyebrow">LICENCJA CYFROWA</span>{p.id === 2 && <span className="badge">NAJCZĘŚCIEJ WYBIERANA</span>}</div><h3><Link to={`/produkt/${p.id}`}>Nova {p.name}</Link></h3><p className="muted product-description">{p.description}</p><ul className="features">{p.features.slice(0, 3).map(f => <li key={f}><span>✓</span>{f}</li>)}</ul><div className="price">{money(p.price)}<span>jednorazowo</span></div><button className={`button w-full ${p.id === 2 ? '' : 'secondary'}`} onClick={() => add(p)}>Dodaj do koszyka <span>+</span></button><Link className="details-link" to={`/produkt/${p.id}`}>Poznaj szczegóły <span>↗</span></Link></div></article>)}</div></section>
          <div className="benefits"><div><span>↗</span><div><strong>Od razu po zakupie</strong><p>Klucz dostępny w podsumowaniu</p></div></div><div><span>◇</span><div><strong>Jednorazowa płatność</strong><p>Bez subskrypcji i ukrytych opłat</p></div></div><div><span>◎</span><div><strong>Licencja na Twoich zasadach</strong><p>Wybierz edycję dla siebie</p></div></div></div>
        </>} />
        <Route path="/produkt/:id" element={<Details products={products} add={add} />} />
        <Route path="/koszyk" element={<section className="page"><Breadcrumb current="Koszyk" /><p className="eyebrow">KROK 01 / 02</p><h1>Twój koszyk<span className="text-lime-300">.</span></h1><p className="muted mb-8">Twoje nowe możliwości są już o krok.</p>{!entries.length ? <Empty /> : <div className="checkout-grid"><div className="space-y-4">{entries.map(p => <article className="cart-row panel" key={p.id}><div className={`mini-cover cover-${p.id}`}><KeyIcon small /></div><div className="flex-1"><h3>Nova {p.name}</h3><p className="muted text-sm">Licencja cyfrowa</p><button className="remove" onClick={() => setCart(cart.filter(i => i.id !== p.id))}>Usuń</button></div><div className="quantity"><button aria-label={`Mniej Nova ${p.name}`} disabled={p.quantity === 1} onClick={() => setCart(cart.map(i => i.id === p.id ? { ...i, quantity: i.quantity - 1 } : i))}>−</button><span>{p.quantity}</span><button aria-label={`Więcej Nova ${p.name}`} disabled={p.quantity === 10} onClick={() => add(p)}>+</button></div><strong>{money(p.price * p.quantity)}</strong></article>)}<Link className="back-link" to="/">← Kontynuuj zakupy</Link></div><div>{summary}<Link className="button mt-4 w-full" to="/zamowienie">Przejdź do płatności <span>→</span></Link><p className="muted text-xs text-center mt-4">Wersja demonstracyjna · bez rzeczywistej płatności</p></div></div>}</section>} />
        <Route path="/zamowienie" element={<Checkout entries={entries} summary={summary} user={user} onOrder={result => { setOrder(result); setCart([]); }} />} />
        <Route path="/logowanie" element={<Auth register={false} onLogin={setUser} />} />
        <Route path="/rejestracja" element={<Auth register onLogin={setUser} />} />
        <Route path="/gotowe" element={<section className="page max-w-2xl mx-auto"><p className="eyebrow">ZAMÓWIENIE DEMONSTRACYJNE</p><h1>{order ? 'Gotowe. Czas działać!' : 'Brak zamówienia'}</h1>{order ? <div className="panel mt-8"><p className="text-lime-300 mb-5">✓ Zamówienie #{order.id} zostało zapisane.</p><p className="muted mb-6">Poniżej Twoje testowe klucze. Nie pobrano żadnych środków. Klucze nie aktywują rzeczywistego oprogramowania.</p>{order.items.map(p => <div className="mb-6" key={p.name}><h3>Nova {p.name}</h3>{p.keys.map(key => <code className="block mt-2 text-sm break-all text-lime-300" key={key}>{key}</code>)}</div>)}<strong>Razem: {money(order.total)}</strong></div> : <p className="muted my-6">Podsumowanie jest dostępne bezpośrednio po złożeniu zamówienia.</p>}<Link className="button mt-6 inline-flex" to="/">Wróć do sklepu →</Link></section>} />
        <Route path="*" element={<section className="page"><h1>Nie ma takiej strony.</h1><Link className="back-link" to="/">Wróć do sklepu →</Link></section>} />
      </Routes>
    </main>
    <footer><div className="shell flex flex-wrap justify-between gap-4"><span className="font-semibold text-white">klucz<span className="text-lime-300">.</span> <span className="muted font-normal ml-3 text-xs">Mały klucz. Wielkie możliwości.</span></span><span className="text-xs muted">© {new Date().getFullYear()} Klucz · Sklep demonstracyjny</span></div></footer>
  </div>;
}
function Breadcrumb({ current }: { current: string }) { return <div className="breadcrumb"><Link to="/">Sklep</Link><span>/</span><span>{current}</span></div>; }
function Empty() { return <div className="panel py-14 text-center"><h2>Koszyk czeka na pierwszą licencję</h2><p className="muted my-4">Wybierz edycję Nova dopasowaną do siebie.</p><Link className="button inline-flex" to="/">Przeglądaj licencje →</Link></div>; }
function Details({ products, add }: { products: Product[]; add: (p: Product) => void }) {
  const { id } = useParams();
  const product = products.find(p => String(p.id) === id);
  if (!product) return <section className="page"><h1>{products.length ? 'Nie znaleziono produktu' : 'Ładowanie produktu…'}</h1><Link to="/" className="back-link">← Wróć do sklepu</Link></section>;
  return <section className="page"><Breadcrumb current={`Nova ${product.name}`} /><div className="grid md:grid-cols-2 gap-10 lg:gap-16 items-center"><Cover product={product} large /><div><p className="eyebrow">TWÓJ NOWY ZESTAW MOŻLIWOŚCI</p><h1>Nova {product.name}<span className="text-lime-300">.</span></h1><p className="muted leading-7 my-6">{product.description}</p><ul className="features text-base">{product.features.map(f => <li key={f}><span>✓</span>{f}</li>)}</ul><div className="price text-4xl mt-8">{money(product.price)}<span>jednorazowo · z VAT</span></div><button className="button w-full mt-6" onClick={() => add(product)}>Dodaj do koszyka <span>+</span></button><Link to="/koszyk" className="details-link">Przejdź do koszyka →</Link><p className="muted text-xs text-center mt-4">Produkt przykładowy · klucz demonstracyjny</p></div></div></section>;
}
function Auth({ register, onLogin }: { register: boolean; onLogin: (user: User) => void }) {
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  useEffect(() => { setError(''); setMessage(''); }, [register]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (register) { const result = await api('register', data); setMessage(result.message); }
      else { onLogin(await api('login', data)); navigate('/'); }
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <section className="auth-grid page"><div className="auth-intro"><p className="eyebrow">TWOJE KONTO, TWOJE MOŻLIWOŚCI</p><h1>Mały klucz.<br /><span className="muted">Dobry początek.</span></h1><p className="muted leading-7 max-w-sm mt-6">Dołącz do Klucza i znajdź swoją edycję Nova. Prosty wybór, więcej przestrzeni na Twoje pomysły.</p><div className="auth-mark" aria-hidden="true"><KeyIcon /></div></div><div className="panel auth-panel"><p className="eyebrow">MIŁO CIĘ WIDZIEĆ</p><h2>{register ? 'Załóż konto' : 'Zaloguj się'}</h2><p className="muted text-sm mt-2 mb-7">{register ? 'Kilka danych i jesteś u siebie.' : 'Wróć do świata swoich możliwości.'}</p><form onSubmit={submit} className="space-y-5">{register && <label>Imię<input name="name" autoComplete="given-name" placeholder="Twoje imię" required maxLength={80} /></label>}<label>Adres e-mail<input name="email" type="email" autoComplete="email" placeholder="jan@przyklad.pl" required maxLength={200} /></label><label>Hasło<input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} placeholder={register ? 'Minimum 8 znaków' : 'Twoje hasło'} required minLength={register ? 8 : 1} maxLength={128} /></label>{error && <p className="error" role="alert">{error}</p>}{message && <p role="status" className="text-lime-300 text-sm">{message} <Link className="underline" to="/logowanie">Zaloguj się →</Link></p>}<button className="button w-full" disabled={busy}>{busy ? 'Chwileczkę…' : register ? 'Utwórz konto' : 'Zaloguj się'} <span>→</span></button></form><p className="muted text-sm mt-6 text-center">{register ? 'Masz już konto?' : 'Pierwszy raz tutaj?'} <Link className="text-white underline underline-offset-4" to={register ? '/logowanie' : '/rejestracja'}>{register ? 'Zaloguj się' : 'Załóż konto'}</Link></p></div></section>;
}
function Checkout({ entries, summary, user, onOrder }: { entries: (Product & { quantity: number })[]; summary: ReactNode; user: User | null; onOrder: (order: Order) => void }) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true);
    try { const data = Object.fromEntries(new FormData(event.currentTarget)); onOrder(await api('orders', { ...data, items: entries.map(p => ({ id: p.id, quantity: p.quantity })) })); navigate('/gotowe'); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <section className="page"><Breadcrumb current="Zamówienie" /><p className="eyebrow">KROK 02 / 02</p><h1>Jeszcze tylko dane<span className="text-lime-300">.</span></h1><p className="muted mb-8">Sprawdź zamówienie i dokończ swój zakup.</p>{!entries.length ? <Empty /> : <div className="checkout-grid"><form onSubmit={submit} className="panel space-y-5"><h2>Dane kupującego</h2>{!user && <p className="muted text-sm">Kupujesz jako gość. Masz konto? <Link to="/logowanie" className="text-white underline">Zaloguj się</Link></p>}<label>Imię i nazwisko<input name="name" autoComplete="name" defaultValue={user?.name} placeholder="Jan Kowalski" required maxLength={80} /></label><label>Adres e-mail<input name="email" type="email" autoComplete="email" defaultValue={user?.email} placeholder="jan@przyklad.pl" required /></label><label>Ulica i numer<input name="address" autoComplete="street-address" placeholder="ul. Przykładowa 12" required maxLength={200} /></label><div className="grid grid-cols-2 gap-4"><label>Kod pocztowy<input name="postcode" autoComplete="postal-code" pattern="[0-9]{2}-[0-9]{3}" placeholder="00-001" required /></label><label>Miejscowość<input name="city" autoComplete="address-level2" placeholder="Warszawa" required maxLength={80} /></label></div><div className="demo-note"><strong>Płatność demonstracyjna</strong><p>Nie podajesz danych karty. Nie pobieramy pieniędzy. Po zamówieniu zobaczysz testowe klucze.</p></div>{error && <p className="error" role="alert">{error}</p>}<button className="button w-full" disabled={busy}>{busy ? 'Zapisywanie…' : `Zamów i zapłać ${money(entries.reduce((s, p) => s + p.price * p.quantity, 0))} (demo)`}<span>→</span></button></form><div>{summary}<Link className="back-link" to="/koszyk">← Wróć do koszyka</Link></div></div>}</section>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter><App /></BrowserRouter></StrictMode>);
