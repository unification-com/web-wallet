<template>
  <div>
    <!-- confirm proposal vote modal -->
    <b-modal id="bv-modal-confirm-proposal-vote">
      <template v-slot:modal-title>
        <h3>Confirm Proposal Vote</h3>
      </template>
      <div>
        Chain ID: {{ chainId }}<br />
        Proposal: {{ voteData.proposalName }} (#{{ voteData.proposalId }})<br />
        Voting: {{ voteData.optionName }}<br />
        Fee: {{ fee.amount }}nund ({{ nundToUnd(fee.amount) }} FUND)<br />
        Gas: {{ fee.gas }}<br />

        <b-form @submit.prevent="preventSubmit">
          <b-form-group
            v-show="isShowFee"
            id="vote-fee-amount-label"
            label="Fee:"
            label-for="vote-fee-amount"
            description="Fees in nund"
          >
            <b-input-group append="nund">
              <b-form-input
                id="vote-fee-amount"
                v-model="fee.amount"
                type="text"
                trim
                aria-describedby="input-live-feedback-vote-fees"
                :state="feeState"
                @keydown.enter.prevent="preventSubmit"
              />
              <b-form-invalid-feedback id="input-live-feedback-vote-fees">
                Invalid fees
              </b-form-invalid-feedback>
            </b-input-group>
          </b-form-group>
          <b-form-group
            v-show="isShowFee"
            id="vote-fee-gas-label"
            label="Gas:"
            label-for="vote-fee-gas"
            description="Gas"
          >
            <b-form-input
              id="vote-fee-gas"
              v-model="fee.gas"
              type="text"
              trim
              aria-describedby="input-live-feedback-vote-gas"
              :state="gasState"
              @keydown.enter.prevent="preventSubmit"
            />
            <b-form-invalid-feedback id="input-live-feedback-vote-gas">
              Invalid gas
            </b-form-invalid-feedback>
          </b-form-group>

          <b-form-checkbox id="vote-show-fee" v-model="isShowFee" name="vote-show-fee">
            Manually set Fees
          </b-form-checkbox>
        </b-form>
      </div>
      <LedgerConfirm v-show="confirmOnLedger" />
      <template v-slot:modal-footer>
        <b-button
          v-show="!confirmOnLedger"
          variant="success"
          aria-label="Create"
          :disabled="!voteFormState"
          @click="confirmProposalVote"
        >
          Confirm
        </b-button>
        <b-button
          v-show="!confirmOnLedger"
          aria-label="Cancel"
          @click="$bvModal.hide('bv-modal-confirm-proposal-vote')"
        >
          Cancel
        </b-button>
      </template>
    </b-modal>

    <b-container class="bv-example-row">
      <b-row>
        <b-col cols="6">
          <h3>Governance Proposals</h3>
        </b-col>
        <b-col>
          <b-button @click="getProposals()">
            Refresh
          </b-button>
        </b-col>
      </b-row>
    </b-container>

    <div v-show="isDataLoading">
      <b-spinner style="width: 3rem; height: 3rem;" label="Large Spinner" />
    </div>

    <div v-show="!isDataLoading">
      <b-table
        :items="JSON.parse(JSON.stringify(proposalsDisplayObj))"
        :fields="proposalFields"
        striped
        responsive="sm"
      >
        <template v-slot:cell(show_details)="row">
          <b-button size="sm" class="mr-2" @click="row.toggleDetails">
            {{ row.detailsShowing ? "Hide" : "Show" }} Details
          </b-button>
        </template>
        <template v-slot:row-details="row">
          <p>
            Title:
            <a :href="explorerUrlPrefix + '/proposals/' + row.item.id" target="_blank">
              {{ row.item.name }} <b-icon-box-arrow-up-right /> </a
            ><br />
            Submit time: {{ row.item.submit_time }}<br />
            Deposit End time: {{ row.item.deposit_end_time }}<br />
            Total Deposit: {{ nundToUnd(row.item.total_deposit) }} FUND<br />
            Vote Start time: {{ row.item.voting_start_time }}<br />
            Vote End time: {{ row.item.voting_end_time }}
          </p>
          <div>
            <p>Results</p>
            Total Votes: {{ row.item.totalVotes.toString() }} ({{
              bigPercentage(row.item.totalVotes, validators.totalVotingPower).toFixed(2)
            }}% of Total Voting Power {{ validators.totalVotingPower.toString() }})<br />
            Yes: {{ row.item.tally.yes.toString() }} ({{
              bigPercentage(row.item.tally.yes, row.item.totalVotes).toFixed(2)
            }}%)<br />
            No: {{ row.item.tally.no.toString() }} ({{
              bigPercentage(row.item.tally.no, row.item.totalVotes).toFixed(2)
            }}%)<br />
            Abstain: {{ row.item.tally.abstain.toString() }} ({{
              bigPercentage(row.item.tally.abstain, row.item.totalVotes).toFixed(2)
            }}%)<br />
            No With Veto: {{ row.item.tally.no_with_veto.toString() }} ({{
              bigPercentage(row.item.tally.no_with_veto, row.item.totalVotes).toFixed(2)
            }}%)
          </div>

          <div v-show="row.item.canVote">
            <h4>Vote</h4>
            <b-button
              variant="info"
              size="sm"
              class="mr-2"
              @click="initVote(row.item.id, row.item.name, 'VOTE_OPTION_YES')"
            >
              Yes
            </b-button>

            <b-button
              variant="info"
              size="sm"
              class="mr-2"
              @click="initVote(row.item.id, row.item.name, 'VOTE_OPTION_NO')"
            >
              No
            </b-button>

            <b-button
              variant="info"
              size="sm"
              class="mr-2"
              @click="initVote(row.item.id, row.item.name, 'VOTE_OPTION_ABSTAIN')"
            >
              Abstain
            </b-button>
          </div>
        </template>
        <template v-slot:cell(id)="data">
          <b class="text-info">{{ Number(data.value) }}</b>
        </template>
        <template v-slot:cell(name)="data">
          <b class="text-info">{{ data.value }}</b>
        </template>
        <template v-slot:cell(status)="data">
          <ProposalStatus :status="data.value" />
        </template>
      </b-table>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapState } from "vuex"
import Big from "big.js"
import LedgerConfirm from "../LedgerConfirm.vue"
import ProposalStatus from "./ProposalStatus.vue"
import { UND_CONFIG } from "../../constants"

export default {
  name: "Governance",
  components: {
    LedgerConfirm,
    ProposalStatus,
  },
  data() {
    return {
      isDataLoading: false,
      proposalFields: [{ key: "id" }, { key: "name" }, { key: "status" }, { key: "show_details" }],
      proposalsDisplayObj: [],
      voteData: {
        proposalId: "",
        proposalName: "",
        option: "",
        optionName: "",
        memo: UND_CONFIG.DEFAULT_MEMO,
      },
      fee: { ...UND_CONFIG.DEFAULT_PROPOSAL_VOTE_FEE },
      isShowFee: false,
      confirmOnLedger: false,
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
    ...mapGetters("governance", ["getProposalById"]),
    voteFormState() {
      return this.gasState && this.feeState
    },
    gasState() {
      return this.isValidGas(this.fee.gas)
    },
    feeState() {
      return this.isValidFee(this.fee)
    },
    explorerUrlPrefix() {
      return this.explorerUrl(this.chainId)
    },
  },
  methods: {
    preventSubmit() {
      return false
    },
    async getProposals() {
      this.isDataLoading = true
      const res = await this.client.getGovernanceProposals()
      const proposalJobs = []
      if (res?.proposals) {
        for (let i = 0; i < res.proposals.length; i += 1) {
          proposalJobs.push(this.$store.dispatch("governance/addEditProposal", res.proposals[i]))
        }
      }
      await Promise.all(proposalJobs)

      const keys = Object.keys(this.governance.proposals)
      const getVotesJobs = []
      const getTallyJobs = []
      for (let i = 0; i < keys.length; i += 1) {
        const p = this.governance.proposals[keys[i]]
        if (p.proposal.status === "PROPOSAL_STATUS_VOTING_PERIOD") {
          getVotesJobs.push(this.getProposalVotes(p.proposal.proposal_id))
          getTallyJobs.push(this.getProposalTally(p.proposal.proposal_id))
        }
      }

      await Promise.all(getVotesJobs)
      await Promise.all(getTallyJobs)

      this.isDataLoading = false
      this.generateProposalsDisplay()
    },
    async getProposalVotes(proposalId) {
      const res = await this.client.getGovernanceProposalVotes(proposalId)
      if (res?.votes) {
        let myVote = "NOT_VOTED"
        for (let i = 0; i < res.votes.length; i += 1) {
          if (res.votes[i].voter === this.wallet.address) {
            myVote = res.votes[i].option
          }
        }
        await this.$store.dispatch("governance/setMyVote", { proposal_id: proposalId, myVote })
        await this.$store.dispatch("governance/updateVotes", { proposal_id: proposalId, votes: res.votes })
      }
    },
    async getProposalTally(proposalId) {
      const res = await this.client.getGovernanceProposalTally(proposalId)
      if (res?.tally) {
        await this.$store.dispatch("governance/updateTally", { proposal_id: proposalId, tally: res.tally })
      }
    },
    generateProposalsDisplay() {
      this.proposalsDisplayObj = []
      const keys = Object.keys(this.governance.proposals)
      for (let i = 0; i < keys.length; i += 1) {
        const p = this.governance.proposals[keys[i]]
        let totalDeposit = "0"
        if (p.proposal.total_deposit.length > 0) {
          totalDeposit = p.proposal.total_deposit[0].amount
        }
        let t = p.proposal.final_tally_result
        if (p.proposal.status === "PROPOSAL_STATUS_VOTING_PERIOD") {
          t = p.tally
        }

        const totalVotes = new Big(t.yes)
          .add(new Big(t.no))
          .add(new Big(t.abstain))
          .add(new Big(t.no_with_veto))

        const proposalObj = {
          id: p.proposal.proposal_id,
          name: p.proposal.content.title,
          status: p.proposal.status,
          submit_time: this.formatDateTime(p.proposal.submit_time),
          deposit_end_time: this.formatDateTime(p.proposal.deposit_end_time),
          total_deposit: totalDeposit,
          voting_start_time: this.formatDateTime(p.proposal.voting_start_time),
          voting_end_time: this.formatDateTime(p.proposal.voting_end_time),
          myVote: p.myVote,
          canVote: p.myVote === "NOT_VOTED" && p.proposal.status === "PROPOSAL_STATUS_VOTING_PERIOD",
          tally: t,
          totalVotes,
        }
        this.proposalsDisplayObj.push(proposalObj)
      }
    },
    checkFeesAndGas() {
      if (!this.isValidFee(this.fee)) {
        this.showToast("error", "Error", "invalid fees")
        return false
      }
      if (!this.isValidGas(this.fee.gas)) {
        this.showToast("error", "Error", "invalid gas amount")
        return false
      }
      return true
    },
    clearVoteData() {
      this.voteData = null
      this.fee = null
      this.voteData = {
        proposalId: "",
        proposalName: "",
        option: "",
        optionName: "",
        memo: UND_CONFIG.DEFAULT_MEMO,
      }
      this.fee = { ...UND_CONFIG.DEFAULT_PROPOSAL_VOTE_FEE }
      this.isShowFee = false
    },
    initVote(proposalId, name, option) {
      this.voteData.proposalId = proposalId
      this.voteData.option = option

      switch (option) {
        case "VOTE_OPTION_YES":
          this.voteData.optionName = "Yes"
          break
        case "VOTE_OPTION_NO":
          this.voteData.optionName = "No"
          break
        case "VOTE_OPTION_ABSTAIN":
          this.voteData.optionName = "Abstain"
          break
        default:
          this.showToast("error", "Error", `invalid option "${option}"`)
          return false
      }

      this.voteData.proposalName = name
      this.$bvModal.show("bv-modal-confirm-proposal-vote")
      return true
    },
    confirmProposalVote() {
      this.confirmProposalVoteAsync()
    },
    async confirmProposalVoteAsync() {
      if (this.isClientConnected && this.wallet.isWalletUnlocked) {
        if (this.client.isLedgerMode) {
          this.confirmOnLedger = true
        }

        try {
          const res = await this.client.voteOnProposal(
            this.voteData.proposalId,
            this.voteData.option,
            this.fee,
            this.wallet.address,
          )

          if (res?.tx_response) {
            this.showToast(
              "success",
              "Voted Successfully",
              `Transaction hash: <a href="${this.explorerUrl(this.chainId)}/transactions/${
                res.tx_response.txhash
              }" target="_blank">${res.tx_response.txhash}</a>`,
            )
            await this.$store.dispatch("txs/addTx", {
              txhash: res.tx_response.txhash,
              timestamp: null,
              isSent: true,
            })
            await this.$store.dispatch("governance/setMyVote", {
              proposal_id: this.voteData.proposalId,
              myVote: this.voteData.option,
            })
          }
        } catch (err) {
          this.showToast("error", "Error", err.toString())
        }
      } else {
        this.clientError()
      }
      this.clearVoteData()
      this.confirmOnLedger = false
      this.$bvModal.hide("bv-modal-confirm-proposal-vote")
      this.getProposals()
    },
  },
}
</script>
