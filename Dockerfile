# Debian slim rather than Alpine: the Prisma CLI ships prebuilt engine binaries
# and musl is the variant that goes wrong quietly.
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# `postinstall` runs `prisma generate`, so the client is built here and the
# layer is reused as long as the lockfile and schema are unchanged.
RUN npm ci

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next runs as a normal user; the app writes nothing outside /app.
RUN chown -R node:node /app
USER node

EXPOSE 3000

# The build happens on start, not here, and the reason is not laziness:
# `next build` prerenders pages that read from the database, so it needs a
# reachable Postgres — which does not exist during `docker build`. The compose
# file starts Postgres first and only then runs this.
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && npm run build && npm start"]
