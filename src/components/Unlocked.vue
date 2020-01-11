<template>
  <div class="container">

    <b-container class="bv-example-row">
      <b-row>
        <b-col>
          <h4>Wallet Address</h4>
        </b-col>
        <b-col>
          <h4>Balance</h4>
        </b-col>
        <b-col v-show="w.locked > 0">
          <h4>Enterprise Locked</h4>
        </b-col>
      </b-row>
      <b-row>
        <b-col>{{ w.address }}</b-col>
        <b-col>{{ w.balance }} UND</b-col>
        <b-col v-show="w.locked > 0">{{ w.locked }} UND</b-col>
      </b-row>
    </b-container>

    <b-card no-body>
      <b-tabs pills card>
        <b-tab title="Transfer" active @click.prevent="updateWallet()">
          <b-card-text>
            <Transfer v-bind:client="clnt" v-bind:wallet="w"/>
          </b-card-text>
        </b-tab>
        <b-tab title="Transactions" @click.prevent="updateWallet()">
          <b-card-text>
            <Transactions v-bind:client="clnt" v-bind:wallet="w" ref="txcomponent" />
          </b-card-text>
        </b-tab>
        <b-tab title="Staking" @click.prevent="updateWallet()">
          <b-card-text>
            <Staking v-bind:client="clnt" v-bind:wallet="w" ref="stakingcomponent"/>
          </b-card-text>
        </b-tab>
        <b-tab title="Enterprise" @click.prevent="updateWallet()">
          <b-card-text>
            <Enterprise v-bind:client="clnt" v-bind:wallet="w" />
          </b-card-text>
        </b-tab>
      </b-tabs>
    </b-card>
  </div>
</template>

<script>
  import Big from 'big.js'
  import {UND_CONFIG} from '@/constants.js'

  import Enterprise from '@/components/Enterprise.vue'
  import Staking from '@/components/Staking.vue'
  import Transactions from '@/components/Transactions.vue'
  import Transfer from '@/components/Transfer.vue'

  export default {
    name: 'Unlocked',
    components: {
      Enterprise,
      Staking,
      Transactions,
      Transfer,
    },
    props: {
      wallet: Object,
      client: Object
    },
    data: function () {
      return {
        timer: null,
        activeItem: 'transfer',
        chainId: '',
        w: this.wallet,
        clnt: this.client,
      }
    },
    watch: {
      wallet: function (newWallet) {
        this.w = newWallet
        this.refreshBalance()
        if(newWallet.isWalletUnlocked) {
          this.updateWallet()
        }
      },
      client: function (newClient) {
        this.clnt = newClient
        this.refreshBalance()
        if (newClient !== null) {
          this.chainId = newClient.chainId
          this.updateWallet()
        }
      }
    },
    beforeDestroy () {
      clearInterval(this.timer)
    },
    methods: {
      refreshBalance: function() {
        clearInterval(this.timer)
        this.timer = setInterval(this.getBalance, 5000)
      },
      updateWallet: function () {
        if (this.clnt !== null && this.w.isWalletUnlocked > 0) {
          this.getBalance()
          this.getEnterpriseLocked()
          this.$refs.txcomponent.loadTransactions()
          this.$refs.stakingcomponent.getDelegations()
        }
      },
      getBalance: async function () {
        const res = await this.clnt.getBalance()
        if (res.length > 0) {
          let amount = new Big(res[0].amount)
          this.w.balance = Number(amount.div(UND_CONFIG.BASENUMBER))
          this.w.balanceNund = res[0].amount
        } else {
          this.w.balance = '0'
          this.w.balanceNund = '0'
        }
      },
      getEnterpriseLocked: async function() {
        const res = await this.clnt.getEnterpriseLocked()
        let amount = new Big(res.amount)
        this.w.locked = Number(amount.div(UND_CONFIG.BASENUMBER))
        this.w.lockedNund = res.amount
      }
    }
  };
</script>
