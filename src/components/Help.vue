<template>
  <b-jumbotron header="Web Wallet" lead="Unification's Mainchain web wallet">
    <p>
      Welcome to the Unification Mainchain Web wallet.
    </p>

    <h3>Network</h3>

    <p>
      Please ensure you are connected to the correct network <em>before</em> unlocking your wallet and
      executing any transactions.
    </p>

    <h3>Security</h3>

    <p v-show="isShowHostedWarning" class="text-warning">
      <b>
        This hosted version of Web Wallet should only be used for testing, and only on either TestNet or
        DevNet using test wallets. <em>Use on MainNet at your own risk!</em>
      </b>
    </p>

    <p v-show="isWeb">
      <b>
        <em>
          <span class="text-info">
            The best way to use Web Wallet is to install the
            <a
              href="https://chrome.google.com/webstore/detail/mkjjflkhdddfjhonakofipfojoepfndk"
              target="_blank"
            >
              Chrome Browser extension
            </a>
          </span>
        </em>
      </b>
    </p>

    <p>
      Web Wallet is "client side only", meaning your wallet file and private key are
      <b><em>never</em></b> transmitted or sent over the web. All transactions are signed <em>locally</em>,
      and only the final signed transaction is broadcast to the network.
    </p>

    <p>
      For an additional layer of security, run you own full node and
      <a href="https://docs.unification.io/software/light-client-rpc.html">REST light client</a>
      and connect to it so that your transactions are broadcast to the network via a node that you own and
      trust.
    </p>

    <h3>Create a new wallet</h3>

    <p>
      To get started, click on the "Create New Wallet" button, and choose a secure password to encrypt the
      wallet. Once generated, the dialog will output your unique Mnemonic - DO NOT LOSE THIS! If you lose
      this, you will not be able to recover your wallet and accounts. Unification <b>cannot</b> recover this
      for you, as it never leaves your computer.
    </p>

    <p>Once generated, click "Download" to save your wallet file.</p>

    <h3>Unlock a Wallet</h3>

    <p>
      Click on "Unlock Wallet" to open your wallet file. Select the file you have downloaded, and enter your
      password to unlock the wallet.
    </p>

    <h3>Close Wallet</h3>

    <p>
      To close a loaded wallet, just click "Close Wallet". This will unload all wallet data, and clear your
      session
    </p>

    <p class="small">
      <strong>Disclaimer</strong>
    </p>
    <p class="small">
      Please note that this software is still in development. Any use of this open source
      <a href="https://github.com/unification-com/mainchain/blob/master/LICENSE" target="_blank">
        Apache 2.0 licensed</a
      >
      software is done at your own risk and on a "AS IS" basis, without warranties or conditions of any kind,
      and any and all liability of the Unification Foundation and/or the Unification dev team for damages
      arising in connection to the software is excluded. Please exercise caution!
    </p>
  </b-jumbotron>
</template>

<script>
export default {
  name: "Help",
  props: {
    isWeb: Boolean,
  },
  data() {
    return {
      isShowHostedWarning: false,
    }
  },
  mounted() {
    if (process.env.VUE_APP_HOSTED === "true") {
      this.isShowHostedWarning = true
    }
  },
}
</script>
