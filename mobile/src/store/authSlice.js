import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  token: null,
  user: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      const { token, user } = action.payload || {};
      state.token = token != null ? String(token) : null;
      state.user = user || null;
    },
    logout: (state) => {
      state.token = null;
      state.user = null;
    },
  },
});

export const { setCredentials, logout: logoutAction } = authSlice.actions;
export default authSlice.reducer;

export const selectToken = (state) => state.auth?.token ?? null;
export const selectUser = (state) => state.auth?.user ?? null;
export const selectIsAuthenticated = (state) => !!state.auth?.token;
