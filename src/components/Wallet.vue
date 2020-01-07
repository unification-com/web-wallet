<template>
  <div class="wallet">

    <Modal
    v-show="isNewWalletModalVisible"
    @close="closeNewWalletModal"
    >
      <template v-slot:headerHeader>
        Create New Wallet
      </template>
      <template v-slot:modalBody>
        Enter new wallet password: <input v-model="walletPass" placeholder=""><br>
        Confirm new wallet password: <input v-model="walletPassCheck" placeholder="">
        <p v-show="hasError">{{ errorMsg }}</p>
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
      <template v-slot:headerHeader>
        Your Mnemonic
      </template>
      <template v-slot:modalBody>
        This is your master Mnemonic. IMPORTANT - DO NOT LOSE THIS<br>
        {{ mnemonic }}
      </template>
      <template v-slot:modalFooter>
        <button
        type="button"
        class="btn-green"
        @click="createWallet"
        aria-label="Create"
        >
          Download Wallet
        </button>
      </template>
    </Modal>

    <Modal
    v-show="isUnlockWalletModalVisible"
    @close="closeUnlockWalletModal"
    >
      <template v-slot:headerHeader>
        Unlock Wallet
      </template>
      <template v-slot:modalBody>
        Enter wallet password: <input v-model="walletPass" placeholder=""><br>
        <input type="file" @change="loadTextFromFile">
        <p v-show="hasError">{{ errorMsg }}</p>
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
      <option value="http://localhost:1318">DevNet</option>
      <option value="http://3.136.239.157:1317">TestNet</option>
    </select>

    <h1>{{ chainId }}</h1>
    <button @click="newWallet()">Create New Wallet</button>
    <button @click="showUnlockWalletModal()">Unlock Wallet</button>

    <button @click="getBalance()" v-show="isWalletUnlocked">get balance</button>
    <button @click="clearData()" v-show="isWalletUnlocked">unload</button>
    <br/>
    <div v-show="isWalletUnlocked">Address: {{ address }}</div>
    <br/>
    <div v-show="isWalletUnlocked">Balance: {{ balance }}</div>
  </div>
</template>

<script>
  const UndClient = require('@unification-com/und-js')

  import Modal from '@/components/Modal.vue'

  export default {
    name: 'Wallet',
    components: {
      Modal
    },
    props: {
      msg: String
    },
    data: function () {
      return {
        rest: 'http://localhost:1318',
        chainId: 'not connected',
        client: null,
        balance: '0',
        address: '',
        isNewWalletModalVisible: false,
        isMnemonicModalVisible: false,
        isUnlockWalletModalVisible: false,
        hasError: false,
        errorMsg: '',
        isWalletUnlocked: false,
        mnemonic: '',
        walletPass: '',
        walletPassCheck: '',
        walletFile: '',
        privateKey: '',
      }
    },
    mounted: function () {
      this.initChain()
    },
    methods: {
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
        this.isUnlockWalletModalVisible = true
      },
      initChain: async function () {
        this.client = new UndClient(this.rest)
        await this.client.initChain()
        this.chainId = this.client.chainId
      },
      clearData: function() {
        this.walletPass = ''
        this.walletPassCheck = ''
        this.mnemonic = ''
        this.privateKey = ''
        this.address = ''
        this.errorMsg = ''
        this.balance = '0'
        this.hasError = false
        this.isWalletUnlocked = false
      },
      changeNetwork: function(event) {
        this.rest = event.target.value
        this.initChain()
      },
      newWallet: function () {
        this.clearData()
        this.showNewWalletModal()
      },
      showWallet: function() {

        if(this.walletPass.length < 8) {
          this.errorMsg = "enter a password > 8 chars"
          this.hasError = true
          return false
        }
        if(this.walletPass !== this.walletPassCheck) {
          this.errorMsg = "passwords do not match"
          this.hasError = true
          return false
        }

        this.mnemonic = UndClient.crypto.generateMnemonic()
        this.privateKey = UndClient.crypto.getPrivateKeyFromMnemonic(this.mnemonic)
        this.address = UndClient.crypto.getAddressFromPrivateKey(this.privateKey, 'und')

        this.closeNewWalletModal()
        this.showMnemonicModal()
      },
      createWallet: function() {
        const keystore = UndClient.crypto.generateKeyStore(this.privateKey, this.walletPass)
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
        this.walletFile = ev.target.files[0]
      },
      unlockWallet: function() {
        this.errorMsg = ''
        this.hasError = false
        const reader = new FileReader();

        reader.onload = e => this.loadWallet(e);
        reader.readAsText(this.walletFile);
      },
      loadWallet: async function(e) {
        try {
          const res = this.client.recoverAccountFromKeystore(e.target.result, this.walletPass)
          this.address = res.address
          await this.client.setPrivateKey(res.privateKey, true)
          this.isWalletUnlocked = true
          this.closeUnlockWalletModal()
          this.getBalance()
        } catch(e) {
          this.errorMsg = e.toString()
          this.hasError = true
        }
      },
      getBalance: async function() {
        const res = await this.client.getBalance()
        if(res.length > 0) {
          this.balance = res[0].amount + res[0].denom
        } else {
          this.balance = '0nund'
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
