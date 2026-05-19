<template>
  <div>
    <b-container class="bv-example-row">
      <b-row>
        <b-col>
          <h3>Transactions</h3>
        </b-col>
        <b-col>
          <b-button @click="loadTransactions(true)">
            Refresh
          </b-button>
        </b-col>
      </b-row>
    </b-container>

    <p>
      Your latest transactions, including any transaction which failed to broadcast during
      <em>this session</em>.
    </p>

    <div v-show="isDataLoading">
      <b-spinner style="width: 3rem; height: 3rem;" label="Large Spinner" />
    </div>

    <div v-show="!isDataLoading">
      <b-list-group id="tx-list" :per-page="perPage" :current-page="currentPage">
        <b-list-group-item v-for="tx in paginatedOrderedTxs" :key="tx.txSummary.txhash">
          <Tx :key="componentKey" :tx="tx" />
        </b-list-group-item>
        <b-list-group-item v-show="(lastSentPage > 1 || lastRecPage > 1) && isLastPage">
          <b-button @click="loadMore()">
            Load more
          </b-button>
        </b-list-group-item>
      </b-list-group>

      <b-pagination
        v-show="numTxs > perPage"
        v-model="currentPage"
        :total-rows="numTxs"
        :per-page="perPage"
        aria-controls="tx-list"
      />
    </div>
  </div>
</template>

<script>
import { mapGetters, mapState } from "vuex"
import Tx from "./Tx.vue"

const _ = require("lodash")

export default {
  name: "Transactions",
  components: {
    Tx,
  },
  data() {
    return {
      isDataLoading: false,
      componentKey: 0,
      orderedTxs: [],
      perPage: 10,
      currentPage: 1,
      txFetchLimit: 100,
      lastSentPage: 0,
      lastRecPage: 0,
    }
  },
  computed: {
    ...mapState({
      client: state => state.client.client,
      chainId: state => state.client.chainId,
      isClientConnected: state => state.client.isConnected,
      wallet: state => state.wallet,
      txs: state => state.txs,
    }),
    ...mapGetters("txs", ["getAllTxs"]),
    numTxs() {
      return this.orderedTxs.length
    },
    isLastPage() {
      const numPages = Math.ceil(this.numTxs / this.perPage)
      return numPages === this.currentPage
    },
    paginatedOrderedTxs() {
      return this.orderedTxs.slice((this.currentPage - 1) * this.perPage, this.currentPage * this.perPage)
    },
  },
  methods: {
    forceRerender() {
      this.componentKey += 1
    },
    async loadTransactions(manual = false) {
      this.isDataLoading = true
      if (
        this.isClientConnected &&
        this.wallet.isWalletUnlocked > 0 &&
        (Object.keys(this.txs.txs).length === 0 || manual)
      ) {
        await this.getSentTxs()
        await this.getRecTxs()
        await this.processPendingTxs()
        this.orderTxs()
        this.forceRerender()
      } else {
        await this.processPendingTxs()
        this.orderTxs()
        this.forceRerender()
      }
      this.isDataLoading = false
    },
    async loadMore() {
      if (this.isClientConnected && this.wallet.isWalletUnlocked > 0) {
        this.isDataLoading = true
        if (this.lastSentPage > 1) {
          this.lastSentPage -= 1
          const txsSentRes = await this.client.getTransactions(
            this.wallet.address,
            this.lastSentPage,
            this.txFetchLimit,
          )
          await this.addNewTxs(txsSentRes, true)
        }

        if (this.lastRecPage > 1) {
          this.lastRecPage -= 1
          const txsRecRes = await this.client.getTransactionsReceived(
            this.wallet.address,
            this.lastRecPage,
            this.txFetchLimit,
          )
          await this.addNewTxs(txsRecRes, false)
        }

        this.orderTxs()
        this.forceRerender()
        this.isDataLoading = false
      }
    },
    async getSentTxs() {
      const txsRes = await this.client.getTransactions(this.wallet.address, 1, this.txFetchLimit)
      // const paginatedTxsRes = []
      // const addNewTxsRes = []
      // const self = this
      if (txsRes?.tx_responses) {
        await this.addNewTxs(txsRes, true)
        // const totalPages = parseInt(txsRes.pagination.total, 10)
        // if (totalPages > 1) {
        //   const start = totalPages
        //   const end = start - 1
        //   // get the last couple of pages
        //   for (let i = start; i >= end && i > 0; i -= 1) {
        //     paginatedTxsRes.push(this.client.getTransactions(this.wallet.address, i, this.txFetchLimit))
        //     if (this.lastSentPage > i || this.lastSentPage === 0) {
        //       this.lastSentPage = i
        //     }
        //   }
        //   await Promise.all(paginatedTxsRes)
        //     .then(function(paginatedTxs) {
        //       paginatedTxs.forEach(function(txs) {
        //         addNewTxsRes.push(self.addNewTxs(txs, true))
        //       })
        //     })
        //     .catch(function(err) {
        //       console.error(err)
        //     })
        //   await Promise.all(addNewTxsRes)
        // } else {
        //   await this.addNewTxs(txsRes, true)
        // }
      } else {
        this.handleUndJsError(txsRes)
      }
    },
    async getRecTxs() {
      const txsRes = await this.client.getTransactionsReceived(this.wallet.address, 1, this.txFetchLimit)
      // const paginatedTxsRes = []
      // const addNewTxsRes = []
      // const self = this
      if (txsRes?.tx_responses) {
        await this.addNewTxs(txsRes, false)
        // const totalPages = parseInt(txsRes.result.page_total, 10)
        // if (totalPages > 1) {
        //   const start = totalPages
        //   const end = start - 1
        //   // get the last couple of pages
        //   for (let i = start; i >= end && i > 0; i -= 1) {
        //     paginatedTxsRes.push(
        //       this.client.getTransactionsReceived(this.wallet.address, i, this.txFetchLimit),
        //     )
        //     if (this.lastRecPage > i || this.lastRecPage === 0) {
        //       this.lastRecPage = i
        //     }
        //   }
        //   await Promise.all(paginatedTxsRes)
        //     .then(function(paginatedTxs) {
        //       paginatedTxs.forEach(function(txs) {
        //         addNewTxsRes.push(self.addNewTxs(txs, true))
        //       })
        //     })
        //     .catch(function(err) {
        //       console.error(err)
        //     })
        //   await Promise.all(addNewTxsRes)
        // } else {
        //   await this.addNewTxs(txsRes, false)
        // }
      } else {
        this.handleUndJsError(txsRes)
      }
    },
    async processPendingTxs() {
      const txHashes = Object.keys(this.txs.txs)
      const txData = []
      // const addTxDataRes = []
      for (let i = 0; i < txHashes.length; i += 1) {
        const txHash = txHashes[i]
        const tx = this.txs.txs[txHash]
        // no point checking if it's not included in a block yet. Wait a few seconds
        const d = new Date()
        const now = Math.floor(d.getTime() / 1000)
        const diff = now - tx.txSummary.timestamp
        if (!tx.txData && diff > 6) {
          txData.push(this.getAndAddPendingTx(txHash))
        }
      }
      await Promise.all(txData)
      // for (let j = 0; j < txData.length; j += 1) {
      //   addTxDataRes.push(this.$store.dispatch("txs/addTxData", txData[j]))
      // }
      // await Promise.all(addTxDataRes)
    },
    async addNewTxs(txRes, isSent) {
      const addTxRes = []
      await txRes
      for (let i = 0; i < txRes.tx_responses.length; i += 1) {
        // const t = txRes.tx_responses[i]
        // this.isFromMe(t)
        if (isSent) {
          // if (this.isFromMe(t)) {
          //   addTxRes.push(
          //     this.$store.dispatch("txs/addTx", {
          //       txhash: txRes.result.txs[i].txhash,
          //       timestamp: txRes.result.txs[i].timestamp,
          //       isSent,
          //       data: txRes.result.txs[i],
          //     }),
          //   )
          // }
          addTxRes.push(
            this.$store.dispatch("txs/addTx", {
              txhash: txRes.tx_responses[i].txhash,
              timestamp: txRes.tx_responses[i].timestamp,
              isSent,
              tx_response: txRes.tx_responses[i],
              tx: txRes.txs[i],
            }),
          )
        } else {
          addTxRes.push(
            this.$store.dispatch("txs/addTx", {
              txhash: txRes.tx_responses[i].txhash,
              timestamp: txRes.tx_responses[i].timestamp,
              isSent,
              tx_response: txRes.tx_responses[i],
              tx: txRes.txs[i],
            }),
          )
        }
      }
      await Promise.all(addTxRes)
    },
    async getAndAddPendingTx(txhash) {
      if (this.client !== null && this.wallet.isWalletUnlocked > 0) {
        try {
          const res = await this.client.getTx(txhash)
          if (res?.tx_response) {
            await this.$store.dispatch("txs/addTxData", {
              txhash: res.tx_response.txhash,
              timestamp: res.tx_response.timestamp,
              tx_response: res.tx_response,
              tx: res.tx,
            })
          } else {
            this.handleUndJsError(res)
          }
        } catch (e) {
          // empty
        }
      }
    },
    orderTxs() {
      const orderedTxs = []
      const txHashes = Object.keys(this.txs.txs)
      for (let i = 0; i < txHashes.length; i += 1) {
        const txHash = txHashes[i]
        const tx = this.txs.txs[txHash]
        orderedTxs.push(tx)
      }
      this.orderedTxs = _.orderBy(orderedTxs, ["txSummary.timestamp"], ["desc"])
    },
  },
}
</script>
