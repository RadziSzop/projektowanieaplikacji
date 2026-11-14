import { money } from '../../lib/money';
import { CartService } from '../../services/cartService';
import type { CartProduct } from '../../types';
import { Section } from '../ui/Panel';

export function OrderSummary({ items }: { items: CartProduct[] }) {
  return (
    <Section title="Podsumowanie">
      {items.map((item) => (
        <p className="flex justify-between gap-4 text-sm" key={item.id}>
          <span>
            Nova {item.name} × {item.quantity}
          </span>
          <span>{money(item.price * item.quantity)}</span>
        </p>
      ))}
      <p className="flex justify-between border-t border-zinc-700 pt-4 font-semibold">
        <span>Razem</span>
        <span>{money(CartService.total(items))}</span>
      </p>
    </Section>
  );
}
