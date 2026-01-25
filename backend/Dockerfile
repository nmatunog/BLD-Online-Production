# Backend (NestJS) - Railway optimized
# Use Debian-based image with OpenSSL 3.0

FROM node:20-bullseye

# Install OpenSSL 1.1 (Debian Bullseye uses OpenSSL 1.1.1)
# This matches Prisma's debian-openssl-1.1.x binary target
RUN apt-get update -y && \
    apt-get install -y openssl libssl1.1 libssl-dev ca-certificates && \
    rm -rf /var/lib/apt/lists/* && \
    ldconfig && \
    # Verify OpenSSL is available
    openssl version

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
RUN npm ci --only=production && \
    rm -rf /tmp/* && \
    rm -rf /var/lib/apt/lists/*

# Expose port (Railway sets PORT automatically)
EXPOSE 4000

# Start application
CMD ["node", "dist/main.js"]
