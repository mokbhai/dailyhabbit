FROM node:22-slim AS build

WORKDIR /repo

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/config-typescript/package.json packages/config-typescript/package.json
COPY packages/types/package.json packages/types/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm turbo build --filter=@workspace-starter/api...

RUN pnpm deploy --legacy --filter @workspace-starter/api --prod /app

FROM node:22-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=build --chown=node:node /app /app

USER node

EXPOSE 3001

CMD ["node", "dist/main"]
