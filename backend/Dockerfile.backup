# Backend (NestJS) - Railway optimized
# Use full Node image which includes OpenSSL

FROM node:20

# Install OpenSSL and development libraries
# Using full node:20 image which should have OpenSSL, but ensure it's available
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends \
        openssl \
        libssl-dev \
        ca-certificates && \
    # Verify OpenSSL is installed
    openssl version && \
    # Find and list all libssl libraries
    find /usr/lib* -name "libssl.so*" 2>/dev/null && \
    # Update library cache
    ldconfig && \
    # Show library search paths
    ldconfig -p | grep ssl || true && \
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
