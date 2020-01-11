<template>
  <div>
    <b-container class="bv-example-row">
      <b-row>
        <b-col>
          <h3>Successful Transactions</h3>
        </b-col>
        <b-col>
          <b-button @click="loadTransactions()">Refresh</b-button>
        </b-col>
      </b-row>
    </b-container>

    <p><b>Please note</b> - the wallet only lists successful transactions. Please see Explorer for all transactions,
      including unsuccessful transactions</p>

    <div v-show="isDataLoading">
      <b-spinner style="width: 3rem; height: 3rem;" label="Large Spinner"/>
    </div>

    <div v-show="!isDataLoading">
      <b-list-group>
        <b-list-group-item v-for="tx in txs" v-bind:key="tx.txhash">
          <Tx v-bind:tx="tx"/>
        </b-list-group-item>
      </b-list-group>
    </div>
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
        isDataLoading: false
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
          this.isDataLoading = true
          let res = await this.clnt.getTransactions()
          this.txs = []
          if (res.status === 200) {
            this.txs = res.result.txs
          }
          this.isDataLoading = false
        }
      }
    }
  }
</script>
