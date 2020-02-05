<template>
  <div>
    <b-card no-body>
      <b-tabs pills card>
        <b-tab title="Delegations" active @click.prevent="$refs.stakingdelegationsconponent.getDelegations(), clearAll()">
          <b-card-text>
            <StakingDelegations ref="stakingdelegationsconponent" />
          </b-card-text>
        </b-tab>

        <b-tab title="Unbonding Delegations" @click.prevent="$refs.stakingunbondingcomponent.getUnbondingDelegations()">
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
            <StakingDelegate ref="stakingdelegatecomponent" @click.prevent="getValidators(), $refs.stakingdelegatecomponent.clearDelegateData()" />
          </b-card-text>
        </b-tab>
      </b-tabs>
    </b-card>
  </div>
</template>

<script>
  import { mapState } from 'vuex'

  import StakingDelegate from '@/components/StakingDelegate.vue'
  import StakingDelegations from '@/components/StakingDelegations.vue'
  import StakingReDelegations from '@/components/StakingReDelegations.vue'
  import StakingUnbondingDelegations from "@/components/StakingUnbondingDelegations.vue";

  export default {
    name: "Staking",
    components: {
      StakingDelegate,
      StakingDelegations,
      StakingReDelegations,
      StakingUnbondingDelegations,
    },
    computed: {
      ...mapState({
        client: state => state.client.client,
        chainId: state => state.client.chainId,
        isClientConnected: state => state.client.isConnected,
        wallet: state => state.wallet,
      }),
    },
    data: function () {
      return {
        activeItem: 'delegations',
      }
    },
    methods: {
      // Todo - display and modify withdraw address
      clearAll: function() {
        this.$refs.stakingdelegatecomponent.clearDelegateData()
        this.$refs.stakingdelegationsconponent.clearUnDelegateData()
        this.$refs.stakingdelegationsconponent.clearReDelegateData()
        this.$refs.stakingdelegationsconponent.clearWithdrawData()
      },
      loadDelegations: function() {
        this.$refs.stakingdelegationsconponent.getDelegations()
      },
      getValidators: async function () {
        if (this.isClientConnected && this.wallet.isWalletUnlocked) {
          let res = await this.client.getValidators()
          if (res.status === 200) {
            for (let i = 0; i < res.result.result.length; i++) {
              await this.$store.dispatch('validators/addValidator', res.result.result[i])
            }
          } else {
            this.handleUndJsError(res)
          }
          await this.$store.dispatch('validators/updateValidatorsSelect')
        }
      },
    }
  }
</script>
