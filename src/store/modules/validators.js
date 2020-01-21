// initial state
import {is} from "bootstrap-vue/esm/utils/object";
const _ = require('lodash/core');

const state = {
  validators: {},
  validatorsSelect: [],
}

// getters
const getters = {

  getValidatorDescription: (state) => (operator_address) => {
    let description = {
      moniker: operator_address,
      identity: '',
      website: '',
      security_contact: '',
      details: '',
    }
    if(operator_address in state.validators) {
      description = state.validators[operator_address].description
    }
    return description
  },

  getValidatorMoniker: (state, getters) => (operator_address) => {
    return getters.getValidatorDescription(operator_address)['moniker']
  }
}

// actions
const actions = {
  clearValidators(context) {
    context.commit('clearValidators')
  },

  addValidator(context, validator) {
    if (!(validator.operator_address in context.state.validators)) {
      context.commit('addValidator', validator)
    }
  },

  updateValidatorsSelect(context) {
    let validatorSelectArray = []

    for (let key in context.state.validators) {
      // skip loop if the property is from prototype
      if (!context.state.validators.hasOwnProperty(key)) continue;
      let valOption = {
        value: key,
        text: context.state.validators[key].description.moniker
      }
      validatorSelectArray.push(valOption)
    }
    if(!_.isEqual(validatorSelectArray, context.state.validatorsSelect.slice())) {
      context.commit('updateValidatorsSelect', validatorSelectArray)
    }
  }
}

// mutations
const mutations = {
  clearValidators (state) {
    state.validators = {}
  },

  addValidator(state, validator) {
    state.validators[validator.operator_address] = validator
  },

  updateValidatorsSelect(state, validatorsSelectArray) {
    state.validatorsSelect = validatorsSelectArray
  }
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
}
