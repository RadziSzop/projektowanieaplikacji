import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (!user) return <Navigate to="/logowanie" state={{ from: pathname }} replace />;
  return children;
}
