<template>
  <div>
    <table>
      <tbody>
        <tr>
          <td class="gov-proposal-th">
            ID
          </td>
          <td>{{ proposalData.id }}</td>
        </tr>
        <tr>
          <td class="gov-proposal-th">
            Title
          </td>
          <td>
            <a :href="explorerUrlPrefix + '/proposals/' + proposalData.id" target="_blank">
              {{ proposalData.name }}
              <b-icon-box-arrow-up-right />
            </a>
          </td>
        </tr>
        <tr>
          <td class="gov-proposal-th">
            Type
          </td>
          <td>{{ getProposalType }}</td>
        </tr>
        <tr>
          <td class="gov-proposal-th">
            Content
          </td>
          <td><ProposalContent :content="proposalData.content" /></td>
        </tr>
        <tr>
          <td class="gov-proposal-th">
            Submit Time
          </td>
          <td>{{ proposalData.submit_time }}</td>
        </tr>
        <tr>
          <td class="gov-proposal-th">
            Deposit
          </td>
          <td>{{ nundToUnd(proposalData.total_deposit) }} FUND</td>
        </tr>
        <tr>
          <td class="gov-proposal-th">
            Deposit Time
          </td>
          <td>{{ proposalData.deposit_end_time }}</td>
        </tr>
        <tr v-show="proposalData.voting_start_time !== '31 Dec 0 23:58:45 UTC'">
          <td class="gov-proposal-th">
            Vote Start Time
          </td>
          <td>{{ proposalData.voting_start_time }}</td>
        </tr>
        <tr v-show="proposalData.voting_end_time !== '31 Dec 0 23:58:45 UTC'">
          <td class="gov-proposal-th">
            Vote End Time
          </td>
          <td>
            {{ proposalData.voting_end_time }}
            <VueCountdown :time="getVoteTimeLeft" v-show="getVoteTimeLeft > 0" :transform="transform">
              <template slot-scope="props">
                (<span v-show="props.days !== '00'">{{ props.days }}d, </span>{{ props.hours }}:{{
                  props.minutes
                }}:{{ props.seconds }})
              </template>
            </VueCountdown>
          </td>
        </tr>
      </tbody>
    </table>
    <div>
      <p>Results</p>
      Total Votes: {{ proposalData.totalVotes.toString() }} ({{
        bigPercentage(proposalData.totalVotes, validators.totalVotingPower).toFixed(2)
      }}% of Total Voting Power {{ validators.totalVotingPower.toString() }})<br />
      Yes: {{ proposalData.tally.yes.toString() }} ({{
        bigPercentage(proposalData.tally.yes, proposalData.totalVotes).toFixed(2)
      }}%)<br />
      No: {{ proposalData.tally.no.toString() }} ({{
        bigPercentage(proposalData.tally.no, proposalData.totalVotes).toFixed(2)
      }}%)<br />
      Abstain: {{ proposalData.tally.abstain.toString() }} ({{
        bigPercentage(proposalData.tally.abstain, proposalData.totalVotes).toFixed(2)
      }}%)<br />
      No With Veto: {{ proposalData.tally.no_with_veto.toString() }} ({{
        bigPercentage(proposalData.tally.no_with_veto, proposalData.totalVotes).toFixed(2)
      }}%)
    </div>
  </div>
</template>

<script>
import { mapState } from "vuex"
import VueCountdown from "@chenfengyuan/vue-countdown"
import ProposalContent from "./ProposalContent.vue"

export default {
  name: "ProposalDetails",
  components: {
    ProposalContent,
    VueCountdown,
  },
  props: {
    proposal: Object,
  },
  data() {
    return {
      proposalData: this.proposal,
    }
  },
  computed: {
    ...mapState({
      client: state => state.client.client,
      chainId: state => state.client.chainId,
      isClientConnected: state => state.client.isConnected,
      wallet: state => state.wallet,
      governance: state => state.governance,
      validators: state => state.validators,
    }),
    explorerUrlPrefix() {
      return this.explorerUrl(this.chainId)
    },
    getVoteTimeLeft() {
      let diff = 0
      const now = new Date()
      const voteEnd = new Date(this.proposal.voting_end_time)
      if (voteEnd > now) {
        diff = voteEnd - now
      }
      return diff
    },
    getProposalType() {
      switch (this.proposal.content["@type"]) {
        case "/cosmos.gov.v1beta1.TextProposal":
          return "Text"
        case "/cosmos.distribution.v1beta1.CommunityPoolSpendProposal":
          return "Community Pool Spend"
        case "/cosmos.params.v1beta1.ParameterChangeProposal":
          return "Parameter Change"
        case "/cosmos.upgrade.v1beta1.SoftwareUpgradeProposal":
          return "Software Upgrade"
        case "/cosmos.upgrade.v1beta1.CancelSoftwareUpgradeProposal":
          return "Cancel Software Upgrade"
        default:
          return this.proposal.content["@type"]
      }
    },
  },
  watch: {
    proposal(val) {
      this.proposalData = val
    },
  },
  methods: {
    transform(props) {
      const p = props
      Object.entries(props).forEach(([key, value]) => {
        // Adds leading zero
        const digits = value < 10 ? `0${value}` : value

        p[key] = `${digits}`
      })

      return p
    },
  },
}
</script>
