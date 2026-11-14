export class WorkError extends Error {
  constructor(
    public readonly code: string,
    public readonly permanent = false,
    public readonly leaseToken?: string,
  ) {
    super(code);
  }
}
export class LeaseBusy extends Error {
  constructor(public readonly waitMs: number) {
    super('LEASE_BUSY');
  }
}
