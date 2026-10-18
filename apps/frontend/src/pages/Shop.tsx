import { Link, useParams } from 'react-router-dom';
import { money, type Product } from '../api';
import { button, link, panel } from '../components';

type Props = { products: Product[]; add: (product: Product) => void };

export function Shop({ products, add }: Props) {
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">Produkty</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        {products.map(product => (
          <article className={panel + ' space-y-4'} key={product.id}>
            <h2 className="text-lg font-semibold">Nova {product.name}</h2>
            <p className="text-sm text-zinc-400">{product.description}</p>
            <p className="font-semibold">{money(product.price)}</p>
            <Link className={link + ' block'} to={`/produkt/${product.id}`}>Szczegóły</Link>
            <button className={button} onClick={() => add(product)}>Dodaj do koszyka</button>
          </article>
        ))}
      </div>
    </>
  );
}

export function Details({ products, add }: Props) {
  const { id } = useParams();
  const product = products.find(item => String(item.id) === id);
  if (!product) return <p>Nie znaleziono produktu.</p>;
  return (
    <div className="max-w-xl space-y-5">
      <Link className={link} to="/">Wróć do sklepu</Link>
      <h1 className="text-2xl font-semibold">Nova {product.name}</h1>
      <p>{product.description}</p>
      <ul className="list-inside list-disc text-sm text-zinc-400">
        {product.features.map(feature => <li key={feature}>{feature}</li>)}
      </ul>
      <p className="text-lg font-semibold">{money(product.price)}</p>
      <button className={button} onClick={() => add(product)}>Dodaj do koszyka</button>
    </div>
  );
}
