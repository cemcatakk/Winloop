# Winloop Mobile (Expo)

## Run

1. Start backend: `cd ../backend && npm start`
2. In `src/config/api.js` set `API_BASE_URL`:
   - iOS simulator: `http://localhost:3100/api`
   - Android emulator: `http://10.0.2.2:3100/api`
   - Physical device: `http://YOUR_MACHINE_IP:3100/api`
3. Start app: `npm start` then press `i` (iOS) or `a` (Android).

## Test login

- **Admin (from seed):** email `admin@winloop.test`, password `admin123`
- Or register a new account from the Register screen.

## Auth

- Login/Register use backend `POST /api/auth/login` and `POST /api/auth/register`.
- Token is stored in AsyncStorage and sent as `Authorization: Bearer <token>`.
- Google Sign-In can be added later (backend has `POST /api/auth/google`).
