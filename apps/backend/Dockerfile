FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace root
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/
RUN npm ci --workspace=apps/backend

# Copy source
COPY apps/backend/ apps/backend/
RUN npm run build --workspace=apps/backend

# Production image
FROM node:20-alpine
RUN addgroup -g 1001 app && adduser -u 1001 -G app -s /bin/sh -D app

WORKDIR /app

# Copy built output + production deps
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/src/db/migrations ./dist/db/migrations

USER app
EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:3001/api/health || exit 1

CMD ["node", "dist/index.js"]
