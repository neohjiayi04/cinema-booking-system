# Build stage
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Vite bakes these in at build time. The defaults are same-origin paths: nginx
# (nginx.conf) forwards /api and /ws to the backend container, so the site works
# from any computer that can reach this host. Never use "localhost" here: inside a
# visitor's browser it would mean the visitor's own machine.
ARG VITE_API_URL=/api
ARG VITE_WS_URL=/ws
ENV VITE_API_URL=$VITE_API_URL VITE_WS_URL=$VITE_WS_URL
RUN npm run build

# Serve stage
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80