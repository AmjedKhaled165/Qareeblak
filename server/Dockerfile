# syntax=docker/dockerfile:1.7
# Install Node.js standard Alpine image (Node 25 LTS)
FROM node:25-alpine AS builder

# Install pnpm in build image
RUN npm install -g pnpm

# Set working directory inside container
WORKDIR /app

# Alpine dependencies needed for native modules (sharp, canvas, etc.)
RUN apk add --no-cache libc6-compat python3 make g++

# Copy package dependencies first to leverage Docker layer caching
COPY package.json pnpm-lock.yaml ./

# Ensure Prisma schema directory is present in image before install/build steps.
COPY prisma ./prisma/

# Install production dependencies with pnpm (cached store)
RUN --mount=type=cache,target=/root/.pnpm-store \
    pnpm install --frozen-lockfile --prod

# Copy all source code
COPY . .

# Multi-stage build for a smaller production image
FROM node:25-alpine

# Set non-root user for security
RUN addgroup -S nodeapp && adduser -S nodeuser -G nodeapp
WORKDIR /app

# Ensure UTF-8 output in container logs.
ENV LANG=C.UTF-8 \
    LC_ALL=C.UTF-8

# Install PM2 globally into the clean production image
RUN npm install -g pm2

# Copy stripped dependencies and src code from builder
COPY --from=builder /app ./

# Create logs directory for PM2 (must exist before chown)
RUN mkdir -p /app/logs

# Change ownership
RUN chown -R nodeuser:nodeapp /app

# Switch to the non-root user
USER nodeuser

# Expose API port
EXPOSE 5000

# Start server using PM2 cluster mode
CMD ["pm2-runtime", "ecosystem.config.js", "--env", "production"]
