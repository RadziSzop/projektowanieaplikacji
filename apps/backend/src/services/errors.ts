// Thrown by services; the API layer maps it to an HTTP response. Keeps services free of Hono.
export class ServiceError extends Error {
  constructor(readonly status: 400 | 403 | 404 | 503, message: string) {
    super(message);
  }
}
