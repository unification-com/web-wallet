<template>
  <div>
    <b-container class="bv-example-row">
      <b-row>
        <b-col>
          <h3>Transactions</h3>
        </b-col>
        <b-col>
          <b-button @click="loadTransactions()">Refresh</b-button>
        </b-col>
      </b-row>
    </b-container>

    <p>
      Your latest transactions, including any transaction which failed to broadcast during <em>this session</em>.
    </p>

    <div v-show="isDataLoading">
      <b-spinner style="width: 3rem; height: 3rem;" label="Large Spinner"/>
    </div>

    <div v-show="!isDataLoading">
      <b-list-group
      id="tx-list"
      :per-page="perPage"
      :current-page="currentPage"
      >
        <b-list-group-item v-for="tx in paginatedOrderedTxs" v-bind:key="tx.txSummary.txhash">
          <Tx v-bind:tx="tx" :key="componentKey"/>
        </b-list-group-item>
        <b-list-group-item v-show="(lastSentPage > 1 || lastRecPage > 1) && isLastPage">
          <b-button @click="loadMore()">Load more</b-button>
        </b-list-group-item>
      </b-list-group>

      <b-pagination
      v-model="currentPage"
      :total-rows="numTxs"
      :per-page="perPage"
      aria-controls="tx-list"
      v-show="numTxs > perPage"
      />
    </div>
  </div>
</template>

<script>

  import Tx from '@/components/Tx.vue'
  import {mapGetters, mapState} from 'vuex'
  const _ = require('lodash');

  export default {
    name: 'Transactions',
    components: {
      Tx
    },
    computed: {
      ...mapState({
        client: state => state.client.client,
        chainId: state => state.client.chainId,
        isClientConnected: state => state.client.isConnected,
        wallet: state => state.wallet,
        txs: state => state.txs
      }),
      ...mapGetters('txs', [
        'getAllTxs',
      ]),
      numTxs() {
        return this.orderedTxs.length
      },
      isLastPage() {
        let numPages = Math.ceil(this.numTxs / this.perPage)
        return numPages === this.currentPage
      },
      paginatedOrderedTxs() {
        return this.orderedTxs.slice(
        (this.currentPage - 1) * this.perPage,
        this.currentPage * this.perPage
        )
      }
    },
    data: function () {
      return {
        isDataLoading: false,
        componentKey: 0,
        orderedTxs: [],
        perPage: 10,
        currentPage: 1,
        txFetchLimit: 10,
        lastSentPage: 0,
        lastRecPage: 0,
      }
    },
    methods: {
      forceRerender() {
        this.componentKey += 1;
      },
      loadTransactions: async function () {
        if (this.isClientConnected && this.wallet.isWalletUnlocked > 0) {
          this.isDataLoading = true
          await this.getSentTxs()
          await this.getRecTxs()
          await this.processPendingTxs()
          this.orderTxs()
          this.forceRerender()
          this.isDataLoading = false
        }
      },
      loadMore: async function() {
        if (this.isClientConnected && this.wallet.isWalletUnlocked > 0) {
          this.isDataLoading = true
          if(this.lastSentPage > 1) {
            this.lastSentPage--
            let txsSentRes = await this.client.getTransactions(this.wallet.address, this.lastSentPage, this.txFetchLimit)
            await this.addNewTxs(txsSentRes, true)
          }

          if(this.lastRecPage > 1) {
            this.lastRecPage--
            let txsRecRes = await this.client.getTransactionsReceived(this.wallet.address, this.lastRecPage, this.txFetchLimit)
            await this.addNewTxs(txsRecRes, false)
          }

          this.orderTxs()
          this.forceRerender()
          this.isDataLoading = false
        }
      },
      getSentTxs: async function() {
        let txsRes = await this.client.getTransactions(this.wallet.address, 1, this.txFetchLimit)
        if (txsRes.status === 200) {
          if(txsRes.result.page_total > 1) {
            let start = txsRes.result.page_total
            let end = start - 1
            // get the last couple of pages
            for(let i = start; i >= end && i > 0; i--) {
              let paginatedTxsRes = await this.client.getTransactions(this.wallet.address, i, this.txFetchLimit)
              await this.addNewTxs(paginatedTxsRes, true)
              if(this.lastSentPage > i || this.lastSentPage === 0) {
                this.lastSentPage = i
              }
            }
          } else {
            await this.addNewTxs(txsRes, true)
          }
        }
      },
      getRecTxs: async function() {
        let txsRes = await this.client.getTransactionsReceived(this.wallet.address, 1, this.txFetchLimit)
        if (txsRes.status === 200) {
          if(txsRes.result.page_total > 1) {
            let start = txsRes.result.page_total
            let end = start - 1
            // get the last couple of pages
            for(let i = start; i >= end && i > 0; i--) {
              let paginatedTxsRes = await this.client.getTransactionsReceived(this.wallet.address, i, this.txFetchLimit)
              await this.addNewTxs(paginatedTxsRes, false)
              if(this.lastRecPage > i || this.lastRecPage === 0) {
                this.lastRecPage = i
              }
            }
          } else {
            await this.addNewTxs(txsRes, false)
          }
        }
      },
      processPendingTxs: async function() {
        const entries = Object.entries(this.txs.txs)
        for (const [txHash, tx] of entries) {
          if(tx.txData === null) {
            let txData = await this.getTx(txHash)
            if(Object.keys(txData).length > 0) {
              await this.$store.dispatch('txs/addTxData', txData)
            }
          }
        }
      },
      addNewTxs: async function(txRes, isSent) {
        for (let i = 0; i < txRes.result.txs.length; i++) {
          await this.$store.dispatch('txs/addTx', {
            txhash: txRes.result.txs[i].txhash,
            timestamp: txRes.result.txs[i].timestamp,
            isSent: isSent,
            data: txRes.result.txs[i],
          })
        }
      },
      getTx: async function (txhash) {
        if (this.clnt !== null && this.wallet.isWalletUnlocked > 0) {
          try {
            let res = await this.client.getTx(txhash)

            if (res.status === 200) {
              return res.result
            } else {
              return {}
            }
          } catch(e) {
            return {}
          }
        }
      },
      orderTxs: function() {
        let orderedTxs = []
        const txEntries = Object.entries(this.txs.txs)
        for (const [txHash, tx] of txEntries) {
          orderedTxs.push(tx)
        }
        this.orderedTxs = _.orderBy(orderedTxs, ['txSummary.timestamp'], ['desc']);
      }
    }
  }
</script>
