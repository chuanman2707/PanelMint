FROM node:20-alpine AS base

# -- Install deps --
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# -- Build Next.js --
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# -- Production image --
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/lib ./src/lib
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

# Run DB migrations then start Next.js
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
