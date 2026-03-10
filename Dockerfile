# =====================================================
# Next.js Production Dockerfile (Standalone Output)
# Build: ~80MB final image vs ~600MB without standalone
# =====================================================

# Stage 1: Install dependencies
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-engines

# Stage 2: Build the application
FROM node:22-alpine AS builder
WORKDIR /app

# Copy deps from previous stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build args that become env vars at build time (NEXT_PUBLIC_* only)
ARG NEXT_PUBLIC_API_URL=https://api.qareeblak.com
ARG NEXT_PUBLIC_SOCKET_URL=https://api.qareeblak.com
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# Stage 3: Minimal production image
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build output (self-contained Node.js server)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Correct ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

# Standalone server entry point
CMD ["node", "server.js"]
