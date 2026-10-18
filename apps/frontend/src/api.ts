export type Product = { id: number; name: string; description: string; price: number; features: string[] };
export type CartItem = { id: number; quantity: number };
export type CartProduct = Product & { quantity: number };
export type User = { name: string; email: string };
export type Order = { id: number; total: number; items: { name: string; keys: string[] }[] };

export function money(price: number) {
  return (price / 100).toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' });
}

export async function api<T>(path: string, body?: object): Promise<T> {
  const response = await fetch(`/api/${path}`, body ? {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  } : {});
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || `Błąd API (${response.status}).`);
  if (data === null) throw new Error('API zwróciło nieprawidłową odpowiedź.');
  return data;
}

export function readCart(): CartItem[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem('koszyk') || '[]');
    return Array.isArray(saved) ? saved.filter(i => Number.isInteger(i?.id) && Number.isInteger(i?.quantity) && i.quantity > 0 && i.quantity <= 10).slice(0, 3) : [];
  } catch { return []; }
}
