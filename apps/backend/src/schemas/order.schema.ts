import { z } from 'zod';

export const createOrderSchema = z.object({
  body: z.object({
    productId: z.string({ required_error: 'Identyfikator produktu jest wymagany' }),
    quantity: z.number().min(1, 'Ilość musi być większa niż 0'),
    userEmail: z.string().email('Niepoprawny format adresu e-mail'),
  })
});