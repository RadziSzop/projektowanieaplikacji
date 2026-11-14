export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function get<T>(path: string, signal?: AbortSignal) {
  return request<T>(path, signal ? { signal } : undefined);
}

export function post<T>(path: string, body: object = {}, signal?: AbortSignal) {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/${path}`, init);
  } catch {
    throw new ApiError('Brak połączenia z serwerem.', 0);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(data?.error || `Błąd API (${response.status}).`, response.status);
  }
  return data as T;
}
