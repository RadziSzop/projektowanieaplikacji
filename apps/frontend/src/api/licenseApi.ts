import type { License, LicenseStatus } from '../types';
import { get, post } from './client';

export const LicenseApi = {
  mine: () => get<License[]>('licenses'),
  verify: (key: string, signal?: AbortSignal) =>
    post<{ status: LicenseStatus }>('licenses/verify', { key }, signal),
};
