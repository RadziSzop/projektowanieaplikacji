export type Product = {
  id: number;
  name: string;
  description: string;
  price: number;
  features: string[];
};

export type CartItem = { id: number; quantity: number };

export type CartProduct = Product & { quantity: number };

export type User = { name: string; email: string };

export type Credentials = { email: string; password: string };

export type RegisterPayload = Credentials & { name: string };

export type BuyerDetails = {
  name: string;
  email: string;
  address: string;
  postcode: string;
  city: string;
};

export type OrderPayload = BuyerDetails & { items: CartItem[] };

export type OrderItem = { name: string; keys: string[] };

export type Order = { id: number; total: number; items: OrderItem[] };
