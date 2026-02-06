# Mock API Development Guide

## Overview

This project includes a Mock API system for development and testing without a running backend server.

## Setup

### Using Mock API (Development Testing)

To test the frontend with mock data instead of real API calls:

1. **Edit `.env.local`**:
   ```env
   NEXT_PUBLIC_USE_MOCK_API=true
   ```

2. **Run development server**:
   ```bash
   npm run dev
   ```

The app will now use mock API responses for all booking operations.

### Using Real API (Production)

1. **Ensure backend is running**:
   ```bash
   # Backend must be available on http://localhost:5000/api
   # OR set NEXT_PUBLIC_API_URL to your backend URL
   ```

2. **Edit `.env.local`**:
   ```env
   NEXT_PUBLIC_USE_MOCK_API=false
   NEXT_PUBLIC_API_URL=http://your-backend-url/api
   ```

3. **Run development server**:
   ```bash
   npm run dev
   ```

## Mock Data Structure

### Orders (Bookings)

All mock orders are returned with this structure:

```typescript
{
  id: string;                          // Unique order ID
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  halanStatus: 'pending' | 'assigned' | 'ready_for_pickup' | 'delivered';
  providerName: string;                // Restaurant/Service provider name
  userName: string;                    // Customer name
  serviceName: string;                 // Service type
  price: number;                       // Total price
  date: ISO 8601 date string;         // Order timestamp
  details: string;                     // Order details (address, notes)
  source: 'halan' | 'qareeblak';      // Order source
  isQareeblak: boolean;               // Whether it's from Qareeblak
  items: OrderItem[];                 // List of ordered items
}
```

### Order Items

```typescript
{
  id: string;              // Unique item ID
  name: string;            // Item name (e.g., "فراخ مشوية")
  quantity: number;        // Order quantity
  price: number;           // Item price
  description?: string;    // Item description
}
```

## Mock API Methods

### bookingsApi.getById(id: string)

Returns a single mock order by ID.

**Example**:
```typescript
const order = await bookingsApi.getById('3');
// Returns:
{
  id: '3',
  status: 'confirmed',
  providerName: 'مطعم العائلة',
  // ... more properties
}
```

### bookingsApi.getByUser(userId: string)

Returns all mock orders for a user (3 orders with different statuses).

**Example**:
```typescript
const orders = await bookingsApi.getByUser('user123');
// Returns: [
//   { id: '3', status: 'confirmed', ... },
//   { id: '4', status: 'completed', ... },
//   { id: '5', status: 'cancelled', ... }
// ]
```

### bookingsApi.getByProvider(providerId: string)

Returns all mock orders for a provider (2 orders).

**Example**:
```typescript
const orders = await bookingsApi.getByProvider('provider123');
// Returns: [
//   { id: '1', status: 'pending', ... },
//   { id: '2', status: 'confirmed', ... }
// ]
```

### bookingsApi.update(id: string, data: UpdateData)

Updates a mock order (returns updated order).

**Example**:
```typescript
const updated = await bookingsApi.update('3', {
  status: 'completed',
  items: [/* updated items */]
});
```

### bookingsApi.create(data: CreateData)

Creates a mock order (returns created order).

**Example**:
```typescript
const newOrder = await bookingsApi.create({
  providerName: 'مطعم جديد',
  userName: 'أحمد',
  serviceName: 'توصيل',
  price: 150,
  items: [/* items */]
});
```

## Testing Different Scenarios

### Test Order Details Page

1. **Set mock API to true**:
   ```env
   NEXT_PUBLIC_USE_MOCK_API=true
   ```

2. **Navigate to order**:
   - Go to `http://localhost:3000/orders/3`
   - Should show mock order data

### Test Order Modification

1. **Navigate to order page**:
   - `http://localhost:3000/orders/3`

2. **Try modifying**:
   - Add/remove items
   - Update quantity
   - Changes are handled by mock API

### Test Order List

1. **Login first** (use mock data for auth too)

2. **Navigate to orders**:
   - `http://localhost:3000/orders`
   - Shows 3 mock orders (active and previous)

## Current Mock Data

### Available Test Orders

| Order ID | Status | Provider | Items |
|----------|--------|----------|-------|
| 3 | confirmed | مطعم العائلة | فراخ مشوية × 2, أرز × 2 |
| 4 | completed | بيتزا هاوس | بيتزا دجاج × 1 |
| 5 | cancelled | كنتاكي | (empty) |

## Switching Between Mock and Real API

The system automatically detects the environment:

```typescript
// In src/lib/api.ts
const USE_MOCK_API = process.env.NEXT_PUBLIC_USE_MOCK_API === 'true';

// All bookingsApi methods check this flag
// If true → use mockBookingsApi
// If false → use real apiCall (with fallback logic)
```

## Error Handling

### With Mock API

- Always returns valid data
- Never throws errors (unless you modify mock-api.ts)
- Useful for testing UI without network issues

### With Real API

- Returns real errors from backend
- Includes HTTP status codes
- Fallback logic tries alternative endpoints

## Debugging

To see which API source is being used:

```typescript
// Check console when making API calls
console.log('USE_MOCK_API:', process.env.NEXT_PUBLIC_USE_MOCK_API);

// You can also check in browser DevTools:
// Go to Application → Environment Variables
```

## Production Deployment

When deploying to production:

1. **Never enable mock API**:
   ```env
   NEXT_PUBLIC_USE_MOCK_API=false
   ```

2. **Set real backend URL**:
   ```env
   NEXT_PUBLIC_API_URL=https://your-api.com/api
   ```

3. **Run build**:
   ```bash
   npm run build
   npm start
   ```

## Quick Commands

```bash
# Development with mock API
NEXT_PUBLIC_USE_MOCK_API=true npm run dev

# Development with real backend
NEXT_PUBLIC_USE_MOCK_API=false npm run dev

# Production build
npm run build && npm start
```

## Migration to Real Backend

When backend is ready:

1. Stop the dev server
2. Update `.env.local`:
   ```env
   NEXT_PUBLIC_USE_MOCK_API=false
   NEXT_PUBLIC_API_URL=http://localhost:5000/api
   ```
3. Ensure backend is running
4. Run `npm run dev` again
5. App will use real API endpoints

## File Locations

- **Mock API**: `src/lib/mock-api.ts`
- **Real API**: `src/lib/api.ts`
- **Configuration**: `.env.local`
- **Order Page**: `src/app/orders/[id]/page.tsx`
- **Order List**: `src/app/orders/page.tsx`
