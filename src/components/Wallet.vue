<template>
  <div class="wallet">
    <!-- create new wallet -->
    <b-modal id="bv-modal-create-wallet">
      <template v-slot:modal-title>
        <h3>Create New Wallet</h3>
      </template>
      <b-form @submit.prevent="preventSubmit">
        <b-form-group
          id="create-new-wallet-1"
          label="Password:"
          label-for="wallet-password"
          description="Enter a secure password for your new wallet"
        >
          <b-form-input
            id="wallet-password"
            v-model="walletPass"
            type="password"
            required
            placeholder="Enter password"
            @keydown.enter.prevent="preventSubmit"
          />
        </b-form-group>

        <b-form-group
          id="create-new-wallet-2"
          label="Confirm Password:"
          label-for="wallet-confirm-password"
          description="Confirm your password"
        >
          <b-form-input
            id="wallet-confirm-password"
            v-model="walletPassCheck"
            type="password"
            required
            placeholder="Confirm password"
            @keydown.enter.prevent="preventSubmit"
          />
        </b-form-group>
      </b-form>
      <template v-slot:modal-footer>
        <b-button variant="success" aria-label="Create" @click="showWallet">
          Create
        </b-button>
        <b-button aria-label="Cancel" @click="$bvModal.hide('bv-modal-create-wallet')">
          Cancel
        </b-button>
      </template>
    </b-modal>

    <!-- download new wallet -->
    <b-modal id="bv-modal-download-wallet">
      <template v-slot:modal-title>
        <h3>Save Your New Wallet</h3>
      </template>
      <p>
        This is your master Mnemonic. Please ensure you save this in a safe place
      </p>
      <p>
        <b><em>IMPORTANT - DO NOT LOSE THIS</em></b>
      </p>
      <h4 class="text-info">
        <b>{{ mnemonic }}</b>
      </h4>
      <br />
      <b-form-group id="mnemonic-saved-group">
        <b-form-checkbox-group id="mnemonic-saved">
          <b-form-checkbox v-model="isMnemonicSaved">
            I have saved this Mnemonic somewhere safe
          </b-form-checkbox>
        </b-form-checkbox-group>
      </b-form-group>
      <template v-slot:modal-footer>
        <b-button v-show="isMnemonicSaved" variant="success" aria-label="Create" @click="createWallet">
          Download Wallet
        </b-button>
      </template>
    </b-modal>

    <b-modal id="bv-modal-please-wait" busy>
      <template v-slot:modal-title>
        <h3>Please wait</h3>
      </template>
      <div class="d-flex justify-content-center mb-3">
        <b-spinner label="Please wait" />
      </div>
      <template v-slot:modal-footer>
        <p></p>
      </template>
    </b-modal>

    <!-- unlock wallet -->
    <b-modal id="bv-modal-unlock-wallet">
      <template v-slot:modal-title>
        <h3>
          Unlock Wallet on:<br />
          {{ chainId }}
        </h3>
      </template>
      <b-form @submit.prevent="preventSubmit">
        <b-form-group
          id="wallet-file"
          label="Wallet File:"
          label-for="unlock-wallet-file"
          description="Wallet File:"
        >
          <b-form-file
            id="unlock-wallet-file"
            ref="walletFileInput"
            v-model="wallet.walletFile"
            :state="Boolean(wallet.walletFile)"
            placeholder="Choose your wallet file or drop it here..."
            drop-placeholder="Drop wallet file here..."
            @change="loadTextFromFile"
          />
        </b-form-group>

        <b-form-group
          id="unlock-wallet"
          label="Wallet Password:"
          label-for="unlock-wallet-password"
          description="Enter the password to unlock your wallet"
        >
          <b-form-input
            id="unlock-wallet-password"
            v-model="walletPass"
            type="password"
            required
            placeholder="Wallet password"
            @keydown.enter.prevent="preventSubmit"
          />
        </b-form-group>
      </b-form>
      <template v-slot:modal-footer>
        <b-button variant="success" aria-label="Unlock" @click="unlockWallet">
          Unlock Wallet
        </b-button>
        <b-button aria-label="Cancel" @click="$bvModal.hide('bv-modal-unlock-wallet')">
          Cancel
        </b-button>
      </template>
    </b-modal>

    <!-- wallet downloaded -->
    <b-modal id="bv-modal-wallet-downloaded">
      <template v-slot:modal-title>
        <h3>Wallet Downloaded</h3>
      </template>
      <h4>Wallet file downloaded!</h4>
      <p>You can now unlock and use your wallet</p>
      <template v-slot:modal-footer>
        <b-button variant="success" aria-label="OK" @click="$bvModal.hide('bv-modal-wallet-downloaded')">
          OK
        </b-button>
      </template>
    </b-modal>

    <!-- recover wallet from mnemonic -->
    <b-modal id="bv-modal-recover-wallet">
      <template v-slot:modal-title>
        <h3>Recover Wallet</h3>
      </template>

      <p>
        Recover a wallet file from an existing Mnemonic
      </p>
      <b-form @submit.prevent="preventSubmit">
        <b-form-group
          id="wallet-mnemonic"
          label="Mnemonic:"
          label-for="recover-wallet-file"
          description="Enter your mnemonic to recover the wallet"
        >
          <b-form-textarea
            id="textarea"
            v-model="mnemonic"
            placeholder=""
            rows="3"
            max-rows="6"
            required
            trim
          />
        </b-form-group>
        <b-form-group
          id="recover-wallet-1"
          label="New Password:"
          label-for="recover-wallet-password"
          description="Enter a secure password for your wallet"
        >
          <b-form-input
            id="recover-wallet-password"
            v-model="walletPass"
            type="password"
            required
            placeholder="Enter password"
            @keydown.enter.prevent="preventSubmit"
          />
        </b-form-group>

        <b-form-group
          id="recover-wallet-2"
          label="Confirm Password:"
          label-for="recover-wallet-confirm-password"
          description="Confirm you password"
        >
          <b-form-input
            id="recover-wallet-confirm-password"
            v-model="walletPassCheck"
            type="password"
            required
            placeholder="Confirm password"
            @keydown.enter.prevent="preventSubmit"
          />
        </b-form-group>
      </b-form>

      <template v-slot:modal-footer>
        <b-button variant="success" aria-label="Recover" @click="recoverWallet">
          Recover Wallet
        </b-button>
        <b-button aria-label="Cancel" @click="$bvModal.hide('bv-modal-recover-wallet')">
          Cancel
        </b-button>
      </template>
    </b-modal>

    <!-- connect a Ledger device -->
    <!--
    Todo - enable when Ledger app released
    {{
    <b-modal id="bv-modal-connect-ledger">
      <template v-slot:modal-title>
        <h3>Connect Ledger</h3>
      </template>
      <p>
        Open the FUND Ledger app on your Nano S or Nano X.
      </p>
      <p><img class="img-centre" src="@/assets/images/ledger/ledger_FUND_app.png" /></p>
      <b-form @submit.prevent="preventSubmit">
        <b-form-group
          id="ledger-hd-path-1"
          label="Path:"
          label-for="ledger-hd-path"
          description="Select the HD Wallet Path"
        >
          <b-form-select
            id="ledger-hd-path"
            v-model="hdPath"
            required
            :disabled="disableHdPathSelect"
            :options="hdPathOptions"
            @change="selectLedgerWallet"
          >
          </b-form-select>
        </b-form-group>
      </b-form>

      <div class="ledger-notification-wrapper">
        <div class="ledger-notification green">
          <p>
            <span :class="{ wallet_address: wallet.address }">{{
              wallet.address || `Loading address for 44'/5555'/0'/0/${hdPath}`
            }}</span>
          </p>
        </div>
      </div>

      <div v-show="confirmOnLedger" class="ledger-notification-wrapper">
        <div class="ledger-notification">
          <p>
            Please confirm the address above matches the address displayed on your Ledger device.
          </p>
          <p><em>On the Ledger device</em>: scroll right and click OK to continue</p>
          <p><img class="img-centre" src="@/assets/images/ledger/ledger_ok.png" /></p>
        </div>
      </div>

      <template v-slot:modal-footer>
        <b-button
          v-show="!confirmOnLedger"
          variant="success"
          aria-label="Ledger"
          :disabled="disableHdPathSelect"
          @click="useLedgerDevice"
        >
          Use Ledger
        </b-button>
        <b-button
          v-show="!confirmOnLedger"
          aria-label="Cancel"
          :disabled="disableHdPathSelect"
          @click="$bvModal.hide('bv-modal-connect-ledger')"
        >
          Cancel
        </b-button>
      </template>
    </b-modal>
    }}
    -->

    <div class="main-container">
      <Unlocked v-show="wallet.isWalletUnlocked" ref="unlockedcomponent" lazy />
      <Help v-show="!wallet.isWalletUnlocked" :is-web="isWeb" />
    </div>
  </div>
</template>

<script>
import { mapState } from "vuex"
import Unlocked from "./Unlocked.vue"
import Help from "./Help.vue"

const { UndClient } = require("@unification-com/und-js-v2")
const semver = require("semver")

export default {
  name: "Wallet",
  components: {
    Unlocked,
    Help,
  },
  props: {
    isWeb: Boolean,
  },
  data() {
    return {
      rest: "https://rest.unification.io",
      isMnemonicSaved: false,
      mnemonic: null,
      privateKey: null,
      walletPass: null,
      walletPassCheck: null,
      hdPath: 0,
      disableHdPathSelect: false,
      undClient: null,
      confirmOnLedger: false,
      publicKey: null,
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
      governance: state => state.governance,
    }),
    hdPathOptions() {
      const hdPathOptions = []
      for (let i = 0; i < 100; i += 1) {
        hdPathOptions.push({ value: i, text: `44'/5555'/0'/0/${i}` })
      }
      return hdPathOptions
    },
  },
  mounted() {
    this.initChain()
  },
  methods: {
    preventSubmit() {
      return false
    },
    showUnlockWalletModal() {
      this.clearWalletData()
      this.$bvModal.show("bv-modal-unlock-wallet")
    },
    showRecoverWalletModal() {
      this.clearWalletData()
      this.$bvModal.show("bv-modal-recover-wallet")
    },
    // Todo - enable when Ledger app released
    // showConnectLedgerModal() {
    //   this.clearWalletData()
    //   this.$bvModal.show("bv-modal-connect-ledger")
    // },
    async initChain() {
      await this.clearWalletData()
      await this.$store.dispatch("client/clearClient")
      this.undClient = null
      try {
        this.undClient = new UndClient(this.rest)
        await this.undClient.initChain()
        const cosmosSemVer = semver.coerce(this.undClient?.node_app_version?.cosmos_sdk_version)
        const satisfies = semver.satisfies(cosmosSemVer, ">=0.42.11")

        if (!satisfies) {
          this.showToast(
            "error",
            "Error",
            `${this.rest} (${this.undClient.chainId}) is not running Cosmos SDK >= v0.42.11`,
          )
          return
        }
        await this.$store.dispatch("client/setIsConnected")
        await this.$store.dispatch("client/setChainId", this.undClient.chainId)
        await this.$store.dispatch("client/setNodeInfo", this.undClient.node_info)
        await this.$store.dispatch("client/setNodeAppVersion", this.undClient.node_app_version)
      } catch (e) {
        await this.$store.dispatch("client/clearClient")
        this.undClient = null
        await this.clearWalletData()
        this.showToast("error", "Error", `Error connecting to ${this.rest} - ${e.toString()}`)
      }
      if (this.undClient) {
        this.showToast("", "Connected", `Connected to ${this.undClient.chainId} on ${this.rest}`)
      }
    },
    async closeWallet() {
      await this.clearWalletData()
      await this.initChain()
      this.$refs.unlockedcomponent.tabIndex = 0
    },
    async clearWalletData() {
      // this.undClient.clean()
      await this.$store.dispatch("wallet/clearWallet")
      await this.$store.dispatch("txs/clearTxs")
      await this.$store.dispatch("validators/clearValidators")
      await this.$store.dispatch("delegations/clearAll")
      await this.$store.dispatch("governance/clearProposals")
      this.isMnemonicSaved = false
      this.walletPass = null
      this.privateKey = null
      this.walletPassCheck = null
      this.mnemonic = null
      this.$refs.unlockedcomponent.clearFormData()
    },
    async changeNetwork(network) {
      await this.clearWalletData()
      if (!network) {
        return false
      }
      const networkTrimmed = network.trim()
      if (!this.isValidRestUrl(networkTrimmed)) {
        this.showToast("error", "Error", `enter a valid REST URL: "${networkTrimmed}" invalid`)
        return false
      }
      this.rest = networkTrimmed
      await this.initChain()
      return true
    },
    newWallet() {
      this.clearWalletData()
      this.$bvModal.show("bv-modal-create-wallet")
    },
    async showWallet() {
      if (this.walletPass.length < 8) {
        this.showToast("error", "Error", "enter a password > 8 chars")
        return false
      }
      if (this.walletPass !== this.walletPassCheck) {
        this.showToast("error", "Error", "passwords do not match")
        return false
      }

      this.mnemonic = UndClient.crypto.generateMnemonic()

      const pk = UndClient.crypto.getPrivateKeyFromMnemonic(this.mnemonic)
      this.privateKey = pk.toString("hex")
      const address = UndClient.crypto.getAddressFromPrivateKey(this.privateKey, "und")
      await this.$store.dispatch("wallet/setAddress", address)

      this.$bvModal.hide("bv-modal-create-wallet")
      this.$bvModal.show("bv-modal-download-wallet")
      return true
    },
    async createWallet() {
      this.$bvModal.hide("bv-modal-download-wallet")
      this.$bvModal.show("bv-modal-please-wait")
      await this.wait(300)
      this.generateWallet()
    },
    generateWallet() {
      const keystore = UndClient.crypto.generateKeyStore(this.privateKey, this.walletPass)
      this.download(JSON.stringify(keystore), `und-wallet_${keystore.id}.json`, "text/json")
      this.$bvModal.hide("bv-modal-please-wait")
      this.$bvModal.show("bv-modal-wallet-downloaded")
      this.clearWalletData()
    },
    download(content, fileName, contentType) {
      const a = document.createElement("a")
      const file = new Blob([content], { type: contentType })
      a.href = URL.createObjectURL(file)
      a.download = fileName
      a.click()
    },
    async recoverWallet() {
      if (this.walletPass.length < 8) {
        this.showToast("error", "Error", "enter a password > 8 chars")
        return false
      }
      if (this.walletPass !== this.walletPassCheck) {
        this.showToast("error", "Error", "passwords do not match")
        return false
      }

      try {
        const pk = UndClient.crypto.getPrivateKeyFromMnemonic(this.mnemonic)
        this.privateKey = pk.toString("hex")
      } catch (e) {
        this.showToast("error", "Error", e.toString())
        return false
      }

      const address = UndClient.crypto.getAddressFromPrivateKey(this.privateKey, "und")
      await this.$store.dispatch("wallet/setAddress", address)

      this.$bvModal.hide("bv-modal-recover-wallet")
      this.$bvModal.show("bv-modal-please-wait")
      await this.wait(300)
      this.generateWallet()
      return true
    },
    loadTextFromFile(ev) {
      this.loadTextFromFileAsync(ev)
    },
    async loadTextFromFileAsync(ev) {
      await this.$store.dispatch("wallet/setWalletFile", ev.target.files[0])
    },
    unlockWallet() {
      if (this.wallet.walletFile === null) {
        this.showToast("error", "Error", "select your wallet file")
        return false
      }
      if (this.walletPass === null) {
        this.showToast("error", "Error", "enter your wallet password")
        return false
      }
      const reader = new FileReader()
      reader.onload = e => this.loadWallet(e)
      reader.readAsText(this.wallet.walletFile)
      return true
    },
    async loadWallet(e) {
      this.$bvModal.hide("bv-modal-unlock-wallet")
      this.$bvModal.show("bv-modal-please-wait")
      await this.wait(300)
      if (this.isClientConnected) {
        try {
          const res = this.undClient.recoverAccountFromKeystore(e.target.result, this.walletPass)
          await this.undClient.setPrivateKey(res.privateKey, true)
          await this.$store.dispatch("wallet/setAddress", res.address)
          await this.$store.dispatch("client/setClient", this.undClient)
          this.walletPass = null
          await this.$store.dispatch("wallet/setIsWalletUnlocked", true)

          await this.$refs.unlockedcomponent.runOnUnlocked()
        } catch (err) {
          this.showToast("error", "Error", err.toString())
          await this.clearWalletData()
        }
      } else {
        this.showToast("error", "Error", "Not connected to network")
        await this.clearWalletData()
      }

      this.$bvModal.hide("bv-modal-please-wait")
    },
    // Todo - enable when Ledger app released
    // async selectLedgerWallet() {
    //   await this.$store.dispatch("wallet/setAddress", null)
    //   this.disableHdPathSelect = true
    //   if (this.isClientConnected) {
    //     try {
    //       await this.undClient.useLedgerSigningDelegate(this.hdPath)
    //       await this.$store.dispatch("wallet/setAddress", this.undClient.address)
    //       this.disableHdPathSelect = false
    //     } catch (e) {
    //       this.showToast("error", "Error", e.toString())
    //       await this.clearWalletData()
    //       this.disableHdPathSelect = false
    //       this.$bvModal.hide("bv-modal-connect-ledger")
    //     }
    //   } else {
    //     this.showToast("error", "Error", "Not connected to network")
    //     await this.clearWalletData()
    //     this.disableHdPathSelect = false
    //     this.$bvModal.hide("bv-modal-connect-ledger")
    //   }
    // },
    // async useLedgerDevice() {
    //   if (this.isClientConnected) {
    //     this.confirmOnLedger = true
    //     try {
    //       const confirmedAddress = await this.undClient.confirmLedgerAddress()
    //       if (confirmedAddress !== this.wallet.address) {
    //         this.showToast(
    //           "error",
    //           "Error",
    //           `address mismatch: Confirmed on Ledger "${confirmedAddress}" != ${this.wallet.address}`,
    //         )
    //         this.confirmOnLedger = false
    //         await this.clearWalletData()
    //         this.$bvModal.hide("bv-modal-please-wait")
    //       }
    //       this.confirmOnLedger = false
    //       this.$bvModal.hide("bv-modal-connect-ledger")
    //       this.$bvModal.show("bv-modal-please-wait")
    //       await this.$store.dispatch("client/setClient", this.undClient)
    //       await this.$store.dispatch("wallet/setIsWalletUnlocked", true)
    //       await this.$refs.unlockedcomponent.runOnUnlocked()
    //       this.$bvModal.hide("bv-modal-please-wait")
    //     } catch (e) {
    //       this.confirmOnLedger = false
    //       this.showToast("error", "Error", e.toString())
    //       await this.clearWalletData()
    //       this.$bvModal.hide("bv-modal-please-wait")
    //     }
    //   } else {
    //     this.confirmOnLedger = false
    //     this.showToast("error", "Error", "Not connected to network")
    //     await this.clearWalletData()
    //     this.$bvModal.hide("bv-modal-please-wait")
    //   }
    // },
  },
}
</script>
