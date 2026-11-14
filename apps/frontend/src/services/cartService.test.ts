import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../types';
import { CartService, MAX_QUANTITY } from './cartService';

const product: Product = { id: 1, name: 'Standard', description: '', price: 4900, features: [] };

describe('CartService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('dodaje nowy produkt i zwiększa ilość istniejącego', () => {
    const once = CartService.add([], 1);
    expect(once).toEqual([{ id: 1, quantity: 1 }]);
    expect(CartService.add(once, 1)).toEqual([{ id: 1, quantity: 2 }]);
  });

  it(`nie pozwala przekroczyć ${MAX_QUANTITY} sztuk`, () => {
    const full = [{ id: 1, quantity: MAX_QUANTITY }];
    expect(CartService.canAdd(full, 1)).toBe(false);
    expect(CartService.add(full, 1)).toBe(full);
    expect(CartService.setQuantity(full, 1, 99)).toEqual([{ id: 1, quantity: MAX_QUANTITY }]);
    expect(CartService.setQuantity(full, 1, 0)).toEqual([{ id: 1, quantity: 1 }]);
  });

  it('usuwa produkt i liczy sztuki', () => {
    const cart = [
      { id: 1, quantity: 2 },
      { id: 2, quantity: 3 },
    ];
    expect(CartService.count(cart)).toBe(5);
    expect(CartService.remove(cart, 1)).toEqual([{ id: 2, quantity: 3 }]);
  });

  it('łączy koszyk z produktami i liczy sumę', () => {
    const items = CartService.withProducts(
      [
        { id: 1, quantity: 2 },
        { id: 99, quantity: 1 },
      ],
      [product],
    );
    expect(items).toEqual([{ ...product, quantity: 2 }]);
    expect(CartService.total(items)).toBe(9800);
  });

  it('odrzuca uszkodzone dane z localStorage', () => {
    const storage = { getItem: vi.fn(), setItem: vi.fn() };
    vi.stubGlobal('localStorage', storage);

    storage.getItem.mockReturnValue('{zly json');
    expect(CartService.load()).toEqual([]);

    storage.getItem.mockReturnValue(
      JSON.stringify([{ id: 1, quantity: 2 }, { id: 2, quantity: 50 }, { id: 'x' }]),
    );
    expect(CartService.load()).toEqual([{ id: 1, quantity: 2 }]);
  });
});
