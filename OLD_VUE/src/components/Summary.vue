<template>
  <b-container>
    <b-row>
      <b-col>
        <h4>Wallet Address</h4>
      </b-col>
      <b-col cols="6">
        <b>
          <span>
            <a :href="explorerUrlPrefix + '/account/' + wallet.address" target="_blank" class="text-primary">
              <span class="wallet_address">
                {{ wallet.address }}
              </span>
              <b-icon-box-arrow-up-right />
            </a>
          </span>
        </b>
      </b-col>
      <b-col cols="3">
        <span v-show="!isManualRefresh" class="h3 mb-2">
          <b-icon-arrow-clockwise @click="manualRefresh()" />
        </span>
        <span v-show="isManualRefresh">
          <b-spinner label="Spinning" />
        </span>
      </b-col>
    </b-row>

    <b-row>
      <b-col>
        <h4>
          Available Balance
          <b-icon-info-circle
            v-b-popover.hover.right="'Amount of FUND available for transfer and staking'"
            title="Available Balance"
          />
        </h4>
      </b-col>
      <b-col cols="9">
        <h4>
          <span class="text-success">{{ formatAmount(wallet.balanceNund) }}</span>
        </h4>
      </b-col>
    </b-row>

    <b-row v-show="wallet.staking.totalDelegations > 0">
      <b-col>
        <h4>
          Total Balance
          <b-icon-info-circle
            v-b-popover.hover.right="
              'Total FUND in this wallet, including any staked FUND, unbonding FUND and rewards'
            "
            title="Total Balance"
          />
        </h4>
      </b-col>
      <b-col cols="9">
        <span class="text-info">{{ formatAmount(wallet.totalBalance) }}</span>
      </b-col>
    </b-row>

    <b-row v-show="wallet.staking.totalDelegations > 0">
      <b-col>
        <h4>
          Staking
          <b-icon-info-circle
            v-b-popover.hover.right="'Your current staking, delegations and rewards'"
            title="Staking"
          />
        </h4>
      </b-col>
      <b-col cols="9">
        <b-row>
          <b-col>Delegations</b-col>
          <b-col>{{ wallet.staking.totalDelegations }}</b-col>
        </b-row>
        <b-row>
          <b-col>Delegated</b-col>
          <b-col>
            <span class="text-info">{{ formatAmount(wallet.staking.totalStaked) }}</span>
          </b-col>
        </b-row>
        <b-row v-show="wallet.staking.totalUnbonding > 0">
          <b-col>Unbonding</b-col>
          <b-col>
            <span class="text-info">{{ formatAmount(wallet.staking.totalUnbonding) }}</span>
          </b-col>
        </b-row>
        <b-row>
          <b-col>Rewards</b-col>
          <b-col>
            <span class="text-info">{{ formatAmount(wallet.staking.totalRewards) }}</span>
          </b-col>
        </b-row>
        <b-row v-show="wallet.myNode !== ''">
          <b-col>Commission</b-col>
          <b-col>
            <span class="text-info">{{ formatAmount(wallet.staking.totalCommissions) }}</span>
          </b-col>
        </b-row>
      </b-col>
    </b-row>
  </b-container>
</template>

<script>
import { mapState } from "vuex"

export default {
  name: "Summary",
  data() {
    return {
      isManualRefresh: false,
    }
  },
  computed: {
    ...mapState({
      wallet: state => state.wallet,
      chainId: state => state.client.chainId,
    }),
    explorerUrlPrefix() {
      return this.explorerUrl(this.chainId)
    },
  },
  methods: {
    async manualRefresh() {
      this.isManualRefresh = true
      await this.$parent.manualRefresh()
      this.isManualRefresh = false
    },
  },
}
</script>
