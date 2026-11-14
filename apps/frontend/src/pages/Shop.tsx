import { PageLayout } from '../components/layout/PageLayout';
import { ProductCard } from '../components/product/ProductCard';
import { Panel } from '../components/ui/Panel';
import { useCart } from '../hooks/useCart';
import { useProducts } from '../hooks/useProducts';

export default function Shop() {
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
