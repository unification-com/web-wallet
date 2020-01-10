FROM node:latest as build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY ./ .
RUN npm run build

RUN tar -cvzf /web-wallet.tar.gz dist
RUN openssl dgst -sha256 /web-wallet.tar.gz > /web-wallet.tar.gz.sha

