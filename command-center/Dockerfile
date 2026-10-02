FROM node:20-alpine

WORKDIR /app

COPY package.json server.mjs sheets-live.mjs costs.mjs hotel-research.mjs hotel-research-worker.mjs ./
COPY out ./out

RUN mkdir -p /app/config /app/runtime && chown -R node:node /app

USER node
ENV NODE_ENV=production \
    PORT=4174 \
    WIS_BIND_HOST=0.0.0.0 \
    WIS_STANDALONE_ROOT=/app \
    WIS_REQUIRE_AUTH=true \
    WIS_SHEETS_REFRESH_SECONDS=30

EXPOSE 4174

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4174/health || exit 1

CMD ["node", "server.mjs"]
