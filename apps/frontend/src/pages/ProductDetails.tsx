import { useParams } from 'react-router-dom';
import { PageLayout } from '../components/layout/PageLayout';
import { Button } from '../components/ui/Button';
import { Panel } from '../components/ui/Panel';
import { useCart } from '../hooks/useCart';
import { useProducts } from '../hooks/useProducts';
import { money } from '../lib/money';

export default function ProductDetails() {
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
