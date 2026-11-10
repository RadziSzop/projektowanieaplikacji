import type { Credentials, RegisterPayload, User } from '../types';
import { get, post } from './client';

export const AuthApi = {
  me: () => get<User | null>('me'),
  login: (credentials: Credentials) => post<User>('login', credentials),
  register: (payload: RegisterPayload) => post<{ message: string }>('register', payload),
  logout: () => post<void>('logout'),
};
