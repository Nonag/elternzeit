# Built once on the build machine's platform; the nginx stage only copies the file, so multi-arch needs no emulation.
FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm test && npm run build

FROM nginx:alpine
COPY --from=build /app/dist/index.html /usr/share/nginx/html/index.html
