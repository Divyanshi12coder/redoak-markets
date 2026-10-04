# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Empty VITE_API_URL = same-origin: nginx below proxies /api to the backend service.
ARG VITE_API_URL=""
ARG VITE_GITHUB_URL=""
ENV VITE_API_URL=$VITE_API_URL VITE_GITHUB_URL=$VITE_GITHUB_URL
RUN npm run build

# ---- serve ----
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
