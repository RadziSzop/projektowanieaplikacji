import type { ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

type Variant = 'primary' | 'secondary' | 'danger';
type StyleProps = { variant?: Variant; full?: boolean };

const variants: Record<Variant, string> = {
  primary: 'bg-indigo-500 px-4 py-2.5 font-medium text-white hover:bg-indigo-400',
  secondary: 'border border-zinc-700 px-4 py-2.5 text-zinc-100 hover:bg-zinc-800',
  danger: 'text-red-300 underline underline-offset-4 hover:text-red-200',
};

export function buttonClass({ variant = 'primary', full = false }: StyleProps = {}) {
  return [
    'inline-flex cursor-pointer items-center justify-center rounded-md text-sm',
    'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-400',
    'disabled:cursor-default disabled:opacity-50',
    variants[variant],
    full ? 'w-full' : '',
  ].join(' ');
}

export function Button({
  variant,
  full,
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & StyleProps) {
  return (
    <button type={type} className={`${buttonClass({ variant, full })} ${className}`} {...props} />
  );
}

export function ButtonLink({ variant, full, className = '', ...props }: LinkProps & StyleProps) {
  return <Link className={`${buttonClass({ variant, full })} ${className}`} {...props} />;
}
