import { money } from '../../lib/money';
import type { Order } from '../../types';
import { Section } from '../ui/Panel';

export function OrderKeys({ order }: { order: Order }) {
  return (
    <Section title={`Zamówienie nr ${order.id}`}>
      {order.items.map((item) => (
        <div key={item.name}>
          <h3 className="mb-2 font-semibold">Nova {item.name}</h3>
          {item.keys.length ? (
            item.keys.map((key) => (
              <code className="block break-all text-sm" key={key}>
                {key}
              </code>
            ))
          ) : (
            <p className="text-sm text-zinc-400">Klucz zostanie wysłany e-mailem.</p>
          )}
        </div>
      ))}
      <p className="border-t border-zinc-700 pt-4 font-semibold">Razem: {money(order.total)}</p>
    </Section>
  );
}
