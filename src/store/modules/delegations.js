// initial state
import {is} from "bootstrap-vue/esm/utils/object";
const _ = require('lodash/core');

const state = {
  delegations: [],
  unbondingDelegations: [],
  redelegations: []
}

// getters
const getters = {

}

// actions
const actions = {
  clearAll(context) {
    context.commit('clearDelegations')
    context.commit('clearUnbondingDelegations')
    context.commit('clearReDelegations')
  },

  clearDelegations(context) {
    context.commit('clearDelegations')
  },

  clearUnbondingDelegations(context) {
    context.commit('clearUnbondingDelegations')
  },

  clearReDelegations(context) {
    context.commit('clearReDelegations')
  },

  addEditDelegation(context, delegation) {
    let currentDelegations = context.state.delegations.slice()
    for( let i = 0; i < currentDelegations.length; i++){
      if ( currentDelegations[i].validator_address === delegation.validator_address) {
        currentDelegations.splice(i, 1);
      }
    }
    currentDelegations.push(delegation)
    context.commit('addEditDelegation', currentDelegations)
  },

  addEditUnbondingDelegation(context, unbond) {
    let currentUnbondingDelegations = context.state.unbondingDelegations.slice()
    for( let i = 0; i < currentUnbondingDelegations.length; i++){
      if (_.isEqual(currentUnbondingDelegations[i], unbond)) {
        currentUnbondingDelegations.splice(i, 1);
      }
    }
    currentUnbondingDelegations.push(unbond)
    context.commit('addEditUnbondingDelegation', currentUnbondingDelegations)
  },

  addEditReDelegation(context, redeleg) {
    let currentReDelegations = context.state.redelegations.slice()
    for( let i = 0; i < currentReDelegations.length; i++){
      if (_.isEqual(currentReDelegations[i], redeleg)) {
        currentReDelegations.splice(i, 1);
      }
    }
    currentReDelegations.push(redeleg)
    context.commit('addEditReDelegation', currentReDelegations)
  },
}

// mutations
const mutations = {
  clearDelegations (state) {
    state.delegations = []
  },

  clearUnbondingDelegations (state) {
    state.unbondingDelegations = []
  },

  clearReDelegations (state) {
    state.redelegations = []
  },

  addEditDelegation(state, delegations) {
    state.delegations = delegations
  },

  addEditUnbondingDelegation(state, unbonds) {
    state.unbondingDelegations = unbonds
  },

  addEditReDelegation(state, redelegations) {
    state.redelegations = redelegations
  }
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
}
