# Unification Mainchain Web wallet

Official Unification  Mainchain Web-based wallet.

**Please Note** this is currently heavily under development.

## Project setup
```
npm install
```

### Compiles and hot-reloads for development
```
npm run serve
```

### Compiles and minifies for production
```
npm run build
```

### Run your unit tests
```
npm run test:unit
```

### Run dist in Docker

```bash
docker build . -t web-wallet
```

Run:

```bash
docker run -d -p 8080:80 web-wallet
```

Wallet available on http://localhost:8080
