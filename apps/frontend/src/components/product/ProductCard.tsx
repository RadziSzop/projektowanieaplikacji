import { money } from '../../lib/money';
import type { Product } from '../../types';
import { Button } from '../ui/Button';
import { Panel } from '../ui/Panel';
import { TextLink } from '../ui/TextLink';

export function ProductCard({ product, onAdd }: { product: Product; onAdd: () => void }) {
  return (
    <Panel className="flex flex-col">
      <h2 className="mb-3 text-xl font-semibold">{product.name}</h2>
      <p className="mb-8 flex-1 text-sm leading-6 text-zinc-400">{product.description}</p>
      <p className="mb-5 text-2xl font-semibold tracking-tight">{money(product.price)}</p>
      <Button full onClick={onAdd}>
        Dodaj do koszyka
      </Button>
      <TextLink className="mt-4 text-center" to={`/produkt/${product.id}`}>
        Szczegóły produktu
      </TextLink>
    </Panel>
  );
}
