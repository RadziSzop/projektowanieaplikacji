import { Link, NavLink } from 'react-router-dom';
import type { User } from '../api';

type Props = { count: number; user: User | null; onLogout: () => void };

export default function Navbar({ count, user, onLogout }: Props) {
  return (
    <header className="border-b border-zinc-800">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-5">
        <Link to="/" className="text-lg font-semibold tracking-tight">
          Sklep z kluczami
        </Link>
        <nav className="flex flex-wrap items-center gap-2 text-sm">
          <NavLink
            to="/koszyk"
            aria-label={`Koszyk (${count})`}
            className={({ isActive }) =>
              `inline-flex items-center gap-2 rounded-md px-3 py-2 ${isActive ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`
            }
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 3h2l2.5 12h11L21 7H6" />
              <circle cx="9" cy="20" r="1" />
              <circle cx="18" cy="20" r="1" />
            </svg>
            <span className="text-xs">{count}</span>
          </NavLink>
          {user ? (
            <button
              className="cursor-pointer px-3 py-2 text-zinc-400 hover:text-white"
              onClick={onLogout}
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
  );
}
