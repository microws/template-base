FROM public.ecr.aws/docker/library/node:20-alpine as base
ENV APP_HOME="/root/app"

WORKDIR ${APP_HOME}
COPY package*.json ${APP_HOME}
RUN --mount=type=bind,readwrite,target=/root/cache/,source=/root/.npm,from=localcache --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci --cache /root/cache/

from base as build
ENV APP_HOME="/root/app"
WORKDIR ${APP_HOME}
COPY . ${APP_HOME}/
RUN npm run build:server
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm prune --omit=dev

FROM public.ecr.aws/docker/library/node:20-alpine as dist
ENV APP_HOME="/root/app"
RUN mkdir -p  ${APP_HOME}
WORKDIR ${APP_HOME}
COPY --from=build ${APP_HOME}/node_modules ${APP_HOME}/node_modules/
COPY --from=build ${APP_HOME}/dist/docker/ ${APP_HOME}/
COPY --from=build ${APP_HOME}/package.json ${APP_HOME}/
CMD ["node", "server.js"]