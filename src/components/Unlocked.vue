<template>
  <div class="container">

    <Summary v-bind:wallet="w"/>

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
        <b-tab title="Staking" @click.prevent="updateWallet(), $refs.stakingcomponent.getDelegations()">
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
        if(newWallet.isWalletUnlocked) {
          this.updateWallet()
        }
      },
      client: function (newClient) {
        this.clnt = newClient
        if (newClient !== null) {
          this.chainId = newClient.chainId
          this.updateWallet()
        }
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
        this.timer = setInterval(this.updateWallet, 5000)
      },
      updateWallet: async function () {
        if (this.clnt !== null && this.w.isWalletUnlocked > 0) {
          this.getBalance()
          await this.getEnterpriseLocked()
          await this.getRewards()
          await this.getUnbonding()
          this.getTotalUnd()
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
        if('amount' in res) {
          let amount = new Big(res.amount)
          this.w.locked = Number(amount.div(UND_CONFIG.BASENUMBER))
          this.w.lockedNund = res.amount
        }
      },
      getRewards: async function() {
        if (this.clnt !== null && this.w.isWalletUnlocked) {
          const delRes = await this.clnt.getDelegations()

          let totalShares = new Big('0')
          let totalStaked = new Big('0')
          let totalRewards = new Big('0')

          if (delRes.status === 200) {
            this.w.staking.totalDelegations = 0
            for (let i = 0; i < delRes.result.result.length; i++) {
              this.w.staking.totalDelegations++
              let validatorAddress = delRes.result.result[i].validator_address
              totalShares = totalShares.add(delRes.result.result[i].shares)
              totalStaked = totalStaked.add(delRes.result.result[i].balance.amount)
              let res = await this.clnt.getDelegatorRewards(this.w.address, validatorAddress)
              if (res.status === 200 && res.result.result.length > 0) {
                totalRewards = totalRewards.add(res.result.result[0].amount)
              }
            }
          }
          this.w.staking.totalShares = Number(totalShares)
          this.w.staking.totalStaked = Number(totalStaked)
          this.w.staking.totalRewards = Number(totalRewards)
        }
      },
      getUnbonding: async function() {
        if (this.clnt !== null && this.w.isWalletUnlocked) {
          let res = await this.clnt.getUnbondingDelegations()
          let totalUnbonding = new Big('0')
          if (res.status === 200) {
            for (let i = 0; i < res.result.result.length; i++) {
              for(let j = 0; j < res.result.result[i].entries.length; j++) {
                totalUnbonding = totalUnbonding.add(res.result.result[i].entries[j].balance)
              }
            }
          }
          this.w.staking.totalUnbonding = Number(totalUnbonding)
        }
      },
      getTotalUnd: function() {
        let totalBalance = new Big(this.w.balanceNund)
        let totalStaked = new Big(this.w.staking.totalStaked)
        let totalUnbonding = new Big(this.w.staking.totalUnbonding)
        totalBalance = totalBalance.add(totalStaked)
        totalBalance = totalBalance.add(totalUnbonding)
        this.w.totalBalance = totalBalance
      }
    }
  };
</script>
