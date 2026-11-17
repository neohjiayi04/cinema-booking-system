# Build stage
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Vite bakes these in at build time. Change defaults to your deployed URLs.
ARG VITE_API_URL=http://localhost:3001/api
ARG VITE_WS_URL=ws://localhost:3001
ENV VITE_API_URL=$VITE_API_URL VITE_WS_URL=$VITE_WS_URL
RUN npm run build

# Serve stage
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80