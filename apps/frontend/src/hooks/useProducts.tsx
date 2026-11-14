import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ProductApi } from '../api/productApi';
import { useToast } from '../components/Toast';
import { errorMessage } from '../lib/errors';
import type { Product } from '../types';

type ProductsState = { products: Product[]; loading: boolean };

const ProductsContext = createContext<ProductsState | null>(null);

export function ProductsProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [state, setState] = useState<ProductsState>({ products: [], loading: true });

  useEffect(() => {
    ProductApi.list()
      .then((products) => setState({ products, loading: false }))
      .catch((e) => {
        toast(errorMessage(e), 'error');
        setState({ products: [], loading: false });
      });
  }, [toast]);

  return <ProductsContext.Provider value={state}>{children}</ProductsContext.Provider>;
}

export function useProducts() {
  const context = useContext(ProductsContext);
  if (!context) throw new Error('useProducts wymaga ProductsProvider.');
  return context;
}
