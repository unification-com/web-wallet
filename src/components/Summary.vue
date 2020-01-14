<template>
  <b-container>
    <b-row>
      <b-col>
        <h4>Wallet Address</h4>
      </b-col>
      <b-col cols="9">
        <b><span class="text-primary">{{ w.address }}</span></b>
      </b-col>
    </b-row>

    <b-row>
      <b-col>
        <h4>
          Available Balance <b-icon-info v-b-popover.hover.right="'Amount of UND available for transfer and staking'" title="Available Balance"/>
        </h4>
      </b-col>
      <b-col cols="9">
        <h4><span class="text-success">{{ w.balance }} UND</span></h4>
      </b-col>
    </b-row>

    <b-row v-show="w.staking.totalDelegations > 0">
      <b-col>
        <h4>
          Total Balance <b-icon-info v-b-popover.hover.right="'Total UND in this wallet, including any staked UND, unbonding UND and Enterprise Locked UND'" title="Total Balance"/>
        </h4>
      </b-col>
      <b-col cols="9">
        <span class="text-info">{{ formatAmount(w.totalBalance) }}</span>
      </b-col>
    </b-row>

    <b-row v-show="w.staking.totalDelegations > 0">
      <b-col>
        <h4>
          Staking <b-icon-info v-b-popover.hover.right="'Your current staking and delegations'" title="Staking"/>
        </h4>
      </b-col>
      <b-col cols="9">
        <b-row>
          <b-col>Delegations</b-col>
          <b-col>{{ w.staking.totalDelegations }}</b-col>
        </b-row>
        <b-row>
          <b-col>Shares</b-col>
          <b-col>{{ w.staking.totalShares }}</b-col>
        </b-row>
        <b-row>
          <b-col>Delegated</b-col>
          <b-col><span class="text-info">{{ formatAmount(w.staking.totalStaked) }}</span></b-col>
        </b-row>
        <b-row v-show="w.staking.totalUnbonding > 0">
          <b-col>Unbonding</b-col>
          <b-col><span class="text-info">{{ formatAmount(w.staking.totalUnbonding) }}</span></b-col>
        </b-row>
        <b-row>
          <b-col>Rewards</b-col>
          <b-col><span class="text-info">{{ formatAmount(w.staking.totalRewards) }}</span></b-col>
        </b-row>
      </b-col>
    </b-row>

    <b-row v-show="w.locked > 0">
      <b-col>
        <h4>
          Enterprise Locked <b-icon-info v-b-popover.hover.right="'Amount of purchased locked Enterprise UND which can be used for WRKChain and BEACON fees'" title="Enterprise Locked"/>
        </h4>
      </b-col>
      <b-col cols="9">
        <span class="text-info">{{ w.locked }} UND</span>
      </b-col>
    </b-row>
  </b-container>
</template>

<script>
  export default {
    name: "Summary",
    props: {
      wallet: Object
    },
    data: function () {
      return {
        w: this.wallet
      }
    },
    watch: {
      wallet: function (newWallet) {
        this.w = newWallet
      }
    },
  }
</script>
