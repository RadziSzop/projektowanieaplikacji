import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../lib/errors';

type State<T> = { data: T | null; error: string; loading: boolean };

export function useResource<T>(load: () => Promise<T>, key: string, initial: T | null = null) {
  const [state, setState] = useState<State<T>>({ data: initial, error: '', loading: true });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true }));
    load()
      .then((data) => active && setState({ data, error: '', loading: false }))
      .catch(
        (e) =>
          active && setState((current) => ({ ...current, error: errorMessage(e), loading: false })),
      );
    return () => {
      active = false;
    };
  }, [key, version]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);
  return { ...state, reload };
}
