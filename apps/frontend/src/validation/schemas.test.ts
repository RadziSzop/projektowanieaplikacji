import { describe, expect, it } from 'vitest';
import { buyerSchema, loginSchema, registerSchema } from './schemas';

const buyer = {
  name: 'Jan Kowalski',
  email: 'jan@example.com',
  address: 'Długa 1',
  postcode: '00-001',
  city: 'Warszawa',
};

function messages(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues.map((issue) => issue.message) ?? [];
}

describe('schematy walidacji', () => {
  it('akceptuje poprawne dane kupującego i przycina spacje', () => {
    const result = buyerSchema.safeParse({ ...buyer, city: '  Warszawa  ' });
    expect(result.success).toBe(true);
    expect(result.data?.city).toBe('Warszawa');
  });

  it('odrzuca zły kod pocztowy i e-mail', () => {
    const result = buyerSchema.safeParse({ ...buyer, postcode: '00001', email: 'jan@' });
    expect(messages(result)).toEqual([
      'Podaj poprawny adres e-mail.',
      'Kod pocztowy w formacie 00-000.',
    ]);
  });

  it('wymaga hasła z co najmniej 8 znakami przy rejestracji', () => {
    const result = registerSchema.safeParse({ name: 'Jan', email: buyer.email, password: '123' });
    expect(messages(result)).toEqual(['Hasło musi mieć co najmniej 8 znaków.']);
  });

  it('wymaga wypełnienia pól logowania', () => {
    const result = loginSchema.safeParse({ email: '', password: '' });
    expect(messages(result)).toContain('Podaj adres e-mail.');
    expect(messages(result)).toContain('Podaj hasło.');
  });
});
