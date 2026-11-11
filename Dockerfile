# Built once on the build machine's platform; the runtime stage only copies files, so multi-arch needs no emulation.
FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm test && npm run build

# The sync server needs nothing but Node itself (node:sqlite, TypeScript type stripping).
# Data lives in /data, mounted from the project folder (see docker-compose.yaml).
FROM node:24-alpine
WORKDIR /app
ENV PORT=80 DATA_DIR=/data
COPY package.json ./
COPY --from=build /app/dist/index.html dist/index.html
COPY server/main.ts server/server.ts server/store.ts server/
EXPOSE 80
CMD ["node", "--disable-warning=ExperimentalWarning", "server/main.ts"]
