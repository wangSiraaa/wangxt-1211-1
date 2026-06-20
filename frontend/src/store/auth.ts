import { create } from 'zustand';
import api from '../lib/api';

type UserRole = 'ENTERPRISE' | 'VERIFIER' | 'ADMIN';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  enterpriseId?: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  initialized: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hydrate: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  token: null,
  user: null,
  initialized: false,
  login: async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    const { accessToken, user } = res as any;
    localStorage.setItem('token', accessToken);
    localStorage.setItem('user', JSON.stringify(user));
    set({ token: accessToken, user });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ token: null, user: null });
  },
  hydrate: () => {
    if (typeof window === 'undefined') {
      set({ initialized: true });
      return;
    }
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    set({ token, user, initialized: true });
  },
}));
