<template>
  <div>
    <b-container class="bv-example-row">
      <b-row>
        <b-col>
          <h3>Current Unbonding Delegations</h3>
        </b-col>
        <b-col>
          <b-button @click="getUnbondingDelegations()">
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
        :items="delegations.unbondingDelegations"
        :fields="unbondingDelegationsFields"
        striped
        responsive="sm"
      >
        <template v-slot:cell(completion_time)="data">
          <b class="text-info">{{ formatDateTime(data.value) }}</b>
        </template>
        <template v-slot:cell(balance)="data">
          <b class="text-info">{{ formatAmount(data.value) }}</b>
        </template>
        <template v-slot:cell(initial_balance)="data">
          <b class="text-info">{{ formatAmount(data.value) }}</b>
        </template>
      </b-table>
    </div>
  </div>
</template>

<script>
import { mapState, mapGetters } from "vuex"

export default {
  name: "StakingUnbondingDelegations",
  data() {
    return {
      unbondingDelegationsFields: [
        "name",
        "creation_height",
        "completion_time",
        "initial_balance",
        "balance",
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
    async getUnbondingDelegations() {
      if (this.isClientConnected && this.wallet.isWalletUnlocked) {
        this.isDataLoading = true
        const addEditUnbondingDelegationRes = []
        await this.$store.dispatch("delegations/clearUnbondingDelegations")
        const res = await this.client.getUnbondingDelegations()
        if (res?.unbonding_responses) {
          for (let i = 0; i < res.unbonding_responses.length; i += 1) {
            // eslint-disable-next-line camelcase
            const { validator_address } = res.unbonding_responses[i]
            const moniker = this.getValidatorMoniker(validator_address)
            for (let j = 0; j < res.unbonding_responses[i].entries.length; j += 1) {
              const unbond = {
                name: moniker,
                validator_address,
                creation_height: res.unbonding_responses[i].entries[j].creation_height,
                completion_time: res.unbonding_responses[i].entries[j].completion_time,
                initial_balance: res.unbonding_responses[i].entries[j].initial_balance,
                balance: res.unbonding_responses[i].entries[j].balance,
              }
              addEditUnbondingDelegationRes.push(
                this.$store.dispatch("delegations/addEditUnbondingDelegation", unbond),
              )
            }
          }
          await Promise.all(addEditUnbondingDelegationRes)
        } else {
          this.handleUndJsError(res)
        }
        this.isDataLoading = false
      }
    },
  },
}
</script>
