FROM node:24-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production \
    WIS_LOCAL_PORT=3010 \
    WIS_BIND_HOST=0.0.0.0

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY local ./local
COPY public ./public
COPY docs/api.openapi.json ./docs/api.openapi.json

RUN mkdir -p /app/.local && chown -R node:node /app
USER node

EXPOSE 3010
CMD ["npm", "start"]
