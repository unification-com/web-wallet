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
          v-on:keydown.enter.prevent="preventSubmit"
          />
        </b-form-group>

        <b-form-group
        id="create-new-wallet-2"
        label="Confirm Password:"
        label-for="wallet-confirm-password"
        description="Confirm you password"
        >
          <b-form-input
          id="wallet-confirm-password"
          v-model="walletPassCheck"
          type="password"
          required
          placeholder="Confirm password"
          v-on:keydown.enter.prevent="preventSubmit"
          />
        </b-form-group>
      </b-form>
      <template v-slot:modal-footer>
        <b-button variant="success"
                  @click="showWallet"
                  aria-label="Create"
        >
          Create
        </b-button>
        <b-button
        @click="$bvModal.hide('bv-modal-create-wallet')"
        aria-label="Cancel"
        >
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
      <br/>
      <b-form-group id="mnemonic-saved-group">
        <b-form-checkbox-group id="mnemonic-saved">
          <b-form-checkbox v-model="isMnemonicSaved">I have saved this Mnemonic somewhere safe</b-form-checkbox>
        </b-form-checkbox-group>
      </b-form-group>
      <template v-slot:modal-footer>
        <b-button
        variant="success"
        @click="createWallet"
        aria-label="Create"
        v-show="isMnemonicSaved"
        >
          Download Wallet
        </b-button>
      </template>
    </b-modal>

    <b-modal id="bv-modal-please-wait" busy>
      <template v-slot:modal-title>
        <h3>Please wait</h3>
      </template>
      <div class="d-flex justify-content-center mb-3">
        <b-spinner label="Please wait"/>
      </div>
      <template v-slot:modal-footer>
        <p></p>
      </template>
    </b-modal>

    <!-- unlock wallet -->
    <b-modal id="bv-modal-unlock-wallet">
      <template v-slot:modal-title>
        <h3>Unlock Wallet on:<br> {{ chainId }}</h3>
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
          v-model="wallet.walletFile"
          :state="Boolean(wallet.walletFile)"
          placeholder="Choose your wallet file or drop it here..."
          drop-placeholder="Drop wallet file here..."
          @change="loadTextFromFile"
          ref="walletFileInput"
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
          v-on:keydown.enter.prevent="preventSubmit"
          />
        </b-form-group>
      </b-form>
      <template v-slot:modal-footer>
        <b-button
        variant="success"
        @click="unlockWallet"
        aria-label="Unlock"
        >
          Unlock Wallet
        </b-button>
        <b-button
        @click="$bvModal.hide('bv-modal-unlock-wallet')"
        aria-label="Cancel"
        >
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
        <b-button
        variant="success"
        @click="$bvModal.hide('bv-modal-wallet-downloaded')"
        aria-label="OK"
        >
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
          v-on:keydown.enter.prevent="preventSubmit"
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
          v-on:keydown.enter.prevent="preventSubmit"
          />
        </b-form-group>
      </b-form>

      <template v-slot:modal-footer>
        <b-button
        variant="success"
        @click="recoverWallet"
        aria-label="Recover"
        >
          Recover Wallet
        </b-button>
        <b-button
        @click="$bvModal.hide('bv-modal-recover-wallet')"
        aria-label="Cancel"
        >
          Cancel
        </b-button>
      </template>
    </b-modal>

    <div class="main-container">
      <Unlocked v-show="wallet.isWalletUnlocked" ref="unlockedcomponent"/>
      <Help v-show="!wallet.isWalletUnlocked" v-bind:is-web="isWeb"/>
    </div>
  </div>
</template>

<script>
  import axios from 'axios'
  import { mapState } from 'vuex'
  const UndClient = require('@unification-com/und-js')

  import Unlocked from '@/components/Unlocked.vue'
  import Help from '@/components/Help.vue'

  export default {
    name: 'Wallet',
    components: {
      Unlocked,
      Help
    },
    props: {
      isWeb: Boolean
    },
    computed: {
      ...mapState({
        client: state => state.client.client,
        chainId: state => state.client.chainId,
        isClientConnected: state => state.client.isConnected,
        wallet: state => state.wallet,
        txs: state => state.txs,
        validators: state => state.validators,
        delegations: state => state.delegations
      }),
    },
    data: function () {
      return {
        rest: 'https://rest-testnet.unification.io',
        isMnemonicSaved: false,
        mnemonic: null,
        walletPass: null,
        walletPassCheck: null
      }
    },
    mounted: function () {
      this.initChain()
    },
    methods: {
      preventSubmit: function() {
        return false
      },
      showUnlockWalletModal() {
        this.clearWalletData()
        this.$bvModal.show('bv-modal-unlock-wallet')
      },
      showRecoverWalletModal() {
        this.clearWalletData()
        this.$bvModal.show('bv-modal-recover-wallet')
      },
      initChain: async function () {
        await this.$store.dispatch('client/clearClient')
        try {
          let client = new UndClient(this.rest)
          await client.initChain()
          if (this.wallet.privateKey !== null) {
            client.setPrivateKey(this.wallet.privateKey, true)
          }

          axios.get(this.rest + '/node_info')
          .then((result) => {
            if(result.status === 200) {
              this.$store.dispatch('client/setNodeInfo', result.data)
            }
          })

          await this.$store.dispatch('client/setClient', client)
        } catch(e) {
          this.showToast('danger', 'Error', 'Error connecting to ' + this.rest + ' - ' + e.toString())
          await this.$store.dispatch('client/clearClient')
          await this.clearWalletData()
        }
      },
      closeWallet: async function() {
        this.clearWalletData()
        this.initChain()
      },
      clearWalletData: async function () {
        await this.$store.dispatch('wallet/clearWallet')
        await this.$store.dispatch('txs/clearTxs')
        await this.$store.dispatch('validators/clearValidators')
        await this.$store.dispatch('delegations/clearAll')
        this.isMnemonicSaved = false
        this.walletPass = null
        this.walletPassCheck = null
        this.mnemonic = null
        this.$refs.unlockedcomponent.clearFormData()
      },
      changeNetwork: async function (network) {
        await this.clearWalletData()
        if(!this.isValidRestUrl(network)) {
          this.showToast('danger', 'Error', 'enter a valid REST URL: "' + network + '" invalid')
          return false
        }
        this.rest = network
        this.initChain()
      },
      newWallet: function () {
        this.clearWalletData()
        this.$bvModal.show('bv-modal-create-wallet')
      },
      showWallet: async function () {
        if (this.walletPass.length < 8) {
          this.showToast('danger', 'Error', 'enter a password > 8 chars')
          return false
        }
        if (this.walletPass !== this.walletPassCheck) {
          this.showToast('danger', 'Error', 'passwords do not match')
          return false
        }

        this.mnemonic = UndClient.crypto.generateMnemonic()

        let privateKey =  UndClient.crypto.getPrivateKeyFromMnemonic(this.mnemonic)
        await this.$store.dispatch('wallet/setPrivateKey', privateKey)
        let address = UndClient.crypto.getAddressFromPrivateKey(this.wallet.privateKey, 'und')
        await this.$store.dispatch('wallet/setAddress', address)

        this.$bvModal.hide('bv-modal-create-wallet')
        this.$bvModal.show('bv-modal-download-wallet')
      },
      createWallet: async function () {
        this.$bvModal.hide('bv-modal-download-wallet')
        this.$bvModal.show('bv-modal-please-wait')
        await this.wait(300)
        this.generateWallet()
      },
      generateWallet: function() {
        const keystore = UndClient.crypto.generateKeyStore(this.wallet.privateKey, this.walletPass)
        this.download(JSON.stringify(keystore), 'und-wallet_' + keystore.id + ".json", "text/json")
        this.$bvModal.hide('bv-modal-please-wait')
        this.$bvModal.show('bv-modal-wallet-downloaded')
        this.clearWalletData()
      },
      download: function (content, fileName, contentType) {
        var a = document.createElement("a");
        var file = new Blob([content], {type: contentType});
        a.href = URL.createObjectURL(file);
        a.download = fileName;
        a.click();
      },
      recoverWallet: async function() {
        if (this.walletPass.length < 8) {
          this.showToast('danger', 'Error', 'enter a password > 8 chars')
          return false
        }
        if (this.walletPass !== this.walletPassCheck) {
          this.showToast('danger', 'Error', 'passwords do not match')
          return false
        }

        try {
          let privateKey =  UndClient.crypto.getPrivateKeyFromMnemonic(this.mnemonic)
          await this.$store.dispatch('wallet/setPrivateKey', privateKey)
        } catch(e) {
          this.showToast('danger', 'Error', e.toString())
          return false
        }

        let address = UndClient.crypto.getAddressFromPrivateKey(this.wallet.privateKey, 'und')
        await this.$store.dispatch('wallet/setAddress', address)

        this.$bvModal.hide('bv-modal-recover-wallet')
        this.$bvModal.show('bv-modal-please-wait')
        await this.wait(300)
        this.generateWallet()
      },
      loadTextFromFile: function(ev) {
        this.loadTextFromFileAsync(ev)
      },
      loadTextFromFileAsync: async function (ev) {
        await this.$store.dispatch('wallet/setWalletFile', ev.target.files[0])
      },
      unlockWallet: function () {
        if (this.wallet.walletFile === null) {
          this.showToast('danger', 'Error', 'select your wallet file')
          return false
        }
        if (this.walletPass === null) {
          this.showToast('danger', 'Error', 'enter your wallet password')
          return false
        }
        const reader = new FileReader();
        reader.onload = e => this.loadWallet(e);
        reader.readAsText(this.wallet.walletFile);
      },
      loadWallet: async function (e) {
        this.$bvModal.hide('bv-modal-unlock-wallet')
        this.$bvModal.show('bv-modal-please-wait')
        await this.wait(300)
        if(this.isClientConnected) {
          try {
            await this.$store.dispatch('wallet/setJson', e.target.result)
            const res = this.client.recoverAccountFromKeystore(e.target.result, this.walletPass)

            await this.$store.dispatch('wallet/setPrivateKey', res.privateKey)
            await this.$store.dispatch('wallet/setAddress', res.address)

            await this.client.setPrivateKey(res.privateKey, true)

            this.walletPass = null
            await this.$store.dispatch('wallet/setIsWalletUnlocked', true)

            await this.$refs.unlockedcomponent.runOnUnlocked()
          } catch (e) {
            this.showToast('danger', 'Error', e.toString())
            this.clearWalletData()
          }
        } else {
          this.showToast('danger', 'Error', 'Not connected to network')
        }

        this.$bvModal.hide('bv-modal-please-wait')
      }
    }
  }
</script>
