module.exports = {
  pages: {
    // popup: {
    //   template: 'public/browser-extension.html',
    //   entry: './src/popup/main.js',
    //   title: 'UND Web Wallet'
    // },
    standalone: {
      template: "public/browser-extension.html",
      entry: "./src/standalone/main.js",
      title: "UND Web Wallet",
      filename: "standalone.html",
    },
    index: {
      template: "public/index.html",
      entry: "./src/web/main.js",
      title: "UND Web Wallet",
      filename: "index.html",
    },
  },
  pluginOptions: {
    browserExtension: {
      componentOptions: {
        background: {
          entry: "src/background.js",
        },
      },
    },
  },
  configureWebpack: {
    // devtool: "cheap-module-source-map",
  },
}
