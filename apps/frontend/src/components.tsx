import type { InputHTMLAttributes } from 'react';
import { money, type CartProduct } from './api';

export const button =
  'inline-flex cursor-pointer items-center justify-center rounded-md bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-white disabled:cursor-default disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-400';
export const link = 'text-sm text-zinc-400 underline-offset-4 hover:text-white hover:underline';
export const panel = 'rounded-lg border border-zinc-700/70 bg-zinc-800/40 p-6';

export function Field({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block text-sm text-zinc-300">
      {label}
      <input
        {...props}
        className="mt-2 block w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-zinc-100 outline-none focus:border-zinc-400"
      />
    </label>
  );
}

export function Summary({ items }: { items: CartProduct[] }) {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return (
    <div className={panel + ' space-y-3'}>
      <h2 className="font-semibold">Podsumowanie</h2>
      {items.map((item) => (
        <p className="flex justify-between gap-4 text-sm" key={item.id}>
          <span>
            Nova {item.name} × {item.quantity}
          </span>
          <span>{money(item.price * item.quantity)}</span>
        </p>
      ))}
      <p className="flex justify-between border-t border-zinc-700 pt-3 font-semibold">
        <span>Razem</span>
        <span>{money(total)}</span>
      </p>
    </div>
  );
}
