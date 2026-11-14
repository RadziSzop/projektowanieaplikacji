import type { License } from '../types';
import { get } from './client';

export const LicenseApi = {
  mine: () => get<License[]>('licenses'),
};
