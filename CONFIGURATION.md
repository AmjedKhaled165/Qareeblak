# Configuration Guide

## Environment Variables

### For Development Testing (With Mock API)

Edit `.env.local`:

```env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="super_secret_key_change_me_12345"
NEXT_PUBLIC_API_URL="http://localhost:5000/api"
NEXT_PUBLIC_USE_MOCK_API=true
```

Run:
```bash
npm run dev
```

✅ **Pros**:
- No backend server needed
- Works immediately
- Perfect for UI testing
- Complete mock data available

❌ **Cons**:
- Data is not persistent
- Not for backend testing
- Mock only (not real API)

---

## For Backend Integration (Real API)

Edit `.env.local`:

```env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="super_secret_key_change_me_12345"
NEXT_PUBLIC_API_URL="http://localhost:5000/api"
NEXT_PUBLIC_USE_MOCK_API=false
```

Ensure backend is running:
```bash
# Terminal 1: Start backend
cd backend
npm start

# Terminal 2: Start frontend
npm run dev
```

✅ **Pros**:
- Real data
- Production-like testing
- Full API functionality

❌ **Cons**:
- Backend must be running
- Need backend project set up
- API errors need debugging

---

## For Production

Edit `.env.production`:

```env
DATABASE_URL="your-production-db-url"
AUTH_SECRET="your-secure-secret-key"
NEXT_PUBLIC_API_URL="https://your-api-domain.com/api"
NEXT_PUBLIC_USE_MOCK_API=false
```

Build:
```bash
npm run build
npm start
```

---

## Environment Variable Reference

| Variable | Value | Purpose |
|----------|-------|---------|
| `DATABASE_URL` | `file:./dev.db` | Local SQLite database |
| `AUTH_SECRET` | Random string | NextAuth secret key |
| `NEXT_PUBLIC_API_URL` | API endpoint | Backend API URL |
| `NEXT_PUBLIC_USE_MOCK_API` | `true` / `false` | Use mock API or real API |

---

## Quick Toggle Between Mock and Real API

### Enable Mock API (Quick)
```bash
echo 'NEXT_PUBLIC_USE_MOCK_API=true' >> .env.local
npm run dev
```

### Disable Mock API (Use Real Backend)
```bash
# Edit .env.local manually:
# Change: NEXT_PUBLIC_USE_MOCK_API=false

# Ensure backend is running, then:
npm run dev
```

---

## API Endpoints

### When Mock API is Enabled
- All endpoints return mock data
- No network requests
- Responses instant

### When Mock API is Disabled
- All endpoints call real backend
- Backend must be at: `http://localhost:5000/api`
- Network requests required

### Available Endpoints
```
GET    /bookings/{id}           - Get order by ID
GET    /bookings/user/{userId}  - Get user's orders
GET    /bookings/provider/{providerId} - Get provider's orders
POST   /bookings                - Create new booking
PATCH  /bookings/{id}           - Update booking
PATCH  /bookings/{id}/status    - Update order status
GET    /bookings                - Get all bookings
```

---

## Testing Different Scenarios

### Scenario 1: UI Development (Mock API)
```env
NEXT_PUBLIC_USE_MOCK_API=true
```
- No backend needed
- Focus on styling
- Fast feedback loop

### Scenario 2: Backend Integration
```env
NEXT_PUBLIC_USE_MOCK_API=false
```
- Backend must run
- Test with real API
- Find API issues

### Scenario 3: Production Deployment
```env
NEXT_PUBLIC_USE_MOCK_API=false
NEXT_PUBLIC_API_URL=https://production-api.com/api
```
- Real backend
- Real database
- Production data

---

## Debugging

### Check Which API Mode is Active

In browser console:
```javascript
console.log('Mock API:', process.env.NEXT_PUBLIC_USE_MOCK_API);
console.log('API URL:', process.env.NEXT_PUBLIC_API_URL);
```

### Check Network Requests

With Mock API:
- Open DevTools → Network tab
- No network requests (everything is local)
- Data loads instantly

With Real API:
- Open DevTools → Network tab
- Should see requests to `http://localhost:5000/api/*`
- Responses from backend

### Common Issues

**Issue**: Mock API not working
- **Solution**: Restart dev server after changing `.env.local`

**Issue**: Backend not working
- **Solution**: Check if backend server is running on correct port

**Issue**: 404 errors
- **Solution**: Verify API URL in `.env.local`

---

## Build Process

### Development Build
```bash
npm run dev
# Runs on http://localhost:3000
# Hot reload enabled
```

### Production Build
```bash
npm run build
# Creates optimized build
# Then run: npm start
```

### Build with Different Env

```bash
# Build with mock API
NEXT_PUBLIC_USE_MOCK_API=true npm run build

# Build with real API
NEXT_PUBLIC_USE_MOCK_API=false npm run build
```

---

## Common Configuration Patterns

### For Local Development
```env
NEXT_PUBLIC_API_URL="http://localhost:5000/api"
NEXT_PUBLIC_USE_MOCK_API=true
```

### For Testing with Backend
```env
NEXT_PUBLIC_API_URL="http://localhost:5000/api"
NEXT_PUBLIC_USE_MOCK_API=false
```

### For Production
```env
NEXT_PUBLIC_API_URL="https://api.yourapp.com/api"
NEXT_PUBLIC_USE_MOCK_API=false
```

---

## Files to Edit

1. **`.env.local`** - Development configuration
2. **`.env.production`** - Production configuration
3. **`src/lib/api.ts`** - API wrapper (don't edit unless needed)
4. **`src/lib/mock-api.ts`** - Mock data (can customize)

---

## Next Steps

1. **Choose your mode**:
   - Mock API (testing): `NEXT_PUBLIC_USE_MOCK_API=true`
   - Real API (production): `NEXT_PUBLIC_USE_MOCK_API=false`

2. **Update `.env.local`**

3. **Run development**:
   ```bash
   npm run dev
   ```

4. **Test the application**:
   - Navigate to `http://localhost:3000`
   - Check orders page: `/orders`
   - Check order details: `/orders/3` (with mock API)

5. **When ready for backend**:
   - Set `NEXT_PUBLIC_USE_MOCK_API=false`
   - Ensure backend is running
   - Restart dev server

---

That's it! Your configuration is ready. 🚀
