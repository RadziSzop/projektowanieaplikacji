export function money(price: number) {
  return (price / 100).toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' });
}
