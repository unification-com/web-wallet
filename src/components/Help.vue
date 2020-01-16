<template>
    <b-jumbotron header="Web Wallet" lead="Unification's Mainchain web wallet">
      <p>
        Welcome to the Unification Mainchain Web wallet.
      </p>

      <h3>Network</h3>

      <p>
        Please ensure you are connected to the correct network <em>before</em> unlocking your wallet and executing any transactions.
      </p>

      <h3>Security</h3>

      <p v-show="isShowHostedWarning" class="text-warning">
        <b>This hosted version of Web Wallet should preferably only be used for testing, and only on either TestNet or DevNet.
        <em>Use on MainNet at your own risk!</em></b>
      </p>

      <p v-show="isWeb">
        <b><em><span class="text-info">The most secure way to use Web Wallet is to install the Chrome Browser extension.</span></em></b>
        <span v-show="isShowHostedWarning">The next most secure method is to clone the Github repository and run the local Docker composition.</span>
      </p>

      <p>
        Web Wallet is "client side only", meaning your wallet file and private key are <b><em>never</em></b> transmitted or sent over the web.
        All transactions are signed <em>locally</em>, and only the final signed transaction is broadcast to the network.
      </p>

      <h3>Create a new wallet</h3>

      <p>
        To get stated, click on the "Create New Wallet" button, and choose a secure password to encrypt the wallet.
        Once generated, the dialog will output your unique Mnemonic - DO NOT LOSE THIS! If you lose this, you will
        not be able to recover your wallet and accounts. Unification <b>cannot</b> recover this for you, as it never leaves
        your computer.
      </p>

      <p>Once generated, click "Download" to save your wallet file.</p>

      <h3>Unlock a Wallet</h3>

      <p>Click on "Unlock Wallet" to open your wallet file. Select the file you have downloaded, and enter your password
      to unlock the wallet.</p>

      <h3>Close Wallet</h3>

      <p>To close a loaded wallet, just click "Close Wallet". This will unload all wallet data, and clear your session</p>
    </b-jumbotron>
</template>

<script>
  export default {
    name: 'help',
    props: {
      isWeb: Boolean
    },
    data: function() {
      return {
        isShowHostedWarning: false
      }
    },
    mounted: function() {
      if(process.env.VUE_APP_HOSTED === "true") {
        this.isShowHostedWarning = true
      }
    }
  }
</script>