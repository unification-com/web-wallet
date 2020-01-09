<template>
  <div class="container">

    <div>Address: {{ w.address }}</div>
    <br/>
    <div>Balance: {{ w.balance }} UND</div>
    <div v-show="w.locked > 0">Enterprise Locked: {{ w.locked }} UND</div>
    <ul class="nav nav-tabs nav-justified">
      <li class="nav-item">
        <a class="nav-link" @click.prevent="setActive('transfer'), updateWallet()" :class="{ active: isActive('transfer') }"
           href="#transfer">Transfer</a>
      </li>
      <li class="nav-item">
        <a class="nav-link" @click.prevent="setActive('transactions'), updateWallet()"
           :class="{ active: isActive('transactions') }" href="#transactions">Transactions</a>
      </li>
      <li class="nav-item">
        <a class="nav-link" @click.prevent="setActive('stake'), updateWallet()" :class="{ active: isActive('stake') }"
           href="#stake">Staking</a>
      </li>
      <li class="nav-item">
        <a class="nav-link" @click.prevent="setActive('enterprise'), updateWallet()" :class="{ active: isActive('enterprise') }"
           href="#enterprise">Enterprise</a>
      </li>
    </ul>
    <div class="tab-content py-3" id="unlocked-wallet-content">
      <div class="tab-pane fade" :class="{ 'active show': isActive('transactions') }" id="transactions">
        <Transactions v-bind:client="clnt" v-bind:wallet="w" ref="txcomponent" />
      </div>
      <div class="tab-pane fade" :class="{ 'active show': isActive('enterprise') }" id="enterprise">
        <Enterprise v-bind:client="clnt" v-bind:wallet="w" />
      </div>
      <div class="tab-pane fade" :class="{ 'active show': isActive('transfer') }" id="transfer">
        <Transfer v-bind:client="clnt" v-bind:wallet="w"/>
      </div>
      <div class="tab-pane fade" :class="{ 'active show': isActive('stake') }" id="stake">
        <Staking v-bind:client="clnt" v-bind:wallet="w" ref="stakingcomponent"/>
      </div>
    </div>
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
      isActive: function (menuItem) {
        return this.activeItem === menuItem
      },
      setActive: function (menuItem) {
        this.activeItem = menuItem
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
