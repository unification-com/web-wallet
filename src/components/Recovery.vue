<template>
  <div>
    <b-modal id="bv-modal-show-recovery" size="lg" hide-header-close @hidden="resetInput()">
      <template v-slot:modal-title>
        <h3>Recover your private key</h3>
      </template>

      <b-form>
        <b-form-group
          id="recover-wallet"
          label="Wallet Password:"
          label-for="recover-wallet-password"
          description="Enter your password to recover your private key"
        >
          <b-form-input
            id="recover-wallet-password"
            v-model="walletPass"
            type="password"
            required
            placeholder="Wallet password"
            @keydown.enter.prevent="preventSubmit"
          />
        </b-form-group>

        <b-form-group
          id="recover-wallet-private-key-label"
          label="Your Private Key"
          label-for="recover-wallet-private-key"
          description="Click the 'eye' button to reveal your private key"
        >
          <b-input-group>
            <b-form-input
              id="recover-wallet-private-key"
              v-model="privateKey"
              :type="inputType"
              readonly
              required
              placeholder="Your private key will be displayed here..."
              @keydown.enter.prevent="preventSubmit"
            />
            <b-input-group-append>
              <b-button variant="outline-success" @click="toggleKeyVisibility">
                <b-icon-eye />
              </b-button>
            </b-input-group-append>
          </b-input-group>
        </b-form-group>
      </b-form>

      <template v-slot:modal-footer>
        <b-button variant="success" aria-label="Unlock" @click="unlockWallet">
          Show private key
        </b-button>
        <b-button variant="primary" @click="$bvModal.hide('bv-modal-show-recovery')">
          Close
        </b-button>
      </template>
    </b-modal>

    <b-button variant="primary" @click="$bvModal.show('bv-modal-show-recovery')">
      Show private key
    </b-button>
  </div>
</template>

<script>
import { mapState } from "vuex"

export default {
  name: "Recovery",
  data() {
    return {
      rest: "https://rest.unification.io",
      walletPass: null,
      undClient: null,
      privateKey: null,
      inputType: "password",
    }
  },
  computed: {
    ...mapState({
      client: state => state.client.client,
      chainId: state => state.client.chainId,
      isClientConnected: state => state.client.isConnected,
      wallet: state => state.wallet,
      txs: state => state.txs,
      validators: state => state.validators,
      delegations: state => state.delegations,
    }),
  },
  methods: {
    preventSubmit() {
      return false
    },
    resetInput() {
      this.privateKey = undefined
      this.walletPass = undefined
      this.inputType = "password"
    },
    toggleKeyVisibility() {
      if (this.inputType === "password") {
        this.inputType = "text"
      } else {
        this.inputType = "password"
      }
    },
    unlockWallet() {
      const reader = new FileReader()
      reader.onload = e => this.loadWallet(e)
      reader.readAsText(this.wallet.walletFile)
    },
    loadTextFromFile(ev) {
      this.loadTextFromFileAsync(ev)
    },
    async loadTextFromFileAsync(ev) {
      await this.$store.dispatch("wallet/setWalletFile", ev.target.files[0])
    },
    async loadWallet(e) {
      await this.wait(300)
      if (this.isClientConnected) {
        try {
          // this.undClient = new UndClient(this.rest)
          const res = this.client.recoverAccountFromKeystore(e.target.result, this.walletPass)
          this.privateKey = res.privateKey
        } catch (err) {
          this.showToast("error", "Error", err.toString())
          this.resetInput()
        }
      } else {
        this.showToast("error", "Error", "Not connected to network")
        this.resetInput()
      }

      this.$bvModal.hide("bv-modal-please-wait")
    },
  },
}
</script>

<style scoped></style>
