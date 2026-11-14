import type { ReactNode } from 'react';
import { TextLink } from '../ui/TextLink';

type Width = 'narrow' | 'medium' | 'wide';

const widths: Record<Width, string> = {
  narrow: 'mx-auto max-w-md',
  medium: 'max-w-xl',
  wide: '',
};

type Props = {
  title: string;
  description?: string;
  width?: Width;
  back?: boolean;
  children?: ReactNode;
};

export function PageLayout({ title, description, width = 'wide', back, children }: Props) {
  return (
    <section className={`space-y-6 ${widths[width]}`}>
      {back && <TextLink to="/">← Wróć do sklepu</TextLink>}
      <header className="space-y-2 border-b border-zinc-800 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-zinc-400">{description}</p>}
      </header>
      {children}
    </section>
  );
}
