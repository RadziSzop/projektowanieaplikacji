import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AuthApi } from '../api/authApi';
import { useToast } from '../components/Toast';
import { errorMessage } from '../lib/errors';
import type { Credentials, RegisterPayload, User } from '../types';

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (credentials: Credentials) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<string>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AuthApi.me()
      .then(setUser)
      .catch((e) => toast(errorMessage(e), 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  const value: AuthState = {
    user,
    loading,
    async login(credentials) {
      setUser(await AuthApi.login(credentials));
    },
    async register(payload) {
      const result = await AuthApi.register(payload);
      return result.message;
    },
    async logout() {
      try {
        await AuthApi.logout();
        setUser(null);
      } catch (e) {
        toast(errorMessage(e), 'error');
      }
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth wymaga AuthProvider.');
  return context;
}
