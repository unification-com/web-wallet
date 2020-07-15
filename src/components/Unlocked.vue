<template>
  <div class="container">

    <Summary />

    <b-card no-body>
      <b-tabs pills card>
        <b-tab title="Transfer" active @click.prevent="updateWallet()">
          <b-card-text>
            <Transfer ref="transfercomponent" />
          </b-card-text>
        </b-tab>
        <b-tab title="Transactions" @click.prevent="$refs.txcomponent.loadTransactions()">
          <b-card-text>
            <Transactions ref="txcomponent" />
          </b-card-text>
        </b-tab>
        <b-tab title="Staking" @click.prevent="$refs.stakingcomponent.loadDataObj()">
          <b-card-text>
            <Staking ref="stakingcomponent"/>
          </b-card-text>
        </b-tab>
      </b-tabs>
    </b-card>
  </div>
</template>

<script>
  import Big from 'big.js'
  import {mapGetters, mapState} from 'vuex'

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
        wallet: state => state.wallet,
        validators: state => state.validators,
        delegations: state => state.delegations
      }),
      ...mapGetters({
        getReward: 'delegations/getReward'
      }),
    },
    data: function () {
      return {
        timer: null,
        activeItem: 'transfer',
        isUpdating: false,
      }
    },
    mounted() {
      this.refreshBalance()
    },
    beforeDestroy () {
      clearInterval(this.timer)
    },
    methods: {
      clearFormData: function() {
        this.$refs.transfercomponent.clearTransfer()
        this.$refs.stakingcomponent.clearAll()
      },
      refreshBalance: function() {
        clearInterval(this.timer)
        this.timer = setInterval(this.updateWallet, 60000)
      },
      runOnUnlocked: async function() {
        if (this.isClientConnected && this.wallet.isWalletUnlocked > 0) {
          await this.$refs.stakingcomponent.loadDelegations()
          await this.updateWallet()
        }
      },
      manualRefresh: async function() {
        await this.updateWallet()
      },
      updateWallet: async function () {
        if (this.isClientConnected && this.wallet.isWalletUnlocked > 0 && !this.isUpdating) {
          this.isUpdating = true // prevent requests from stacking
          if(!this.wallet.accountExists) {
            const exists = await this.checkAccountExists()
            if(exists === true) {
              await this.$store.dispatch('wallet/setAccountExists', true)
            }
          }
          await this.getBalance()
          await this.getRewards()
          await this.getUnbonding()
          this.getTotalFund()
          this.isUpdating = false
        }
      },
      checkAccountExists: async function() {
        if (this.isClientConnected && this.wallet.isWalletUnlocked > 0) {
          try {
            const accountData = await this.client.getAccount()
            if(accountData === null) {
              return false
            }
            if(accountData.result.result.hasOwnProperty('value')) {
              if(accountData.result.result.value.address === this.wallet.address) {
                return true
              }
            } else if(accountData.result.result.hasOwnProperty('account')) {
              if(accountData.result.result.account.value.address === this.wallet.address) {
                return true
              }
            }
          } catch(e) {
            console.warn(e)
            return false
          }
        }
        return false
      },
      getBalance: async function () {
        const res = await this.client.getBalance()
        let balance = '0'
        if (res.length > 0) {
          balance = res[0].amount
        }
        await this.$store.dispatch('wallet/setBalance', balance)
      },
      getRewards: async function() {
        if (this.isClientConnected && this.wallet.isWalletUnlocked) {
          await this.$refs.stakingcomponent.loadRewards()
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
          } else {
            this.handleUndJsError(res)
          }
          await this.$store.dispatch('wallet/setTotalUnbonding', totalUnbonding)
        }
      },
      getTotalFund: async function() {
        let totalBalance = new Big(this.wallet.balanceNund)
        let totalStaked = new Big(this.wallet.staking.totalStaked)
        let totalUnbonding = new Big(this.wallet.staking.totalUnbonding)
        let totalRewards = new Big(this.wallet.staking.totalRewards)
        totalBalance = totalBalance.add(totalStaked)
        totalBalance = totalBalance.add(totalUnbonding)
        totalBalance = totalBalance.add(totalRewards)
        await this.$store.dispatch('wallet/setTotalBalance', totalBalance)
      }
    }
  };
</script>
