# Install Node.js standard Alpine image (Node 25 LTS)
FROM node:25-alpine AS builder

# Set working directory inside container
WORKDIR /app

# Copy package dependencies first to leverage Docker layer caching
COPY package*.json ./

# Install explicit dependencies (frozen lockfile and suppress funding/audit noise)
RUN npm ci --only=production

# Copy all source code
COPY . .

# Multi-stage build for a smaller production image
FROM node:25-alpine

# Set non-root user for security
RUN addgroup -S nodeapp && adduser -S nodeuser -G nodeapp
WORKDIR /app

# Install PM2 globally into the clean production image
RUN npm install -g pm2

# Copy stripped dependencies and src code from builder
COPY --from=builder /app ./

# Change ownership
RUN chown -R nodeuser:nodeapp /app

# Switch to the non-root user
USER nodeuser

# Expose API port
EXPOSE 5000

# Start server using PM2 cluster mode
CMD ["pm2-runtime", "ecosystem.config.js", "--env", "production"]
