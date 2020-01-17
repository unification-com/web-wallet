// initial state
import {is} from "bootstrap-vue/esm/utils/object";

const state = {
  validators: {},
}

// getters
const getters = {

}

// actions
const actions = {
  clearValidators(context) {
    context.commit('clearValidators')
  },

  addAddValidator(context, validator) {
    if (!(validator.validator_address in context.state.validators)) {
      context.commit('addValidator', validator)
    }
  },
}

// mutations
const mutations = {
  clearValidators (state) {
    state.validators = {}
  },

  addValidator(state, validator) {
    state.validators[validator.validator_address] = validator
  }
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
}
