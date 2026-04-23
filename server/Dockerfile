# Minimal Node image for the LevelX multiplayer relay.
# Alpine base keeps the image small (~60 MB compressed).
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund

COPY server.js ./

# Fly.io / Railway inject PORT; default to 8080 for local docker runs.
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
