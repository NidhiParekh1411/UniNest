import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import api, { token } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!token.get()) { setLoading(false); return undefined; }
    api.me()
      .then((res) => { if (!cancelled) setUser(res.user); })
      .catch(() => { token.set(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email, password, portal) => {
    const res = await api.login(email, password, portal);
    token.set(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(() => { token.set(null); setUser(null); }, []);

  const value = useMemo(() => ({
    user,
    loading,
    login,
    logout,
    isStudent: user?.role === 'student',
    isFaculty: user?.role === 'faculty',
    isAdmin: user?.role === 'admin',
    isStaff: user?.role === 'faculty' || user?.role === 'admin',
  }), [user, loading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
