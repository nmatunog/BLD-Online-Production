# Backend (NestJS) - Railway optimized
# Use Debian Bullseye which has OpenSSL 1.1.1 built-in

FROM node:20-bullseye

# Install OpenSSL 1.1 libraries
# Debian Bullseye has OpenSSL 1.1.1, but we need to ensure libssl1.1 is available
# Try multiple package names as they vary by Debian version
RUN apt-get update -y && \
    (apt-get install -y --no-install-recommends libssl1.1 || \
     apt-get install -y --no-install-recommends libssl1.1.1 || \
     apt-get install -y --no-install-recommends libssl-dev) && \
    apt-get install -y --no-install-recommends \
        openssl \
        ca-certificates && \
    # Verify OpenSSL is installed
    openssl version && \
    # Find and verify libssl library
    find /usr/lib -name "libssl.so*" 2>/dev/null | head -5 && \
    # Update library cache
    ldconfig && \
    # Clean up apt cache
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (needed for build)
RUN npm ci

# Copy Prisma schema
COPY prisma ./prisma

# Generate Prisma Client with explicit OpenSSL 3.0 binary target
# Clean any existing generated client first
RUN rm -rf node_modules/.prisma || true && \
    npx prisma generate

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production: use only production dependencies
# Note: Don't remove apt lists here - OpenSSL libraries are needed at runtime
RUN npm ci --only=production && \
    rm -rf /tmp/*

# Expose port (Railway sets PORT automatically)
EXPOSE 4000

# Start application
CMD ["node", "dist/main.js"]
