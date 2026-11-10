import { useParams } from 'react-router-dom';
import { PageLayout } from '../components/layout/PageLayout';
import { ProductCard } from '../components/product/ProductCard';
import { Button } from '../components/ui/Button';
import { Panel } from '../components/ui/Panel';
import { useCart } from '../hooks/useCart';
import { useProducts } from '../hooks/useProducts';
import { money } from '../lib/money';

export function Shop() {
  const { products } = useProducts();
  const { add } = useCart();
  return (
    <PageLayout title="Licencje Nova" description="Standard, Plus i Pro">
      {!products.length && (
        <Panel className="text-sm text-zinc-400">Brak produktów do wyświetlenia.</Panel>
      )}
      <div className="grid gap-6 sm:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} onAdd={() => add(product)} />
        ))}
      </div>
    </PageLayout>
  );
}

export function Details() {
  const { id } = useParams();
  const { products } = useProducts();
  const { add } = useCart();
  const product = products.find((item) => String(item.id) === id);
  if (!product) return <PageLayout title="Nie znaleziono produktu" width="medium" back />;
  return (
    <PageLayout
      title={`Nova ${product.name}`}
      description={product.description}
      width="medium"
      back
    >
      <Panel className="space-y-6">
        <ul className="list-inside list-disc text-sm text-zinc-400">
          {product.features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
        <p className="text-lg font-semibold">{money(product.price)}</p>
        <Button onClick={() => add(product)}>Dodaj do koszyka</Button>
      </Panel>
    </PageLayout>
  );
}
