# syntax=docker/dockerfile:1

ARG TURBO_SCOPE=api          # package name
ARG TURBO_APP_PATH=apps/api  # 專案路徑

ARG NODE_VERSION=24.16
ARG NODE_IMAGE=node:${NODE_VERSION}-slim
# ARG NODE_IMAGE_BUILD=node:${NODE_VERSION}
ARG NODE_IMAGE_BUILD=node:${NODE_VERSION}-slim

#############################
# Base image
#############################
FROM $NODE_IMAGE AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

#########################################
# 1. turbo prune
#########################################
FROM base AS prune

ARG TURBO_SCOPE

COPY . .

RUN pnpm dlx turbo prune --scope=${TURBO_SCOPE} --docker

#########################################
# 2. prod-deps：只裝 prod 相依
#########################################
FROM base AS prod-deps
WORKDIR /app

COPY --from=prune /app/out/json/ ./
COPY --from=prune /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

# 🔴 關掉 scripts：避免 preinstall / prepare / husky 等在 Docker 裡跑
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
  pnpm install --prod --frozen-lockfile --ignore-scripts

#########################################
# 3. build：裝 dev 相依 + build
#########################################
FROM base AS build
WORKDIR /app

COPY --from=prune /app/out/full/ ./
COPY --from=prune /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

# 一樣關掉 scripts，build 不需要跑 husky 等
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
  pnpm install --frozen-lockfile --ignore-scripts

ARG TURBO_SCOPE
RUN pnpm turbo run build --filter=${TURBO_SCOPE}...

#########################################
# 4. runtime：只帶 prod node_modules + dist
#########################################
FROM $NODE_IMAGE_BUILD AS runner

# Configure the timezone
ENV TZ=Asia/Taipei
RUN ln -sf /usr/share/zoneinfo/$TZ /etc/localtime \
  && echo $TZ > /etc/timezone

WORKDIR /app
ENV NODE_ENV=production
ENV NODE_OPTIONS=--enable-source-maps

# prod node_modules（workspace 相關包都在這）
COPY --from=prod-deps /app/node_modules /app/node_modules

# app dist + package.json
ARG TURBO_APP_PATH
WORKDIR /app/${TURBO_APP_PATH}
COPY --from=build /app/${TURBO_APP_PATH}/dist ./dist
COPY --from=prod-deps /app/${TURBO_APP_PATH}/node_modules ./node_modules
COPY --from=build /app/${TURBO_APP_PATH}/package.json ./package.json

EXPOSE 3000
CMD ["node", "dist/main.js"]
