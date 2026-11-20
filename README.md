# Qareeblak & Halan: Unified Marketplace and Real-Time Delivery Platform

A unified service marketplace and on-demand delivery ecosystem integrating local service discovery (Qareeblak) with dedicated courier dispatch and live tracking (Halan).

---

## Architectural Overview

The system consists of three decoupled components sharing real-time event infrastructure:
1. **Frontend Web App (`src/`)**: Next.js client interface for service browsing, scheduling, and pharmacy chat bookings.
2. **Backend API (`server/`)**: Node.js and Express RESTful API with Socket.io WebSockets for real-time geolocation streaming and order state machines.
3. **Courier Mobile App (`halan/`)**: React Native (Expo) application providing foreground and background GPS location broadcasting and order workflow management.
4. **WhatsApp Automation Service**: Evolution API integration for dispatching automated invoices and delivery notifications directly to customer numbers upon completion.

---

## Repository Structure

```
Qareeblak/
├── src/                          # Next.js Web Application
│   ├── components/
│   │   ├── features/             # Real-time chat, booking workflows
│   │   └── ui/                   # Reusable UI component library
│   └── app/                      # App router and page definitions
├── server/                       # Backend API & WebSocket Server
│   ├── routes/                   # REST API routes
│   ├── migrations/               # PostgreSQL schema migrations and indexing scripts
│   └── index.js                  # Server entry point
├── halan/                        # Courier Mobile Client (React Native / Expo)
│   ├── app/                      # Navigation and order screens
│   └── utils/                    # Location telemetry and API clients
└── public/                       # Static public assets
```

---

## Getting Started

### 1. Web Application (Next.js)
```bash
npm install
npm run dev
```
Accessible at: `http://localhost:3000`

### 2. Backend Server (Node.js, Express, Socket.io)
```bash
cd server
npm install
npm start
```
Runs at: `http://localhost:5000`

### 3. Courier Mobile App (React Native / Expo)
```bash
cd halan
npm install
npm start
```

### 4. Database Setup & Query Optimization
Execute database indexes to optimize lookup speeds on high-traffic tables:
```bash
cd server
node migrations/add-performance-indexes.js
```

### 5. Evolution API (WhatsApp Integration)
The platform integrates with an Evolution API instance to send receipts to clients once orders transition to `Delivered`:
1. Launch Evolution API on port `8080`.
2. Configure `EVOLUTION_API_KEY` and `EVOLUTION_API_URL` in `server/.env`.

---

## Performance & Scalability Measures

- **Database Indexes**: Dedicated indexing on `bookings`, `providers`, and `users` tables for sub-millisecond filtering.
- **Server-Side Pagination**: Implemented cursor and offset pagination across order queries, minimizing network payload sizes.
- **Projected Projections**: Strict column-level selection across database queries avoiding overhead from `SELECT *`.
- **Background Location Telemetry**: Low-latency WebSocket event streaming with power-efficient mobile background location tracking.

---

## Service Modules Status

| Subsystem | State | Protocol / Implementation |
| --- | --- | --- |
| Authentication | Operational | JWT, Secure HttpOnly storage & Mobile Native Persistence |
| Pharmacy & Service Chat | Operational | Socket.io real-time message bus |
| Courier Location Telemetry | Operational | Socket.io GeoJSON coordinate streaming |
| Order State Machine | Operational | Express REST endpoints with PostgreSQL transactions |
| WhatsApp Notification Relay | Operational | Evolution API Webhooks |

---

## Terms & Service Boundaries
Qareeblak functions as an intermediary marketplace connecting independent service contractors with consumers.
