import { TextLink } from '../ui/TextLink';

export function EmptyCart() {
  return (
    <p>
      Koszyk jest pusty. <TextLink to="/">Przejdź do sklepu</TextLink>
    </p>
  );
}
