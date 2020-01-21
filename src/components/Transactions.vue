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
      Your transactions, including any transaction which failed to broadcast during <em>this session</em>
    </p>

    <div v-show="isDataLoading">
      <b-spinner style="width: 3rem; height: 3rem;" label="Large Spinner"/>
    </div>

    <div v-show="!isDataLoading">
      <b-list-group>
        <b-list-group-item v-for="tx in txs.txs" v-bind:key="tx.txhash">
          <Tx v-bind:tx="tx" :key="componentKey"/>
          <div v-show="!tx.txSuccess">
            <b-badge variant="danger">FAILED</b-badge> <span class="text-danger">{{ tx.parsedErrorMsg }}</span>
          </div>
        </b-list-group-item>
      </b-list-group>
    </div>
  </div>
</template>

<script>

  import Tx from '@/components/Tx.vue'
  import { mapState } from 'vuex'

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
    },
    data: function () {
      return {
        isDataLoading: false,
        componentKey: 0
      }
    },
    methods: {
      parseTxErrorMsg: function(msg) {
        let msgObj = JSON.parse(msg)
        return msgObj.message
      },
      forceRerender() {
        this.componentKey += 1;
      },
      loadTransactions: async function () {
        if (this.isClientConnected && this.wallet.isWalletUnlocked > 0) {
          this.isDataLoading = true
          let res = await this.client.getTransactions()
          if (res.status === 200) {
            for(let i = 0; i < res.result.txs.length; i++) {
              await this.$store.dispatch('txs/addTxHash', res.result.txs[i].txhash)
            }
          }

          for(let i = 0; i < this.txs.txHashes.length; i++) {
            let txHash = this.txs.txHashes[i]
            let txData = await this.getTx(txHash)
            if('raw_log' in txData) {
              txData.parsedErrorMsg = ''
              if('logs' in txData) {
                txData.txSuccess = txData.logs[0].success
                if(!txData.logs[0].success) {
                  txData.parsedErrorMsg = this.parseTxErrorMsg(txData.logs[0].log)
                }
              } else if('code' in txData) {
                txData.parsedErrorMsg = this.parseTxErrorMsg(txData.raw_log)
                txData.txSuccess = false
              }


              await this.$store.dispatch('txs/addTx', txData)
            }
          }
          this.forceRerender()
          this.isDataLoading = false
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
      }
    }
  }
</script>
