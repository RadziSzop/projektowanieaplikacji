import { Link, type LinkProps } from 'react-router-dom';

export function TextLink({ className = '', ...props }: LinkProps) {
  return (
    <Link
      className={`text-sm text-zinc-400 underline-offset-4 hover:text-white hover:underline ${className}`}
      {...props}
    />
  );
}
