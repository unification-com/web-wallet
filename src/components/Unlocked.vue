<template>
  <div class="container">
    <Summary />

    <b-card no-body>
      <b-tabs v-model="tabIndex" pills card>
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
            <Staking ref="stakingcomponent" />
          </b-card-text>
        </b-tab>
        <b-tab title="Governance" @click.prevent="$refs.govcomponent.getProposals()">
          <b-card-text>
            <Governance ref="govcomponent" />
          </b-card-text>
        </b-tab>
        <b-tab title="Recovery">
          <b-card-text>
            <Recovery />
          </b-card-text>
        </b-tab>
      </b-tabs>
    </b-card>
  </div>
</template>

<script>
import Big from "big.js"
import { mapGetters, mapState } from "vuex"

import Governance from "./Governance/Governance.vue"
import Staking from "./Staking/Staking.vue"
import Summary from "./Summary.vue"
import Transactions from "./Transactions/Transactions.vue"
import Transfer from "./Transfer.vue"
import Recovery from "./Recovery.vue"

export default {
  name: "Unlocked",
  components: {
    Recovery,
    Governance,
    Staking,
    Summary,
    Transactions,
    Transfer,
  },
  data() {
    return {
      timer: null,
      activeItem: "transfer",
      isUpdating: false,
      tabIndex: 0,
    }
  },
  computed: {
    ...mapState({
      client: state => state.client.client,
      chainId: state => state.client.chainId,
      isClientConnected: state => state.client.isConnected,
      wallet: state => state.wallet,
      validators: state => state.validators,
      delegations: state => state.delegations,
    }),
    ...mapGetters({
      getReward: "delegations/getReward",
    }),
  },
  mounted() {
    this.refreshBalance()
  },
  beforeDestroy() {
    clearInterval(this.timer)
  },
  methods: {
    clearFormData() {
      this.$refs.transfercomponent.clearTransfer()
      this.$refs.stakingcomponent.clearAll()
    },
    refreshBalance() {
      clearInterval(this.timer)
      this.timer = setInterval(this.updateWallet, 60000)
    },
    async runOnUnlocked() {
      this.tabIndex = 0
      if (this.isClientConnected && this.wallet.isWalletUnlocked > 0) {
        // await this.$refs.stakingcomponent.loadDelegations()
        await this.updateWallet()
      }
    },
    async manualRefresh() {
      await this.updateWallet()
    },
    async updateWallet() {
      if (this.isClientConnected && this.wallet.isWalletUnlocked > 0 && !this.isUpdating) {
        this.isUpdating = true // prevent requests from stacking
        if (!this.wallet.accountExists) {
          const exists = await this.checkAccountExists()
          if (exists === true) {
            await this.$store.dispatch("wallet/setAccountExists", true)
          }
        }
        await this.getBalance()
        await this.getRewards()
        await this.getValidators()
        await this.getDelegations()
        await this.getUnbonding()
        await this.getTotalFund()
        this.isUpdating = false
      }
    },
    async checkAccountExists() {
      if (this.isClientConnected && this.wallet.isWalletUnlocked > 0) {
        try {
          const accountData = await this.client.getAccount()
          if (accountData === null) {
            return false
          }
          if (Object.prototype.hasOwnProperty.call(accountData?.account, "address")) {
            if (accountData.account.address === this.wallet.address) {
              return true
            }
          }
        } catch (e) {
          return false
        }
      }
      return false
    },
    async getBalance() {
      const res = await this.client.getBalance()
      let balance = "0"
      if (res.length > 0) {
        balance = res[0].amount
      }
      await this.$store.dispatch("wallet/setBalance", balance)
    },
    async getRewards() {
      if (this.isClientConnected && this.wallet.isWalletUnlocked) {
        await this.$refs.stakingcomponent.loadRewards()
      }
    },
    async getValidators() {
      if (this.isClientConnected && this.wallet.isWalletUnlocked) {
        await this.$refs.stakingcomponent.getValidators()
      }
    },
    async getDelegations() {
      if (this.isClientConnected && this.wallet.isWalletUnlocked) {
        await this.$refs.stakingcomponent.loadDelegations()
      }
    },
    async getUnbonding() {
      if (this.isClientConnected && this.wallet.isWalletUnlocked) {
        const res = await this.client.getUnbondingDelegations()
        let totalUnbonding = new Big("0")
        if (res?.unbonding_responses) {
          for (let i = 0; i < res.unbonding_responses.length; i += 1) {
            for (let j = 0; j < res.unbonding_responses[i].entries.length; j += 1) {
              totalUnbonding = totalUnbonding.add(res.unbonding_responses[i].entries[j].balance)
            }
          }
        } else {
          this.handleUndJsError(res)
        }
        await this.$store.dispatch("wallet/setTotalUnbonding", totalUnbonding)
      }
    },
    async getTotalFund() {
      let totalBalance = new Big(this.wallet.balanceNund)
      const totalStaked = new Big(this.wallet.staking.totalStaked)
      const totalUnbonding = new Big(this.wallet.staking.totalUnbonding)
      const totalRewards = new Big(this.wallet.staking.totalRewards)
      const totalCommissions = new Big(this.wallet.staking.totalCommissions)
      totalBalance = totalBalance.add(totalStaked)
      totalBalance = totalBalance.add(totalUnbonding)
      totalBalance = totalBalance.add(totalRewards)
      totalBalance = totalBalance.add(totalCommissions)
      await this.$store.dispatch("wallet/setTotalBalance", totalBalance)
    },
  },
}
</script>
