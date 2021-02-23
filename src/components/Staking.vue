<template>
  <div>
    <b-card no-body>
      <b-tabs pills card>
        <b-tab
          title="Delegations"
          active
          @click.prevent="$refs.stakingdelegationsconponent.generateDisplayObj(), clearAll()"
        >
          <b-card-text>
            <StakingDelegations ref="stakingdelegationsconponent" />
          </b-card-text>
        </b-tab>

        <b-tab
          title="Unbonding Delegations"
          @click.prevent="$refs.stakingunbondingcomponent.getUnbondingDelegations()"
        >
          <b-card-text>
            <StakingUnbondingDelegations ref="stakingunbondingcomponent" />
          </b-card-text>
        </b-tab>

        <b-tab title="Redelegations" @click.prevent="$refs.stakingredelegationscomponent.getRedelegations()">
          <b-card-text>
            <StakingReDelegations ref="stakingredelegationscomponent" />
          </b-card-text>
        </b-tab>

        <b-tab title="Delegate">
          <b-card-text>
            <StakingDelegate
              ref="stakingdelegatecomponent"
              @click.prevent="getValidators(), $refs.stakingdelegatecomponent.clearDelegateData()"
            />
          </b-card-text>
        </b-tab>
      </b-tabs>
    </b-card>
  </div>
</template>

<script>
import { mapState } from "vuex"

import StakingDelegate from "./StakingDelegate.vue"
import StakingDelegations from "./StakingDelegations.vue"
import StakingReDelegations from "./StakingReDelegations.vue"
import StakingUnbondingDelegations from "./StakingUnbondingDelegations.vue"

export default {
  name: "Staking",
  components: {
    StakingDelegate,
    StakingDelegations,
    StakingReDelegations,
    StakingUnbondingDelegations,
  },
  data() {
    return {
      activeItem: "delegations",
    }
  },
  computed: {
    ...mapState({
      client: state => state.client.client,
      chainId: state => state.client.chainId,
      isClientConnected: state => state.client.isConnected,
      wallet: state => state.wallet,
      validators: state => state.validators,
    }),
  },
  methods: {
    // Todo - display and modify withdraw address
    clearAll() {
      this.$refs.stakingdelegatecomponent.clearDelegateData()
      this.$refs.stakingdelegationsconponent.clearUnDelegateData()
      this.$refs.stakingdelegationsconponent.clearReDelegateData()
      this.$refs.stakingdelegationsconponent.clearWithdrawData()
    },
    async loadDelegations() {
      await this.$refs.stakingdelegationsconponent.getDelegations()
    },
    async loadRewards() {
      await this.$refs.stakingdelegationsconponent.getDelegatorRewards()
    },
    async loadDataObj() {
      this.$refs.stakingdelegationsconponent.generateDisplayObj()
    },
    async getValidatorsByStatus(status) {
      if (this.isClientConnected && this.wallet.isWalletUnlocked) {
        const res = await this.client.getValidators(status)
        const addValidatorRes = []
        if (res.status === 200) {
          for (let i = 0; i < res.result.result.length; i += 1) {
            addValidatorRes.push(this.$store.dispatch("validators/addValidator", res.result.result[i]))
          }
          await Promise.all(addValidatorRes)
        } else {
          this.handleUndJsError(res)
        }
        await this.$store.dispatch("validators/updateValidatorsSelect")
      }
    },
    async getValidators() {
      if (this.isClientConnected && this.wallet.isWalletUnlocked) {
        await this.getValidatorsByStatus("bonded")
        await this.getValidatorsByStatus("unbonded")
        await this.getValidatorsByStatus("unbonding")
      }
    },
  },
}
</script>
