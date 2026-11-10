import { z } from 'zod';
import type { BuyerDetails, Credentials, RegisterPayload } from '../types';

const text = (label: string, max: number) =>
  z.string().trim().min(1, `Podaj ${label}.`).max(max, `Maksymalnie ${max} znaków.`);

const email = z
  .string()
  .trim()
  .min(1, 'Podaj adres e-mail.')
  .max(200, 'Maksymalnie 200 znaków.')
  .pipe(z.email('Podaj poprawny adres e-mail.'));

export const loginSchema: z.ZodType<Credentials> = z.object({
  email,
  password: z.string().min(1, 'Podaj hasło.').max(128, 'Maksymalnie 128 znaków.'),
});

export const registerSchema: z.ZodType<RegisterPayload> = z.object({
  name: text('imię', 80),
  email,
  password: z
    .string()
    .min(8, 'Hasło musi mieć co najmniej 8 znaków.')
    .max(128, 'Maksymalnie 128 znaków.'),
});

export const buyerSchema: z.ZodType<BuyerDetails> = z.object({
  name: text('imię i nazwisko', 80),
  email,
  address: text('ulicę i numer', 200),
  postcode: z
    .string()
    .trim()
    .regex(/^\d{2}-\d{3}$/, 'Kod pocztowy w formacie 00-000.'),
  city: text('miejscowość', 80),
});
