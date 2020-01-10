<template>
  <div>
    <button @click="loadTransactions()">Refresh</button>
    <h3>Successful Transactions</h3>
    <p><b>Please note</b> - the wallet only lists successful transactions. Please see Explorer for all transactions, including unsuccessful transactions</p>

    <b-list-group>
      <b-list-group-item v-for="tx in txs" v-bind:key="tx.txhash">
        <Tx v-bind:tx="tx"/>
      </b-list-group-item>
    </b-list-group>
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