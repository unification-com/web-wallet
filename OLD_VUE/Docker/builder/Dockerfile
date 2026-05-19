FROM node:latest as build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY ./ .
RUN echo "VUE_APP_HOSTED=true" > /app/.env
RUN npm run build:web

RUN tar -c --transform='s,^dist/web/,dist/,' -zvf /web-wallet.tar.gz dist/web
RUN openssl dgst -sha256 /web-wallet.tar.gz > /web-wallet.tar.gz.sha
