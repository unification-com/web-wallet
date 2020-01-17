// initial state
import {is} from "bootstrap-vue/esm/utils/object";

const state = {
  txHashes: [],
  txs: {}
}

// getters
const getters = {

}

// actions
const actions = {
  clearTxs(context) {
    context.commit('clearTxs')
  },

  addTxHash(context, txHash) {
    if(!context.state.txHashes.includes(txHash)) {
      context.commit('addTxHash', txHash)
    }
  },

  addTx(context, tx) {
    if (!(tx.txhash in context.state.txs)) {
      context.commit('addTx', tx)
    }
  }

}

// mutations
const mutations = {
  clearTxs (state) {
    state.txHashes = []
    state.txs = {}
  },

  addTxHash (state, txHash) {
    state.txHashes.push(txHash)
  },

  addTx(state, tx) {
    state.txs[tx.txhash] = tx
  }
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
}
