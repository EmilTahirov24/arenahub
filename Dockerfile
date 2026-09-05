# Debian slim rather than Alpine: the Prisma CLI ships prebuilt engine binaries
# and musl is the variant that goes wrong quietly.
FROM node:24-slim AS deps
WORKDIR /app

# Prisma's engines link against OpenSSL, which the slim images do not carry.
# `prisma generate` runs from postinstall, so it is needed here too.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# `postinstall` runs `prisma generate`, so the client is built here and the
# layer is reused as long as the lockfile and schema are unchanged.
RUN npm ci

FROM node:24-slim AS runner
WORKDIR /app

# Same reason as above: without OpenSSL, `prisma migrate deploy` fails at
# container start with an error that never reaches the browser.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

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
#
# NODE_ENV is deliberately NOT set to production in the image: `next build`
# needs the dev dependencies that npm would then skip.
CMD ["sh", "-c", "set -e; echo '--- migrate ---'; npx prisma migrate deploy; echo '--- seed ---'; npx prisma db seed; echo '--- build ---'; npm run build; echo '--- start ---'; npm start"]
