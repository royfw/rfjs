ARG NODE_VERSION=22.12
ARG NODE_IMAGE_BUILD=node:${NODE_VERSION}
ARG NODE_IMAGE=node:${NODE_VERSION}-slim

# FROM base
FROM ${NODE_IMAGE_BUILD} AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@10

COPY . /app
WORKDIR /app

# FROM base AS prod-deps
# RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install  --frozen-lockfile
RUN pnpm build

# FROM prod
FROM ${NODE_IMAGE} AS prod

# slim image
# Install dependencies and configure timezone
RUN apt-get update \
  && apt-get install -y --no-install-recommends tzdata \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Configure the timezone
ENV TZ=Asia/Taipei
RUN ln -sf /usr/share/zoneinfo/$TZ /etc/localtime \
  && echo $TZ > /etc/timezone

WORKDIR /app
# COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist
COPY --from=build /app/package.json /app
EXPOSE 3000

CMD [ "node", "dist/main.js" ]