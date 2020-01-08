<template>
  <div class="container">

    <Modal
    v-show="isConfirmTransferUnd"
    @close="closeConfirmTransferUnd"
    >
      <template v-slot:modalHeader>
        Confirm Transfer
      </template>
      <template v-slot:modalBody>
        <p>Please confirm:</p>
        Sending {{transfer.und}} UND<br>
        To {{transfer.to}}
      </template>
      <template v-slot:modalFooter>
        <button
        type="button"
        class="btn-green"
        @click="transferUnd"
        aria-label="Create"
        >
          Confirm
        </button>
        <button
        type="button"
        class="btn-green"
        @click="closeConfirmTransferUnd"
        aria-label="Close modal"
        >
          Close
        </button>
      </template>
    </Modal>

    <div>Address: {{ wallet.address }}</div>
    <br/>
    <div>Balance: {{ wallet.balance }} UND</div>
    <ul class="nav nav-tabs nav-justified">
      <li class="nav-item">
        <a class="nav-link" @click.prevent="setActive('transactions'), updateWallet()"
           :class="{ active: isActive('transactions') }" href="#transactions">Transactions</a>
      </li>
      <li class="nav-item">
        <a class="nav-link" @click.prevent="setActive('transfer'), updateWallet()" :class="{ active: isActive('transfer') }"
           href="#transfer">Transfer</a>
      </li>
      <li class="nav-item">
        <a class="nav-link" @click.prevent="setActive('stake'), updateWallet()" :class="{ active: isActive('stake') }"
           href="#stake">Stake</a>
      </li>
    </ul>
    <div class="tab-content py-3" id="myTabContent">
      <div class="tab-pane fade" :class="{ 'active show': isActive('transactions') }" id="transactions">
        <Transactions v-bind:txs="transactions" />
      </div>
      <div class="tab-pane fade" :class="{ 'active show': isActive('transfer') }" id="transfer">

        Send: <input type="text" v-model="transfer.und" placeholder=""> UND<br>
        To: <input type="text" v-model="transfer.to" placeholder=""><br>
        Memo: <input type="text" v-model="transfer.memo" placeholder=""><br>
        <button @click="showConfirmTransferUnd()">Transfer</button>
      </div>
      <div class="tab-pane fade" :class="{ 'active show': isActive('stake') }" id="stake">Staking stuff</div>
    </div>
  </div>
</template>

<script>
  import Big from 'big.js'
  const UndClient = require('@unification-com/und-js')

  import Modal from '@/components/Modal.vue'
  import Transactions from '@/components/Transactions.vue'

  const BASENUMBER = Math.pow(10, 9)

  export default {
    name: 'Unlocked',
    components: {
      Transactions,
      Modal
    },
    props: {
      wallet: Object,
      client: Object
    },
    data: function () {
      return {
        timer: null,
        activeItem: 'transactions',
        chainId: '',
        w: this.wallet,
        clnt: this.client,
        transactions: [],
        transfer: {
          to: '',
          und: '0',
          memo: 'sent from Unification Web Wallet'
        },
        isConfirmTransferUnd: false,
      }
    },
    watch: {
      wallet: function (newWallet) {
        this.wallet = newWallet
        this.refreshWallet()
        if(newWallet.isWalletUnlocked) {
          this.updateWallet()
        }
      },
      client: function (newClient) {
        this.clnt = newClient
        this.refreshWallet()
        if (newClient !== null) {
          this.chainId = newClient.chainId
          this.updateWallet()
        }
      }
    },
    beforeDestroy () {
      clearInterval(this.timer)
    },
    methods: {
      clearTransfer: function() {
        this.transfer = {
          to: '',
          und: '0',
          memo: 'sent from Unification Web Wallet'
        }
      },
      showConfirmTransferUnd: function() {

        if(!UndClient.crypto.checkAddress(this.transfer.to, 'und')) {
          this.$bvToast.toast('"' + this.transfer.to + '" is not a valid address', {
            title: 'Error',
            variant: 'danger',
            solid: true,
            autoHideDelay: 10000,
            appendToast: true
          })
          return false
        }
        if(this.transfer.und <= 0 || isNaN(this.transfer.und)) {
          this.$bvToast.toast('Amount must be greater than zero', {
            title: 'Error',
            variant: 'danger',
            solid: true,
            autoHideDelay: 10000,
            appendToast: true
          })
          return false
        }
        this.isConfirmTransferUnd = true
      },
      closeConfirmTransferUnd: function() {
        this.isConfirmTransferUnd = false
      },
      refreshWallet: function() {
        clearInterval(this.timer)
        this.timer = setInterval(this.updateWallet, 5000)
      },
      isActive: function (menuItem) {
        return this.activeItem === menuItem
      },
      setActive: function (menuItem) {
        this.activeItem = menuItem
      },
      updateWallet: function () {
        if (this.clnt !== null && this.wallet.isWalletUnlocked > 0) {
          this.loadTransactions()
          this.getBalance()
        }
      },
      loadTransactions: async function () {
        let res = await this.client.getTransactions()
        if (res.status === 200) {
          this.transactions = res.result.txs
        }
      },
      getBalance: async function () {
        const res = await this.clnt.getBalance()
        if (res.length > 0) {
          let amount = new Big(res[0].amount)
          this.wallet.balance = Number(amount.div(BASENUMBER))
          this.wallet.balanceNund = res[0].amount
        } else {
          this.wallet.balance = '0'
          this.wallet.balanceNund = '0'
        }
      },
      transferUnd: async function() {

        let fee = {
          "amount": [
            {
              "denom": "nund",
              "amount": "2500"
            }
          ],
          "gas": "90000"
        }

        try {
          let res = await this.clnt.transferUnd(
          this.transfer.to,
          this.transfer.und,
          fee,
          "und",
          this.wallet.address,
          this.transfer.memo
          )

          console.log(res)

          if(res.status === 200) {
            this.$bvToast.toast('Tx hash: ' + res.result.txhash, {
              title: 'Tx successfully broadcast',
              variant: 'success',
              solid: true,
              autoHideDelay: 10000,
              appendToast: true
            })
          }

          this.closeConfirmTransferUnd()
          this.clearTransfer()
        } catch (err) {
          this.$bvToast.toast(err.toString(), {
            title: 'Error',
            variant: 'danger',
            solid: true,
            autoHideDelay: 10000,
            appendToast: true
          })
        }
        this.updateWallet()
      }
    }
  };
</script>