import type { InputHTMLAttributes } from 'react';
import { money, type CartProduct } from './api';

export const button = 'inline-block cursor-pointer rounded border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700 disabled:cursor-default disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-blue-400';
export const link = 'text-sm text-blue-300 underline hover:text-blue-200';
export const panel = 'rounded border border-zinc-700 bg-zinc-900 p-5';

export function Field({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block text-sm">
      {label}
      <input {...props} className="mt-1 block w-full rounded border border-zinc-600 bg-zinc-950 px-3 py-2 outline-none focus:border-blue-400" />
    </label>
  );
}

export function Summary({ items }: { items: CartProduct[] }) {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return (
    <div className={panel + ' space-y-3'}>
      <h2 className="font-semibold">Podsumowanie</h2>
      {items.map(item => (
        <p className="flex justify-between gap-4 text-sm" key={item.id}>
          <span>Nova {item.name} × {item.quantity}</span><span>{money(item.price * item.quantity)}</span>
        </p>
      ))}
      <p className="flex justify-between border-t border-zinc-700 pt-3 font-semibold"><span>Razem</span><span>{money(total)}</span></p>
    </div>
  );
}
