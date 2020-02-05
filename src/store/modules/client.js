// initial state
import {is} from "bootstrap-vue/esm/utils/object";

const state = {
  client: null,
  chainId: 'not connected',
  isConnected: false,
  nodeData: {
    node_info: {},
    application_version: {}
  }
}

// getters
const getters = {
  getClient: state => {
    return state.client
  },
  getChainId: state => {
    return state.chainId
  },
  getIsConnected: state => {
    return state.isConnected
  }
}

// actions
const actions = {
  clearClient(context) {
    context.commit('clearClient')
    context.commit('setIsConnected', false)
  },

  setClient(context, client) {
    context.commit('setClient', client)
    if (client !== null && 'chainId' in client) {
      context.commit('setChainId', client.chainId)
      context.commit('setIsConnected', true)
    } else {
      context.commit('clearClient')
      context.commit('setIsConnected', false)
    }
  },

  setNodeInfo(context, nodeInfo) {
    let nodeData = {
      node_info: nodeInfo.node_info,
      application_version: nodeInfo.application_version
    }
    context.commit('setNodeInfo', nodeData)
  }
}

// mutations
const mutations = {
  clearClient (state) {
    state.client = null
    state.chainId = 'not connected'
    state.nodeData = {
      node_info: {},
      application_version: {}
    }
    state.isConnected = false
  },

  setClient (state, client) {
    state.client = client
  },

  setChainId (state, chainId) {
    state.chainId = chainId
  },

  setIsConnected(state, isConnected) {
    state.isConnected = isConnected
  },

  setNodeInfo(state, nodeData) {
    state.nodeData = nodeData
  }
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
}
