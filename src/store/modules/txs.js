// initial state
import {is} from "bootstrap-vue/esm/utils/object";
const _ = require('lodash');

const state = {
  txs: {},
  lastPage: 0,
  totalPages: 1
}

// getters
const getters = {
  getAllTxs: (state) => {
    return state.txs
  },
}

// actions
const actions = {
  clearTxs(context) {
    context.commit('clearTxs')
  },

  addTx(context, payload) {
    let d = new Date()
    if(payload.timestamp !== null) {
      d = new Date(payload.timestamp)
    }

    let unixtime = Math.floor(d.getTime() / 1000)

    if (!(payload.txhash in context.state.txs)) {
      let txSummary = {
        txhash: payload.txhash,
        timestamp: unixtime,
        txSuccess: null,
        isSent: payload.isSent
      }
      let txObj = {
        txSummary: txSummary,
        txData: null
      }
      context.commit('addTx', txObj)
    }
  },

  addTxData(context, txData) {
    if ((txData.txhash in context.state.txs) && txData.hasOwnProperty('tx')) {
      let newTx = JSON.parse(JSON.stringify(context.state.txs[txData.txhash]))
      newTx.txData = txData
      if('codespace' in txData || 'code' in txData) {
        newTx.txSummary.txSuccess = false
      } else {
        newTx.txSummary.txSuccess = true
      }
      context.commit('addTxData', newTx)
    }
  }

}

// mutations
const mutations = {
  clearTxs (state) {
    state.txs = {}
  },

  addTx(state, tx) {
    state.txs[tx.txSummary.txhash] = tx
  },

  addTxData(state, newTx) {
    state.txs[newTx.txSummary.txhash] = newTx
  }
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
}
