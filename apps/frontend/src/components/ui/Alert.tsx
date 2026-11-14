import type { ReactNode } from 'react';

export function Alert({
  tone = 'error',
  children,
}: {
  tone?: 'error' | 'info';
  children: ReactNode;
}) {
  if (!children) return null;
  return tone === 'error' ? (
    <p role="alert" className="text-sm text-red-300">
      {children}
    </p>
  ) : (
    <p role="status" className="text-sm text-zinc-300">
      {children}
    </p>
  );
}
