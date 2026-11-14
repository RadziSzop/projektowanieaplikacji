import type { HTMLAttributes, ReactNode } from 'react';

export function Panel({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-lg border border-zinc-700/70 bg-zinc-800/40 p-6 ${className}`}
      {...props}
    />
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel className="space-y-4">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </Panel>
  );
}
