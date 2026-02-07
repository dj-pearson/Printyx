# Printyx Production Dockerfile
# Multi-stage build for optimized production image

# ==============================================================================
# Stage 1: Dependencies
# ==============================================================================
FROM node:20-alpine AS deps

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++ git

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci --legacy-peer-deps

# ==============================================================================
# Stage 2: Builder
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build arguments
ARG NODE_ENV=production
ARG APP_VERSION=1.0.0

ENV NODE_ENV=${NODE_ENV}
ENV APP_VERSION=${APP_VERSION}

# Build the application
RUN npm run build

# Prune dev dependencies
RUN npm prune --production --legacy-peer-deps

# ==============================================================================
# Stage 3: Production Runner
# ==============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 printyx

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Copy built application
COPY --from=builder --chown=printyx:nodejs /app/dist ./dist
COPY --from=builder --chown=printyx:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=printyx:nodejs /app/package*.json ./

# Copy static assets if they exist
COPY --from=builder --chown=printyx:nodejs /app/client/dist ./client/dist

# Create logs directory
RUN mkdir -p /app/logs && chown -R printyx:nodejs /app/logs

# Switch to non-root user
USER printyx

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:5000/ready || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]
