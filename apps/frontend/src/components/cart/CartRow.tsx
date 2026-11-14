import { Link } from 'react-router-dom';
import { money } from '../../lib/money';
import { MAX_QUANTITY } from '../../services/cartService';
import type { CartProduct } from '../../types';
import { Button } from '../ui/Button';
import { Panel } from '../ui/Panel';

type Props = {
  item: CartProduct;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
};

export function CartRow({ item, onQuantityChange, onRemove }: Props) {
  return (
    <Panel className="flex flex-wrap items-center gap-4">
      <div className="flex-1">
        <Link to={`/produkt/${item.id}`}>Nova {item.name}</Link>
        <p className="text-sm text-zinc-400">{money(item.price)} / szt.</p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        Ilość
        <select
          className="rounded-md border border-zinc-700 bg-zinc-900 p-2"
          value={item.quantity}
          onChange={(event) => onQuantityChange(Number(event.target.value))}
        >
          {Array.from({ length: MAX_QUANTITY }, (_, i) => (
            <option key={i + 1}>{i + 1}</option>
          ))}
        </select>
      </label>
      <span>{money(item.price * item.quantity)}</span>
      <Button variant="danger" onClick={onRemove}>
        Usuń
      </Button>
    </Panel>
  );
}
