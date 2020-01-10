<template>
  <div class="wallet">
    <Modal
    v-show="isNewWalletModalVisible"
    @close="closeNewWalletModal"
    >
      <template v-slot:modalHeader>
        Create New Wallet
      </template>
      <template v-slot:modalBody>
        Enter new wallet password: <input type="password" v-model="wallet.walletPass" placeholder=""><br>
        Confirm new wallet password: <input type="password" v-model="wallet.walletPassCheck" placeholder="">
      </template>
      <template v-slot:modalFooter>
        <button
        type="button"
        class="btn-green"
        @click="showWallet"
        aria-label="Create"
        >
          Create
        </button>
        <button
        type="button"
        class="btn-green"
        @click="closeNewWalletModal"
        aria-label="Close modal"
        >
          Close
        </button>
      </template>
    </Modal>

    <Modal
    v-show="isMnemonicModalVisible"
    @close="closeMnemonicModal"
    >
      <template v-slot:modalHeader>
        Your Mnemonic
      </template>
      <template v-slot:modalBody>
        This is your master Mnemonic. IMPORTANT - DO NOT LOSE THIS<br>
        {{ wallet.mnemonic }}
        <br>
        <input type="checkbox" id="checkbox" v-model="isMnemonicSaved"> I have saved this Mnemonic
      </template>
      <template v-slot:modalFooter>
        <button
        type="button"
        class="btn-green"
        @click="createWallet"
        aria-label="Create"
        v-show="isMnemonicSaved"
        >
          Download Wallet
        </button>
      </template>
    </Modal>

    <Modal
    v-show="isUnlockWalletModalVisible"
    @close="closeUnlockWalletModal"
    >
      <template v-slot:modalHeader>
        Unlock Wallet
      </template>
      <template v-slot:modalBody>

        Select Wallet file: <input type="file" @change="loadTextFromFile" ref="walletFileInput"><br>
        Enter wallet password: <input type="password" v-model="wallet.walletPass" placeholder="">
      </template>
      <template v-slot:modalFooter>
        <button
        type="button"
        class="btn-green"
        @click="unlockWallet"
        aria-label="Unlock"
        >
          Unlock Wallet
        </button>
        <button
        type="button"
        class="btn-green"
        @click="closeUnlockWalletModal"
        aria-label="Close modal"
        >
          Close
        </button>
      </template>
    </Modal>

    Change Network <select @change="changeNetwork($event)">
      <option value="https://rest-testnet.unification.io">TestNet</option>
      <option value="http://localhost:1318">DevNet</option>
    </select>

    <h1>{{ chainId }}</h1>
    <button @click="newWallet()" v-show="!wallet.isWalletUnlocked">Create New Wallet</button>
    <button @click="showUnlockWalletModal()" v-show="!wallet.isWalletUnlocked">Unlock Wallet</button>

    <button @click="clearData()" v-show="wallet.isWalletUnlocked">Close Wallet</button>

    <Unlocked v-show="wallet.isWalletUnlocked" v-bind:wallet="this.wallet" v-bind:client="this.client" />
    <Help v-show="!wallet.isWalletUnlocked"/>
  </div>
</template>

<script>
  const UndClient = require('@unification-com/und-js')

  import Modal from '@/components/Modal.vue'
  import Unlocked from '@/components/Unlocked.vue'
  import Help from '@/components/Help.vue'

  export default {
    name: 'Wallet',
    components: {
      Modal,
      Unlocked,
      Help
    },
    data: function () {
      return {
        rest: 'https://rest-testnet.unification.io',
        chainId: 'not connected',
        client: null,
        isNewWalletModalVisible: false,
        isMnemonicModalVisible: false,
        isUnlockWalletModalVisible: false,
        isMnemonicSaved: false,
        wallet: this.newEmptyWallet()
      }
    },
    mounted: function () {
      this.initChain()
    },
    methods: {
      newEmptyWallet: function() {
        let newWallet = {
          isWalletUnlocked: false,
          json: '',
          mnemonic: '',
          walletPass: '',
          walletPassCheck: '',
          walletFile: '',
          privateKey: '',
          balance: '0',
          balanceNund: '0',
          locked: '0',
          lockedNund: '0',
          address: '',
        }
        return newWallet
      },
      showNewWalletModal() {
        this.isNewWalletModalVisible = true
      },
      closeNewWalletModal() {
        this.isNewWalletModalVisible = false
      },
      closeMnemonicModal() {
        this.isMnemonicModalVisible = false
      },
      showMnemonicModal() {
        this.isMnemonicModalVisible = true
      },
      closeUnlockWalletModal() {
        this.isUnlockWalletModalVisible = false
      },
      showUnlockWalletModal() {
        this.clearData()
        this.isUnlockWalletModalVisible = true
      },
      initChain: async function () {
        let client = new UndClient(this.rest)
        await client.initChain()
        if(this.wallet.privateKey.length > 0) {
          client.setPrivateKey(this.wallet.privateKey, true)
        }
        this.client = client
        this.chainId = this.client.chainId
      },
      clearData: function() {
        const walletFileInput = this.$refs.walletFileInput;
        walletFileInput.type = 'text';
        walletFileInput.type = 'file';
        this.wallet = this.newEmptyWallet()
        this.isMnemonicSaved = false
      },
      changeNetwork: function(event) {
        this.clearData()
        this.rest = event.target.value
        this.initChain()
      },
      newWallet: function () {
        this.clearData()
        this.showNewWalletModal()
      },
      showWallet: function() {

        if(this.wallet.walletPass.length < 8) {
          this.$bvToast.toast("enter a password > 8 chars", {
            title: 'Error',
            variant: 'danger',
            solid: true,
            autoHideDelay: 10000,
            appendToast: true
          })
          return false
        }
        if(this.wallet.walletPass !== this.wallet.walletPassCheck) {
          this.$bvToast.toast("passwords do not match", {
            title: 'Error',
            variant: 'danger',
            solid: true,
            autoHideDelay: 10000,
            appendToast: true
          })
          return false
        }

        this.wallet.mnemonic = UndClient.crypto.generateMnemonic()
        this.wallet.privateKey = UndClient.crypto.getPrivateKeyFromMnemonic(this.wallet.mnemonic)
        this.wallet.address = UndClient.crypto.getAddressFromPrivateKey(this.wallet.privateKey, 'und')

        this.closeNewWalletModal()
        this.showMnemonicModal()
      },
      createWallet: function() {
        const keystore = UndClient.crypto.generateKeyStore(this.wallet.privateKey, this.wallet.walletPass)
        this.download(JSON.stringify(keystore), keystore.id + ".json", "text/json")
        this.closeMnemonicModal()
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
      unlockWallet: function() {
        const reader = new FileReader();

        reader.onload = e => this.loadWallet(e);
        reader.readAsText(this.wallet.walletFile);
      },
      loadWallet: async function(e) {
        try {
          this.wallet.json = e.target.result
          const res = this.client.recoverAccountFromKeystore(e.target.result, this.wallet.walletPass)
          this.wallet.address = res.address
          this.wallet.privateKey = res.privateKey
          await this.client.setPrivateKey(res.privateKey, true)
          this.closeUnlockWalletModal()
          this.wallet.isWalletUnlocked = true
        } catch(e) {
          this.$bvToast.toast(e.toString(), {
            title: 'Error',
            variant: 'danger',
            solid: true,
            autoHideDelay: 10000,
            appendToast: true
          })
          this.clearData()
        }
      }
    }
  }
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="stylus">
  h3
    margin 40px 0 0

  ul
    list-style-type none
    padding 0

  li
    display inline-block
    margin 0 10px

  a
    color #42b983
</style>
