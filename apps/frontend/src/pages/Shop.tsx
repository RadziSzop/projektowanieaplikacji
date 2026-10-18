import { Link, useParams } from 'react-router-dom';
import { money, type Product } from '../api';
import { button, link, panel } from '../components';

type Props = { products: Product[]; add: (product: Product) => void };

export function Shop({ products, add }: Props) {
  return (
    <>
      <h1 className="mb-8 text-3xl font-semibold tracking-tight">Licencje Nova</h1>
      <div className="grid gap-5 sm:grid-cols-3">
        {products.map((product) => (
          <article className={panel + ' flex flex-col'} key={product.id}>
            <h2 className="mb-3 text-xl font-semibold">{product.name}</h2>
            <p className="mb-8 flex-1 text-sm leading-6 text-zinc-400">{product.description}</p>
            <p className="mb-5 text-2xl font-semibold tracking-tight">{money(product.price)}</p>
            <button className={button + ' w-full'} onClick={() => add(product)}>
              Dodaj do koszyka
            </button>
            <Link className={link + ' mt-4 text-center'} to={`/produkt/${product.id}`}>
              Szczegóły produktu
            </Link>
          </article>
        ))}
      </div>
    </>
  );
}

export function Details({ products, add }: Props) {
  const { id } = useParams();
  const product = products.find((item) => String(item.id) === id);
  if (!product) return <p>Nie znaleziono produktu.</p>;
  return (
    <div className={panel + ' max-w-xl space-y-6'}>
      <Link className={link} to="/">
        Wróć do sklepu
      </Link>
      <h1 className="text-2xl font-semibold">Nova {product.name}</h1>
      <p>{product.description}</p>
      <ul className="list-inside list-disc text-sm text-zinc-400">
        {product.features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
      <p className="text-lg font-semibold">{money(product.price)}</p>
      <button className={button} onClick={() => add(product)}>
        Dodaj do koszyka
      </button>
    </div>
  );
}
