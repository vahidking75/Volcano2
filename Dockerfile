# ---- Base ----
FROM node:20-bookworm-slim AS base
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# ---- Build ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- Run ----
FROM base AS runner
ENV NODE_ENV=production
# Render provides PORT; Next must listen on it
ENV PORT=10000

# SQLite will live on the persistent disk mount
ENV VOLCANO_DB_PATH=/var/data/volcano.db

COPY --from=builder /app ./

EXPOSE 10000
CMD ["sh", "-c", "npm run start -- -p $PORT"]
