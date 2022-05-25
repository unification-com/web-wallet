// initial state
const state = {
  txs: {},
  lastPage: 0,
  totalPages: 1,
}

// getters
const getters = {
  getAllTxs: state => {
    return state.txs
  },
}

// actions
const actions = {
  clearTxs(context) {
    context.commit("clearTxs")
  },

  addTx(context, payload) {
    let d = new Date()
    if (payload.timestamp !== null) {
      d = new Date(payload.timestamp)
    }

    const unixtime = Math.floor(d.getTime() / 1000)

    if (!(payload.txhash in context.state.txs)) {
      const txSummary = {
        txhash: payload.txhash,
        timestamp: unixtime,
        txSuccess: null,
        isSent: payload.isSent,
      }

      let txData = null
      if (payload.tx_response !== null && payload.tx_response !== undefined) {
        txData = payload.tx_response
        if (parseInt(txData?.code, 10) > 0) {
          txSummary.txSuccess = false
        } else {
          txSummary.txSuccess = true
        }
      }

      const txObj = {
        txSummary,
        txData: payload.tx,
        txResponse: payload.tx_response,
      }
      context.commit("addTx", txObj)
    }
  },

  addTxData(context, payload) {
    if (payload.txhash in context.state.txs && Object.prototype.hasOwnProperty.call(payload, "tx")) {
      const newTx = JSON.parse(JSON.stringify(context.state.txs[payload.txhash]))
      newTx.txData = payload.tx
      newTx.txResponse = payload.tx_response
      if (parseInt(payload.tx_response?.code, 10) > 0) {
        newTx.txSummary.txSuccess = false
      } else {
        newTx.txSummary.txSuccess = true
      }
      context.commit("addTxData", newTx)
    }
  },
}

// mutations
const mutations = {
  clearTxs(state) {
    state.txs = {}
  },

  addTx(state, tx) {
    state.txs[tx.txSummary.txhash] = tx
  },

  addTxData(state, newTx) {
    state.txs[newTx.txSummary.txhash] = newTx
  },
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
}
