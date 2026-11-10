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

export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export type DeliveryStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'WRITTEN' | 'FAILED';

export type OrderJob = {
  jobId: string;
  status: JobStatus;
  errorCode: string | null;
  deliveries: { kind: 'EMAIL' | 'METRICS'; status: DeliveryStatus; errorCode: string | null }[];
};

export type OrderDetails = Order & { jobs?: OrderJob[] };

export type License = {
  id: string;
  key: string;
  expiresAt: string | null;
  revokedAt: string | null;
};
