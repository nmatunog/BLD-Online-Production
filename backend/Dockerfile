# Backend (NestJS) - Railway optimized
# Install OpenSSL for Prisma compatibility

FROM node:20-slim

# Install OpenSSL 1.1 for Prisma (required)
RUN apt-get update -y && \
    apt-get install -y openssl libssl1.1 libssl-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (needed for build)
RUN npm ci

# Copy Prisma schema
COPY prisma ./prisma

# Generate Prisma Client
RUN npx prisma generate

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
