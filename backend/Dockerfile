# Backend (NestJS) - Railway optimized
# Use node:20 (not slim) which includes OpenSSL, or install it properly

FROM node:20

# Install OpenSSL and ensure it's available
RUN apt-get update -y && \
    apt-get install -y openssl libssl-dev ca-certificates && \
    rm -rf /var/lib/apt/lists/* && \
    ldconfig

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
