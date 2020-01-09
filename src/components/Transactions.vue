<template>
  <div>
    <button @click="loadTransactions()">Refresh</button>
    <h3>Successful Transactions</h3>
    <p>Please note - the wallet only lists successful transactions. Please see Explorer for all transactions, including unsuccessful transactions</p>
    <ul id="transaction-list">
      <li v-for="tx in txs">
        <Tx v-bind:tx="tx"/>
      </li>
    </ul>
  </div>
</template>

<script>

  import Tx from '@/components/Tx.vue'

  export default {
    name: 'Transactions',
    components: {
      Tx
    },
    props: {
      client: Object,
      wallet: Object
    },
    data: function () {
      return {
        clnt: this.client,
        w: this.wallet,
        txs: [],
      }
    },
    watch: {
      wallet: function (newWallet) {
        this.w = newWallet
        this.loadTransactions()
      },
      client: function (newClient) {
        this.clnt = newClient
        this.loadTransactions()
      }
    },
    methods: {
      loadTransactions: async function () {
        if (this.clnt !== null && this.w.isWalletUnlocked > 0) {
          let res = await this.clnt.getTransactions()
          this.txs = []
          if (res.status === 200) {
            this.txs = res.result.txs
          }
        }
      }
    }
  }
</script>