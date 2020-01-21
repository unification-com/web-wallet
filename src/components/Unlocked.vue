<template>
  <div class="container">

    <Summary v-bind:wallet="wallet"/>

    <b-card no-body>
      <b-tabs pills card>
        <b-tab title="Transfer" active @click.prevent="updateWallet()">
          <b-card-text>
            <Transfer />
          </b-card-text>
        </b-tab>
        <b-tab title="Transactions" @click.prevent="updateWallet(), $refs.txcomponent.loadTransactions()">
          <b-card-text>
            <Transactions ref="txcomponent" />
          </b-card-text>
        </b-tab>
        <b-tab title="Staking" @click.prevent="updateWallet(), $refs.stakingcomponent.getDelegations()">
          <b-card-text>
            <Staking ref="stakingcomponent"/>
          </b-card-text>
        </b-tab>
        <b-tab title="Enterprise" @click.prevent="updateWallet()">
          <b-card-text>
            <Enterprise />
          </b-card-text>
        </b-tab>
      </b-tabs>
    </b-card>
  </div>
</template>

<script>
  import Big from 'big.js'
  import { mapState } from 'vuex'

  import Enterprise from '@/components/Enterprise.vue'
  import Staking from '@/components/Staking.vue'
  import Summary from '@/components/Summary.vue'
  import Transactions from '@/components/Transactions.vue'
  import Transfer from '@/components/Transfer.vue'

  export default {
    name: 'Unlocked',
    components: {
      Enterprise,
      Staking,
      Summary,
      Transactions,
      Transfer,
    },
    computed: {
      ...mapState({
        client: state => state.client.client,
        chainId: state => state.client.chainId,
        isClientConnected: state => state.client.isConnected,
        wallet: state => state.wallet
      }),
    },
    data: function () {
      return {
        timer: null,
        activeItem: 'transfer',
      }
    },
    mounted() {
      this.refreshBalance()
    },
    beforeDestroy () {
      clearInterval(this.timer)
    },
    methods: {
      refreshBalance: function() {
        clearInterval(this.timer)
        this.timer = setInterval(this.updateWallet, 10000)
      },
      runOnUnlocked: async function() {
        if (this.isClientConnected && this.wallet.isWalletUnlocked > 0) {
          await this.updateWallet()
          await this.$refs.txcomponent.loadTransactions()
          await this.$refs.stakingcomponent.getValidators()
        }
      },
      updateWallet: async function () {
        if (this.isClientConnected && this.wallet.isWalletUnlocked > 0) {
          await this.getBalance()
          await this.getEnterpriseLocked()
          await this.getRewards()
          await this.getUnbonding()
          this.getTotalUnd()
        }
      },
      getBalance: async function () {
        const res = await this.client.getBalance()
        let balance = '0'
        if (res.length > 0) {
          balance = res[0].amount
        }
        await this.$store.dispatch('wallet/setBalance', balance)
      },
      getEnterpriseLocked: async function() {
        let locked = '0'
        try {
          const res = await this.client.getEnterpriseLocked()
          if ('amount' in res) {
            locked = res.amount
          }
        } catch(e) {

        }
        await this.$store.dispatch('wallet/setEnterpriseLocked', locked)
      },
      getRewards: async function() {
        if (this.isClientConnected && this.wallet.isWalletUnlocked) {
          const delRes = await this.client.getDelegations()

          let totalDelegations = 0
          let totalShares = new Big('0')
          let totalStaked = new Big('0')
          let totalRewards = new Big('0')

          if (delRes.status === 200) {
            for (let i = 0; i < delRes.result.result.length; i++) {
              totalDelegations++
              let validatorAddress = delRes.result.result[i].validator_address
              totalShares = totalShares.add(delRes.result.result[i].shares)
              totalStaked = totalStaked.add(delRes.result.result[i].balance.amount)
              let res = await this.client.getDelegatorRewards(this.wallet.address, validatorAddress)
              if (res.status === 200 && res.result.result.length > 0) {
                totalRewards = totalRewards.add(res.result.result[0].amount)
              }
            }
          }

          await this.$store.dispatch('wallet/setTotalDelegations', totalDelegations)
          await this.$store.dispatch('wallet/setTotalShares', totalShares)
          await this.$store.dispatch('wallet/setTotalStaked', totalStaked)
          await this.$store.dispatch('wallet/setTotalRewards', totalRewards)
        }
      },
      getUnbonding: async function() {
        if (this.isClientConnected && this.wallet.isWalletUnlocked) {
          let res = await this.client.getUnbondingDelegations()
          let totalUnbonding = new Big('0')
          if (res.status === 200) {
            for (let i = 0; i < res.result.result.length; i++) {
              for(let j = 0; j < res.result.result[i].entries.length; j++) {
                totalUnbonding = totalUnbonding.add(res.result.result[i].entries[j].balance)
              }
            }
          }
          await this.$store.dispatch('wallet/setTotalUnbonding', totalUnbonding)
        }
      },
      getTotalUnd: async function() {
        let totalBalance = new Big(this.wallet.balanceNund)
        let totalStaked = new Big(this.wallet.staking.totalStaked)
        let totalUnbonding = new Big(this.wallet.staking.totalUnbonding)
        let totalLocked = new Big(this.wallet.lockedNund)
        totalBalance = totalBalance.add(totalStaked)
        totalBalance = totalBalance.add(totalUnbonding)
        totalBalance = totalBalance.add(totalLocked)
        await this.$store.dispatch('wallet/setTotalBalance', totalBalance)
      }
    }
  };
</script>
