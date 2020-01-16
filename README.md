![Unification](https://raw.githubusercontent.com/unification-com/mainchain/master/unification_logoblack.png "Unification")

# Unification Mainchain Web wallet

Official Unification Mainchain Web-based wallet.

**Please Note** this is currently heavily under development.

Two options are currently available - running as a Google Chrome browser
extension, or running as either a hosted, or local web application.

**The most secure method is to install the Chrome browser extension**

## Running the web application locally

The production version of the web application can be run in a Docker environment:

```bash
docker-compose -f Docker/docker-compose.yml up --build
```

Alternativey, using the `make` target:

```bash
make docker-dev
```

The Web Wallet will be available on http://localhost:8080

## Development and Testing

To develop, test, or run the Web Wallet locally, follow the guide below

### Project setup

To set up the environment, first install the node dependencies:

```bash
npm install
```

### Compiles and hot-reloads for development

Both the web application and the Chrome extension use the same code-base.
However, there are two different methods for running the code, depending
on what is being developed/tested.

Thess methods should only be used during development, since the code is not
optimised, and features such as creating or unlocking a wallet will be much
slower than a production environment

#### Web Application

For development and testing, the Web Wallet can be run and hot-reloaded locally
by running:

```bash
npm run serve:web
```

By default, this will open the application in your browser at http://localhost:8080

Any changes to the code will automatically be relaoded, and the browser refreshed.

#### Chrome Extension

For development and testing of the Chrome Extension, run the following:

```bash
npm run serve
```

The process is similar, with some additional steps:

1. Open Google Chrome, and naviagte to chrome://extensions
2. Enable Developer Mode by clicking on the toggle in the top right
3. Click on the "Load Unpacked" button in the top left
4. Select the `dist` directory

This will load the extension, and you should see the Extension button for Web wallet
in your browser.

**Note:** code modifications are hot-reloaded into the `dist` directory,
but not in the extension itself. To see any changes, simply do steps 3 & 4
above again.

### Compiles and minifies for production

As with the development process above, two options are available for building
the production bundles.

#### Web Application

The following command will build and optimise web application the code for 
production deployment:

```bash
npm run build:web
```

The final code will be output to `dist/web`

#### Chrome Extension

The following command will build and optimise the chrome extension code for
production deployment:

```bash
npm run build
```

The final code will be output to `dist/chrome-extension`

### Run unit tests

```bash
npm run test:unit
```
