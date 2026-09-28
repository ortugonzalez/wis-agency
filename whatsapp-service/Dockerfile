FROM node:24-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production \
    WIS_LOCAL_PORT=3010 \
    WIS_BIND_HOST=0.0.0.0

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY --chown=node:node local ./local
COPY --chown=node:node public ./public
COPY --chown=node:node docs/api.openapi.json ./docs/api.openapi.json

RUN install -d -o node -g node /app/.local
USER node

EXPOSE 3010
CMD ["npm", "start"]
