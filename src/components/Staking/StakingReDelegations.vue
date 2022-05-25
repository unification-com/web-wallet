<template>
  <div>
    <b-container class="bv-example-row">
      <b-row>
        <b-col>
          <h3>Redelegations</h3>
        </b-col>
        <b-col>
          <b-button @click="getRedelegations()">
            Refresh
          </b-button>
        </b-col>
      </b-row>
    </b-container>

    <div v-show="isDataLoading">
      <b-spinner style="width: 3rem; height: 3rem;" label="Large Spinner" />
    </div>

    <div v-show="!isDataLoading">
      <b-table :items="delegations.redelegations" :fields="redelegationFields" striped responsive="sm">
        <template v-slot:cell(completion_time)="data">
          <b class="text-info">{{ formatDateTime(data.value) }}</b>
        </template>
        <template v-slot:cell(balance)="data">
          <b class="text-info">{{ formatAmount(data.value) }}</b>
        </template>
        <template v-slot:cell(initial_balance)="data">
          <b class="text-info">{{ formatAmount(data.value) }}</b>
        </template>
        <template v-slot:cell(shares)="data">
          <b class="text-info">{{ Number(data.value) }}</b>
        </template>
      </b-table>
    </div>
  </div>
</template>

<script>
import { mapState, mapGetters } from "vuex"

export default {
  name: "StakingReDelegations",
  data() {
    return {
      redelegationFields: [
        "from",
        "to",
        "creation_height",
        "completion_time",
        "initial_balance",
        "balance",
        "shares",
      ],
      isDataLoading: false,
    }
  },
  computed: {
    ...mapState({
      client: state => state.client.client,
      chainId: state => state.client.chainId,
      isClientConnected: state => state.client.isConnected,
      wallet: state => state.wallet,
      txs: state => state.txs,
      validators: state => state.validators,
      delegations: state => state.delegations,
    }),
    ...mapGetters("validators", ["getValidatorMoniker"]),
  },
  methods: {
    async getRedelegations() {
      if (this.isClientConnected && this.wallet.isWalletUnlocked) {
        const addEditReDelegationRes = []
        this.isDataLoading = true
        await this.$store.dispatch("delegations/clearReDelegations")
        const res = await this.client.getRedelegations(this.wallet.address)
        if (res?.redelegation_responses) {
          for (let i = 0; i < res.redelegation_responses.length; i += 1) {
            const redelegRes = res.redelegation_responses[i]
            // eslint-disable-next-line camelcase
            const { validator_src_address } = redelegRes.redelegation
            // eslint-disable-next-line camelcase
            const { validator_dst_address } = redelegRes.redelegation

            const monikerSrc = this.getValidatorMoniker(validator_src_address)
            const monikerDst = this.getValidatorMoniker(validator_dst_address)

            for (let j = 0; j < redelegRes.entries.length; j += 1) {
              const entry = redelegRes.entries[j]
              const redeleg = {
                from: monikerSrc,
                to: monikerDst,
                validator_src_address,
                creation_height: entry.redelegation_entry.creation_height,
                completion_time: entry.redelegation_entry.completion_time,
                initial_balance: entry.redelegation_entry.initial_balance,
                balance: entry.balance,
                shares: entry.redelegation_entry.shares_dst,
              }
              addEditReDelegationRes.push(this.$store.dispatch("delegations/addEditReDelegation", redeleg))
            }
          }
          await Promise.all(addEditReDelegationRes)
        } else {
          this.handleUndJsError(res)
        }
        this.isDataLoading = false
      }
    },
  },
}
</script>
