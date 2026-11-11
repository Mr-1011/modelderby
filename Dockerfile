# Image of the race runner (backend/). It is at the repo root because the build
# needs shared/ and the pnpm lockfile, and Railway uses a root Dockerfile with no extra config.
FROM node:24-slim
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY shared ./shared
COPY backend ./backend
RUN pnpm install --frozen-lockfile --prod --filter horserace-backend...
ENV NODE_ENV=production
USER node
# Node runs the .ts files directly. Railway sets PORT.
CMD ["node", "backend/src/index.ts"]
