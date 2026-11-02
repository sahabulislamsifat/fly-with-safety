'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError } from '@/lib/api';
import { AuthenticatedUser, getCurrentUser, refreshSession, signOut } from '@/lib/api/auth';

interface AuthContextValue {
  user: AuthenticatedUser | null;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      setUser(await getCurrentUser());
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        try { setUser(await refreshSession()); }
        catch { setUser(null); }
      } else { setUser(null); }
    } finally { setIsLoading(false); }
  }, []);

  const logout = useCallback(async () => {
    try { await signOut(); } finally { setUser(null); }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refreshUser(), 0);
    const sync = () => void refreshUser();
    window.addEventListener('flywithsafe:auth-change', sync);
    return () => {
      window.clearTimeout(initialRefresh);
      window.removeEventListener('flywithsafe:auth-change', sync);
    };
  }, [refreshUser]);

  const value = useMemo(() => ({ user, isLoading, refreshUser, logout }), [user, isLoading, refreshUser, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
