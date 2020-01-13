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
      <b-col><h4>Balance</h4></b-col>
      <b-col cols="9"><b><span class="text-success">{{ w.balance }} UND</span></b></b-col>
    </b-row>

    <b-row v-show="w.staking.totalDelegations > 0">
      <b-col>
        <h4>Staking</h4>
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
          <b-col>Staked</b-col>
          <b-col>{{ formatAmount(w.staking.totalStaked) }}</b-col>
        </b-row>
        <b-row>
          <b-col>Rewards</b-col>
          <b-col>{{ formatAmount(w.staking.totalRewards) }}</b-col>
        </b-row>
      </b-col>
    </b-row>

    <b-row v-show="w.locked > 0">
      <b-col>
        <h4>Enterprise Locked</h4>
      </b-col>
      <b-col cols="9">{{ w.locked }} UND</b-col>
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
        w: this.wallet,
      }
    },
    watch: {
      wallet: function (newWallet) {
        this.w = newWallet
      }
    },
  }
</script>
