const _ = require("lodash/core")

// initial state
const state = {
  delegations: [],
  unbondingDelegations: [],
  redelegations: [],
  rewards: {},
}

// getters
const getters = {
  getReward: state => validatorAddress => {
    let reward = 0.0
    if (validatorAddress in state.rewards) {
      reward = state.rewards[validatorAddress]
    }
    return reward
  },
}

// actions
const actions = {
  clearAll(context) {
    context.commit("clearDelegations")
    context.commit("clearUnbondingDelegations")
    context.commit("clearReDelegations")
    context.commit("clearRewards")
  },

  clearDelegations(context) {
    context.commit("clearDelegations")
  },

  clearUnbondingDelegations(context) {
    context.commit("clearUnbondingDelegations")
  },

  clearReDelegations(context) {
    context.commit("clearReDelegations")
  },

  clearRewards(context) {
    context.commit("clearRewards")
  },

  addEditDelegation(context, delegation) {
    const currentDelegations = context.state.delegations.slice()
    for (let i = 0; i < currentDelegations.length; i += 1) {
      if (currentDelegations[i].validator_address === delegation.validator_address) {
        currentDelegations.splice(i, 1)
      }
    }
    currentDelegations.push(delegation)
    context.commit("addEditDelegation", currentDelegations)
  },

  addEditUnbondingDelegation(context, unbond) {
    const currentUnbondingDelegations = context.state.unbondingDelegations.slice()
    for (let i = 0; i < currentUnbondingDelegations.length; i += 1) {
      if (_.isEqual(currentUnbondingDelegations[i], unbond)) {
        currentUnbondingDelegations.splice(i, 1)
      }
    }
    currentUnbondingDelegations.push(unbond)
    context.commit("addEditUnbondingDelegation", currentUnbondingDelegations)
  },

  addEditReDelegation(context, redeleg) {
    const currentReDelegations = context.state.redelegations.slice()
    for (let i = 0; i < currentReDelegations.length; i += 1) {
      if (_.isEqual(currentReDelegations[i], redeleg)) {
        currentReDelegations.splice(i, 1)
      }
    }
    currentReDelegations.push(redeleg)
    context.commit("addEditReDelegation", currentReDelegations)
  },

  updateReward(context, reward) {
    context.commit("updateReward", reward)
  },
}

// mutations
const mutations = {
  clearDelegations(state) {
    state.delegations = []
  },

  clearUnbondingDelegations(state) {
    state.unbondingDelegations = []
  },

  clearReDelegations(state) {
    state.redelegations = []
  },

  clearRewards(state) {
    state.rewards = {}
  },

  addEditDelegation(state, delegations) {
    state.delegations = delegations
  },

  addEditUnbondingDelegation(state, unbonds) {
    state.unbondingDelegations = unbonds
  },

  addEditReDelegation(state, redelegations) {
    state.redelegations = redelegations
  },

  updateReward(state, reward) {
    let amount = 0.0
    if (reward.reward) {
      amount = parseFloat(reward.reward[0].amount)
    }
    state.rewards[reward.validator_address] = amount
  },
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
}
