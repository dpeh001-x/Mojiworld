# LevelX backend image — Node 22 on Alpine. node:sqlite is built in
# (experimental in 22, stable in 24+) so no native module compile is
# needed. Single-stage build keeps the image tiny.

FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server.js auth.js ./

# Fly.io / Railway inject PORT; default to 8080 for local docker runs.
ENV PORT=8080
ENV NODE_ENV=production
# SECRET must be supplied via env (`fly secrets set` / Railway variables).
# If not set and NODE_ENV=production, the server refuses to boot.

# SQLite DB lives in /app/data. Mount a volume here for persistence
# across redeploys.  Fly.io:  `fly volumes create levelx_data --size 1`
# then in fly.toml:
#   [mounts] source = "levelx_data"  destination = "/app/data"
VOLUME /app/data
ENV DB_PATH=/app/data/levelx.db

EXPOSE 8080
CMD ["node", "server.js"]
