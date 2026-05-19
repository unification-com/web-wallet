// initial state
const state = {
  client: null,
  chainId: null,
  nodeInfo: {},
  nodeAppVersion: {},
  isConnected: false,
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
  },
}

// actions
const actions = {
  clearClient(context) {
    context.commit("clearClient")
  },

  setIsConnected(context) {
    context.commit("setIsConnected", true)
  },

  setIsNotConnected(context) {
    context.commit("setIsConnected", false)
  },

  setChainId(context, chainId) {
    context.commit("setChainId", chainId)
  },

  setNodeInfo(context, nodeInfo) {
    context.commit("setNodeInfo", nodeInfo)
  },

  setNodeAppVersion(context, nodeAppVersion) {
    context.commit("setNodeAppVersion", nodeAppVersion)
  },

  setClient(context, client) {
    context.commit("setClient", client)
    if (client !== null && "chainId" in client && "node_info" in client && "node_app_version" in client) {
      context.commit("setChainId", client.chainId)
      context.commit("setNodeInfo", client.node_info)
      context.commit("setNodeAppVersion", client.node_app_version)
      context.commit("setIsConnected", true)
    } else {
      context.commit("clearClient")
      context.commit("setIsConnected", false)
    }
  },
}

// mutations
const mutations = {
  clearClient(state) {
    state.client = null
    state.chainId = null
    state.nodeInfo = {}
    state.nodeAppVersion = {}
    state.isConnected = false
  },

  setClient(state, client) {
    state.client = client
  },

  setChainId(state, chainId) {
    state.chainId = chainId
  },

  setNodeInfo(state, nodeInfo) {
    state.nodeInfo = nodeInfo
  },

  setNodeAppVersion(state, nodeAppVersion) {
    state.nodeAppVersion = nodeAppVersion
  },

  setIsConnected(state, isConnected) {
    state.isConnected = isConnected
  },
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
}
