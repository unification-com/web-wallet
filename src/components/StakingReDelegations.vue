<template>
  <div>
    <b-container class="bv-example-row">
      <b-row>
        <b-col>
          <h3>Redelegations</h3>
        </b-col>
        <b-col>
          <b-button @click="getRedelegations()">Refresh</b-button>
        </b-col>
      </b-row>
    </b-container>

    <div v-show="isDataLoading">
      <b-spinner style="width: 3rem; height: 3rem;" label="Large Spinner"/>
    </div>

    <div v-show="!isDataLoading">
      <b-table :items="delegations.redelegations" :fields="redelegationFields" striped responsive="sm">

        <template v-slot:cell(completion_time)="data">
          <b class="text-info">{{ formatDateTime(data.value)}}</b>
        </template>
        <template v-slot:cell(balance)="data">
          <b class="text-info">{{ formatAmount(data.value)}}</b>
        </template>
        <template v-slot:cell(initial_balance)="data">
          <b class="text-info">{{ formatAmount(data.value)}}</b>
        </template>
        <template v-slot:cell(shares)="data">
          <b class="text-info">{{ Number(data.value) }}</b>
        </template>

      </b-table>
    </div>
  </div>
</template>

<script>
  import { mapState, mapGetters } from 'vuex'

  const UndClient = require('@unification-com/und-js')

  export default {
    name: "StakingReDelegations",
    computed: {
      ...mapState({
        client: state => state.client.client,
        chainId: state => state.client.chainId,
        isClientConnected: state => state.client.isConnected,
        wallet: state => state.wallet,
        txs: state => state.txs,
        validators: state => state.validators,
        delegations: state => state.delegations
      }),
      ...mapGetters('validators', [
        'getValidatorMoniker',
      ]),
    },
    data: function () {
      return {
        redelegationFields: ['from', 'to', 'creation_height', 'completion_time', 'initial_balance', 'balance', 'shares'],
        isDataLoading: false,
      }
    },
    methods: {
      getRedelegations: async function() {
        if (this.isClientConnected && this.wallet.isWalletUnlocked) {
          this.isDataLoading = true
          await this.$store.dispatch('delegations/clearReDelegations')
          let res = await this.client.getRedelegations(this.wallet.address)
          if (res.status === 200) {
            for (let i = 0; i < res.result.result.length; i++) {
              let redelegRes = res.result.result[i]
              let validator_src_address = redelegRes.validator_src_address
              let validator_dst_address = redelegRes.validator_dst_address

              let monikerSrc = this.getValidatorMoniker(validator_src_address)
              let monikerDst = this.getValidatorMoniker(validator_dst_address)

              for(let j = 0; j < redelegRes.entries.length; j++) {
                let entry = redelegRes.entries[j]
                let redeleg = {
                  from: monikerSrc,
                  to: monikerDst,
                  validator_src_address: validator_src_address,
                  creation_height: entry.creation_height,
                  completion_time: entry.completion_time,
                  initial_balance: entry.initial_balance,
                  balance: entry.balance,
                  shares: entry.shares_dst,
                }
                await this.$store.dispatch('delegations/addEditReDelegation', redeleg)
              }
            }
          } else {
            this.handleUndJsError(res)
          }
          this.isDataLoading = false
        }
      },
    }
  }
</script>
