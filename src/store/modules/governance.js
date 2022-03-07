// initial state
const state = {
  proposals: {},
}

// getters
const getters = {
  getProposalById: state => proposalId => {
    for (let i = 0; i < state.proposals.length; i += 1) {
      if (state.proposals[i].proposal_id === proposalId) {
        return state.proposals[i]
      }
    }
    return null
  },
}

// actions
const actions = {
  addEditProposal(context, proposal) {
    if (Object.prototype.hasOwnProperty.call(context.state.proposals, proposal.proposal_id)) {
      context.commit("editProposal", proposal)
    } else {
      context.commit("addProposal", proposal)
    }
  },
  updateVotes(context, payload) {
    if (Object.prototype.hasOwnProperty.call(context.state.proposals, payload.proposal_id)) {
      context.commit("updateVotes", payload)
    }
  },
  updateTally(context, payload) {
    if (Object.prototype.hasOwnProperty.call(context.state.proposals, payload.proposal_id)) {
      context.commit("updateTally", payload)
    }
  },
  setMyVote(context, payload) {
    if (Object.prototype.hasOwnProperty.call(context.state.proposals, payload.proposal_id)) {
      context.commit("setMyVote", payload)
    }
  },
}

// mutations
const mutations = {
  addProposal(state, proposal) {
    state.proposals[proposal.proposal_id] = {
      proposal,
      myVote: null,
    }
  },
  editProposal(state, proposal) {
    state.proposals[proposal.proposal_id].proposal = proposal
  },
  updateVotes(state, payload) {
    state.proposals[payload.proposal_id].votes = payload.votes
  },
  updateTally(state, payload) {
    state.proposals[payload.proposal_id].tally = payload.tally
  },
  setMyVote(state, payload) {
    state.proposals[payload.proposal_id].myVote = payload.myVote
  },
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
}
