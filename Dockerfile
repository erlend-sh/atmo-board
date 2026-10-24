# The web app: SvelteKit with adapter-node, plus the shell tools the
# pre-deploy setup needs (curl, jq, psql). Built for Railway, and usable by
# anyone hosting the Compose bundle in infra/.
FROM oven/bun:1.4.0-alpine AS build
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build && bun install --production --frozen-lockfile

FROM node:22-alpine
WORKDIR /app
# curl, jq and psql are for appview/setup.sh, which runs before each deploy.
RUN apk add --no-cache curl jq postgresql17-client
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
COPY appview ./appview
COPY lexicons ./lexicons
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
EXPOSE 3000
# /data holds the OAuth session store, so it must be a volume.
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD curl -fsS http://127.0.0.1:3000/api/version || exit 1
CMD ["node", "build"]
