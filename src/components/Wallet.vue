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
          v-model="wallet.walletPass"
          type="password"
          required
          placeholder="Enter password"
          v-on:keydown.enter.prevent="preventSubmit"
          />
        </b-form-group>

        <b-form-group
        id="create-new-wallet-2"
        label="Confirm:"
        label-for="wallet-confirm-password"
        description="Confirm you password"
        >
          <b-form-input
          id="wallet-confirm-password"
          v-model="wallet.walletPassCheck"
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
      <p>This is your master Mnemonic. IMPORTANT - DO NOT LOSE THIS</p>
      <h5>
        <b>{{ wallet.mnemonic }}</b>
      </h5>
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

    <!-- unlock wallet -->
    <b-modal id="bv-modal-unlock-wallet">
      <template v-slot:modal-title>
        <h3>Unlock Wallet on:<br> {{ chainId }}</h3>
      </template>
      <b-form @submit.prevent="preventSubmit">
        <b-form-group
        id="wallet file"
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
          v-model="wallet.walletPass"
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

    <div class="main-container">
      <Unlocked v-show="wallet.isWalletUnlocked" v-bind:wallet="this.wallet" v-bind:client="this.client"/>
      <Help v-show="!wallet.isWalletUnlocked"/>
    </div>
  </div>
</template>

<script>
  const UndClient = require('@unification-com/und-js')

  import Unlocked from '@/components/Unlocked.vue'
  import Help from '@/components/Help.vue'

  export default {
    name: 'Wallet',
    components: {
      Unlocked,
      Help
    },
    data: function () {
      return {
        rest: 'https://rest-testnet.unification.io',
        chainId: 'not connected',
        client: null,
        isMnemonicSaved: false,
        wallet: this.newEmptyWallet(),
      }
    },
    mounted: function () {
      this.initChain()
    },
    methods: {
      preventSubmit: function() {
        return false
      },
      newEmptyWallet: function () {
        let emptyWallet = {
          isWalletUnlocked: false,
          json: '',
          mnemonic: '',
          walletPass: '',
          walletPassCheck: '',
          walletFile: null,
          privateKey: '',
          balance: '0',
          balanceNund: '0',
          locked: '0',
          lockedNund: '0',
          address: '',
          staking: {
            totalRewards: '0',
            totalShares: '0',
            totalStaked: '0',
            totalUnbonding: '0',
            totalDelegations: 0
          },
          totalBalance: '0'
        }
        return emptyWallet
      },
      showUnlockWalletModal() {
        this.clearData()
        this.$bvModal.show('bv-modal-unlock-wallet')
      },
      initChain: async function () {
        try {
          let client = new UndClient(this.rest)
          await client.initChain()
          if (this.wallet.privateKey.length > 0) {
            client.setPrivateKey(this.wallet.privateKey, true)
          }
          this.client = client
          this.chainId = this.client.chainId
        } catch(e) {
          this.chainId = 'not connected'
          this.showToast('danger', 'Error connecting to ' + this.rest + ' - ' + e.toString())
        }
      },
      clearData: function () {
        this.wallet = null
        this.wallet = this.newEmptyWallet()
        this.isMnemonicSaved = false
      },
      changeNetwork: function (network) {
        this.clearData()
        this.rest = network
        this.initChain()
      },
      newWallet: function () {
        this.clearData()
        this.$bvModal.show('bv-modal-create-wallet')
      },
      showWallet: function () {

        if (this.wallet.walletPass.length < 8) {
          this.showToast('danger', 'enter a password > 8 chars')
          return false
        }
        if (this.wallet.walletPass !== this.wallet.walletPassCheck) {
          this.showToast('danger', 'passwords do not match')
          return false
        }

        this.wallet.mnemonic = UndClient.crypto.generateMnemonic()
        this.wallet.privateKey = UndClient.crypto.getPrivateKeyFromMnemonic(this.wallet.mnemonic)
        this.wallet.address = UndClient.crypto.getAddressFromPrivateKey(this.wallet.privateKey, 'und')

        this.$bvModal.hide('bv-modal-create-wallet')
        this.$bvModal.show('bv-modal-download-wallet')
      },
      createWallet: function () {
        const keystore = UndClient.crypto.generateKeyStore(this.wallet.privateKey, this.wallet.walletPass)
        this.download(JSON.stringify(keystore), keystore.id + ".json", "text/json")
        this.$bvModal.hide('bv-modal-download-wallet')
        this.clearData()
      },
      download: function (content, fileName, contentType) {
        var a = document.createElement("a");
        var file = new Blob([content], {type: contentType});
        a.href = URL.createObjectURL(file);
        a.download = fileName;
        a.click();
      },
      loadTextFromFile: function (ev) {
        this.wallet.walletFile = ev.target.files[0]
      },
      unlockWallet: function () {
        const reader = new FileReader();
        reader.onload = e => this.loadWallet(e);
        reader.readAsText(this.wallet.walletFile);
      },
      loadWallet: async function (e) {
        try {
          this.wallet.json = e.target.result
          const res = this.client.recoverAccountFromKeystore(e.target.result, this.wallet.walletPass)
          this.wallet.address = res.address
          this.wallet.privateKey = res.privateKey
          await this.client.setPrivateKey(res.privateKey, true)
          this.$bvModal.hide('bv-modal-unlock-wallet')
          this.wallet.isWalletUnlocked = true
        } catch (e) {
          this.showToast('danger', e.toString())
          this.clearData()
        }
      }
    }
  }
</script>
