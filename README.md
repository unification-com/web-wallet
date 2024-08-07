![Unification](https://raw.githubusercontent.com/unification-com/mainchain/master/unification_logoblack.png "Unification")

# Unification Mainchain Web wallet

Official Unification Mainchain Web-based wallet.

**Please Note** this is currently heavily under development.

Two options are currently available - running as a [Google Chrome browser
extension](https://chrome.google.com/webstore/detail/mkjjflkhdddfjhonakofipfojoepfndk),
 or running as a local (Dockerised) web application.

**The best method is to install the 
[Google Chrome browser extension](https://chrome.google.com/webstore/detail/mkjjflkhdddfjhonakofipfojoepfndk)**

## Running the Dockerised web application locally

If you don't use Chrome, the production version of the web application
can be run in a Docker environment:

```bash
docker-compose -f Docker/docker-compose.yml up --build
```

Alternativey, using the `make` target:

```bash
make docker-wallet
```

The Web Wallet will be available on http://localhost:8080

## Development and Testing

To develop, test, or run the Web Wallet locally, follow the guide below.

Note: requires Node JS >=v14.17.6

### Project setup

To set up the environment, first install the node dependencies:

```bash
yarn install
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
yarn run serve:web
```

By default, this will open the application in your browser at http://localhost:8080

Any changes to the code will automatically be relaoded, and the browser refreshed.

#### Chrome Extension

For development and testing of the Chrome Extension, run the following:

```bash
yarn run serve
```

The process is similar, with some additional steps:

1. Open Google Chrome, and naviagte to chrome://extensions
2. Enable Developer Mode by clicking on the toggle in the top right
3. Click on the "Load Unpacked" button in the top left
4. Select the `dist` directory

This will load the extension, and you should see the Extension button for Web wallet
in your browser.

Any code changes made are hot-reloaded, but the tab with the extension loaded
must be manually refreshed.

### Compiles and minifies for production

As with the development process above, two options are available for building
the production bundles.

#### Web Application

The following command will build and optimise web application the code for 
production deployment:

```bash
yarn run build:web
```

The final code will be output to `dist/web`

#### Chrome Extension

The following command will build and optimise the chrome extension code for
production deployment:

```bash
yarn run build
```

The final code will be output to `dist/chrome-extension`

#### Dev Notes - post build actions

Manifest has been updated from v2 to v3. However, a couple of post-build actions are required:

1. Copy `src/background.js` to `dist/chrome-extension/js/background.js`, as the webpack version won't work.
2. Replace the same file in the `artifacts/web-wallet-VERSION-production.zip`

### Run unit tests

```bash
yarn run test:unit
```
