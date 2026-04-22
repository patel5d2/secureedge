import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError, type LoginResponse, type MeResponse, type MfaResponse, type User } from '../lib/api';

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password?: string) => Promise<{ nextStep: 'mfa' | 'portal'; user: User }>;
  verifyMfa: (code: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<MeResponse>('/auth/me');
      setUser(res.user);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback<AuthCtx['login']>(async (email, password) => {
    const res = await api.post<LoginResponse>('/auth/login', { email, password });
    if (!res.mfaRequired) setUser(res.user);
    return { nextStep: res.nextStep, user: res.user };
  }, []);

  const verifyMfa = useCallback<AuthCtx['verifyMfa']>(async (code) => {
    const res = await api.post<MfaResponse>('/auth/mfa', { code });
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback<AuthCtx['logout']>(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* noop */
    }
    setUser(null);
  }, []);

  const value = useMemo<AuthCtx>(() => ({ user, loading, login, verifyMfa, logout, refresh }), [
    user,
    loading,
    login,
    verifyMfa,
    logout,
    refresh,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
