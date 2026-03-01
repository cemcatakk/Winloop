import React, { createContext, useContext, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as api from '../api';
import { setCredentials, logoutAction, selectToken, selectUser } from '../store/authSlice';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const dispatch = useDispatch();
  const token = useSelector(selectToken);
  const user = useSelector(selectUser);

  const login = useCallback(
    async (email, password) => {
      const { data, ok } = await api.post('auth/login', { email: email.trim(), password }, { useAuth: false });
      if (!ok) throw new Error(data.message || data.error || 'Login failed');
      const jwt = data.token != null ? String(data.token) : null;
      if (!jwt) throw new Error('No token received');
      dispatch(setCredentials({ token: jwt, user: data.user || null }));
      return data;
    },
    [dispatch]
  );

  const register = useCallback(
    async (email, password, displayName) => {
      const { data, ok } = await api.post(
        'auth/register',
        { email: email.trim(), password, displayName: displayName?.trim() || undefined },
        { useAuth: false }
      );
      if (!ok) throw new Error(data.message || data.error || 'Registration failed');
      const jwt = data.token != null ? String(data.token) : null;
      if (!jwt) throw new Error('No token received');
      dispatch(setCredentials({ token: jwt, user: data.user || null }));
      return data;
    },
    [dispatch]
  );

  const logout = useCallback(() => {
    dispatch(logoutAction());
  }, [dispatch]);

  const value = {
    token,
    user,
    loading: false,
    login,
    register,
    logout,
    isAuthenticated: !!token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
