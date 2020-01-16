FROM node:latest as build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY ./ .
RUN npm run build:web

FROM nginx as production-stage
RUN mkdir /app
COPY --from=build-stage /app/dist/web /app
COPY nginx.conf /etc/nginx/nginx.conf
