<template>
  <div>

    <Modal
    v-show="isConfirmDelegate"
    @close="closeConfirmDelegate"
    >
      <template v-slot:modalHeader>
        Confirm Delegation
      </template>
      <template v-slot:modalBody>
        <p>Please confirm:</p>
        Amount: {{delegateData.und}} UND<br>
        Validator: {{getValidatorMoniker(delegateData.address)}}
      </template>
      <template v-slot:modalFooter>
        <button
        type="button"
        class="btn-green"
        @click="confirmDelegation"
        aria-label="Create"
        >
          Confirm
        </button>
        <button
        type="button"
        class="btn-green"
        @click="closeConfirmDelegate"
        aria-label="Close modal"
        >
          Close
        </button>
      </template>
    </Modal>

    <Modal
    v-show="isInitUndelegate"
    @close="closeInitUndelegate"
    >
      <template v-slot:modalHeader>
        Undelegate
      </template>
      <template v-slot:modalBody>
        Undelegate <input type="text" v-model="undelegateData.und" placeholder=""> UND<br>
        from {{getValidatorMoniker(undelegateData.address)}}<br>
        (maximum {{undelegateData.max}}UND)<br>
        <b>Note:</b> outstanding rewards will automatically be withdrawn during undelegation
      </template>
      <template v-slot:modalFooter>
        <button
        type="button"
        class="btn-green"
        @click="showConfirmUnDelegation"
        aria-label="Create"
        >
          Undelegate
        </button>
        <button
        type="button"
        class="btn-green"
        @click="closeInitUndelegate"
        aria-label="Close modal"
        >
          Close
        </button>
      </template>
    </Modal>

    <Modal
    v-show="isConfirmUndelegate"
    @close="closeConfirmUndelegate"
    >
      <template v-slot:modalHeader>
        Confirm Undelegate
      </template>
      <template v-slot:modalBody>
        Undelegate {{ undelegateData.und }} UND
        from {{getValidatorMoniker(undelegateData.address)}}?
      </template>
      <template v-slot:modalFooter>
        <button
        type="button"
        class="btn-green"
        @click="confirmUndelegation"
        aria-label="Create"
        >
          Confirm
        </button>
        <button
        type="button"
        class="btn-green"
        @click="closeConfirmUndelegate"
        aria-label="Close modal"
        >
          Close
        </button>
      </template>
    </Modal>

    <Modal
    v-show="isConfirmWithdraw"
    @close="closeConfirmWithdraw"
    >
      <template v-slot:modalHeader>
        Confirm Withdraw Rewards
      </template>
      <template v-slot:modalBody>
        Withdraw {{ withdrawData.und }} UND<br>
        from {{getValidatorMoniker(withdrawData.address)}}<br>
      </template>
      <template v-slot:modalFooter>
        <button
        type="button"
        class="btn-green"
        @click="confirmWithdrawReward"
        aria-label="Create"
        >
          Confirm
        </button>
        <button
        type="button"
        class="btn-green"
        @click="closeConfirmWithdraw"
        aria-label="Close modal"
        >
          Close
        </button>
      </template>
    </Modal>

    <ul class="nav nav-tabs nav-justified">

      <li class="nav-item">
        <a class="nav-link" @click.prevent="setActive('delegations'), getDelegations()"
           :class="{ active: isActive('delegations') }"
           href="#transfer">Delegations</a>
      </li>
      <li class="nav-item">
        <a class="nav-link" @click.prevent="setActive('stake')"
           :class="{ active: isActive('stake') }" href="#stake">Stake</a>
      </li>
    </ul>
    <div class="tab-content py-3" id="staking-content">
      <div class="tab-pane fade" :class="{ 'active show': isActive('delegations') }" id="delegations">
        <button @click="getDelegations()">Refresh</button>
        <div>
          <b-table :items="delegations" striped responsive="sm">
            <template v-slot:cell(undelegate)="row">
              <b-button size="sm" @click="initUndelegate(row.item)" class="mr-2">
                Undelegate
              </b-button>
            </template>

            <template v-slot:cell(shares)="data">
              <b class="text-info">{{ Number(data.value) }}</b>
            </template>
            <template v-slot:cell(stake)="data">
              <b class="text-info">{{ formatAmount(data.value)}}</b>
            </template>
            <template v-slot:cell(rewards)="data">
              <b class="text-info">{{ formatAmount(data.value)}}</b>
            </template>
            <template v-slot:cell(withdraw)="row">
              <b-button size="sm" @click="showConfirmWithdraw(row.item)" class="mr-2">
                Withdraw
              </b-button>
            </template>
          </b-table>
        </div>
      </div>
      <div class="tab-pane fade" :class="{ 'active show': isActive('stake') }" id="stake">

        <h3>Delegate</h3>
        Select Existing Validator <select v-model="delegateData.address">
        <option v-for="val of validators" v-bind:value="val['operator_address']">
          {{ val['description']['moniker'] }}
        </option>
      </select><br>
        Or enter Validator Operator Address: <input type="text" v-model="delegateData.address" placeholder="">
        (note - this starts with "undvaloper")<br>
        Amount: <input type="text" v-model="delegateData.und" placeholder=""> UND<br>
        Memo: <input type="text" v-model="delegateData.memo" placeholder=""><br>
        <button @click="showConfirmDelegate()">Delegate UND</button><br>
        <b>Note:</b> outstanding rewards will automatically be withdrawn during delegation
      </div>
    </div>
  </div>
</template>

<script>
  import Modal from '@/components/Modal.vue'
  import {UND_CONFIG} from '@/constants.js'

  const UndClient = require('@unification-com/und-js')

  export default {
    name: "Staking",
    components: {
      Modal
    },
    props: {
      client: Object,
      wallet: Object
    },
    data: function () {
      return {
        clnt: this.client,
        w: this.wallet,
        activeItem: 'delegations',
        delegateData: {
          address: '',
          und: '',
          memo: UND_CONFIG.DEFAULT_MEMO
        },
        undelegateData: {
          address: '',
          und: '',
          max: '',
          memo: UND_CONFIG.DEFAULT_MEMO
        },
        withdrawData: {
          address: '',
          und: ''
        },
        validators: {},
        delegations: [],
        isConfirmDelegate: false,
        isConfirmUndelegate: false,
        isInitUndelegate: false,
        isConfirmWithdraw: false
      }
    },
    watch: {
      wallet: function (newWallet) {
        this.w = newWallet
      },
      client: function (newClient) {
        this.clnt = newClient
      }
    },
    methods: {
      isActive: function (menuItem) {
        return this.activeItem === menuItem
      },
      setActive: function (menuItem) {
        this.activeItem = menuItem
      },
      showConfirmDelegate: function () {
        if (this.delegateData.und <= 0 || isNaN(this.delegateData.und)) {
          this.$bvToast.toast('Amount must be greater than zero', {
            title: 'Error',
            variant: 'danger',
            solid: true,
            autoHideDelay: 10000,
            appendToast: true
          })
          return false
        }
        if(this.delegateData.und >= this.w.balance) {
          this.$bvToast.toast('cannot delegate more than your balance', {
            title: 'Error',
            variant: 'danger',
            solid: true,
            autoHideDelay: 10000,
            appendToast: true
          })
          return false
        }
        if (!UndClient.crypto.checkAddress(this.delegateData.address, UND_CONFIG.BECH32_VAL_PREFIX)) {
          this.$bvToast.toast('"' + this.delegateData.address + '" is not a valid operator address', {
            title: 'Error',
            variant: 'danger',
            solid: true,
            autoHideDelay: 10000,
            appendToast: true
          })
          return false
        }
        this.isConfirmDelegate = true
      },
      closeConfirmDelegate: function () {
        this.isConfirmDelegate = false
        this.clearDelegateData()
      },
      showInitUndelegate: function() {
        this.isInitUndelegate = true
      },
      closeInitUndelegate: function() {
        this.isInitUndelegate = false
      },
      showConfirmUnDelegation: function() {
        if (this.undelegateData.und <= 0 || isNaN(this.undelegateData.und) || this.undelegateData.und > this.undelegateData.max) {
          this.$bvToast.toast('Amount must be greater than zero, and less than ' + this.undelegateData.max + 'UND', {
            title: 'Error',
            variant: 'danger',
            solid: true,
            autoHideDelay: 10000,
            appendToast: true
          })
          return false
        }
        if (!UndClient.crypto.checkAddress(this.undelegateData.address, UND_CONFIG.BECH32_VAL_PREFIX)) {
          this.$bvToast.toast('"' + this.undelegateData.address + '" is not a valid operator address', {
            title: 'Error',
            variant: 'danger',
            solid: true,
            autoHideDelay: 10000,
            appendToast: true
          })
          return false
        }
        this.closeInitUndelegate()
        this.isConfirmUndelegate = true
      },
      closeConfirmUndelegate: function() {
        this.isConfirmUndelegate = false
      },
      showConfirmWithdraw: function(item) {
        this.clearWithdrawData()
        this.withdrawData.address = item.validator_address
        this.withdrawData.und = this.nundToUnd(item.rewards)
        this.isConfirmWithdraw = true
      },
      closeConfirmWithdraw: function() {
        this.isConfirmWithdraw = false
      },
      clearDelegateData: function () {
        this.delegateData = {
          address: '',
          und: '',
          memo: UND_CONFIG.DEFAULT_MEMO
        }
      },
      clearUnDelegateData: function () {
        this.undelegateData = {
          address: '',
          und: '',
          max: '',
          memo: UND_CONFIG.DEFAULT_MEMO
        }
      },
      clearWithdrawData: function() {
        this.withdrawData = {
          address: '',
          und: ''
        }
      },
      initUndelegate: function(item) {
        this.clearUnDelegateData()
        this.undelegateData.address = item.validator_address
        this.undelegateData.max = this.nundToUnd(item.stake)
        this.showInitUndelegate()
      },
      clientError: function () {
        this.$bvToast.toast("Client not connected or wallet not unlocked. Please reload", {
          title: 'Error',
          variant: 'danger',
          solid: true,
          autoHideDelay: 10000,
          appendToast: true
        })
      },
      getValidatorMoniker: function(validatorAddress) {
        let moniker = validatorAddress
        if (validatorAddress in this.validators) {
          moniker = this.validators[validatorAddress]['description']['moniker']
        }
        return moniker
      },
      getValidators: async function () {
        if (this.clnt !== null && this.w.isWalletUnlocked) {
          let res = await this.clnt.getValidators()
          if (res.status === 200) {
            for (let i = 0; i < res.result.result.length; i++) {
              this.validators[res.result.result[i].operator_address] = res.result.result[i]
            }
          }
        }
      },
      getDelegations: async function () {
        if (this.clnt !== null && this.w.isWalletUnlocked) {
          await this.getValidators()
          let res = await this.clnt.getDelegations()
          this.delegations = []
          if (res.status === 200) {
            for (let i = 0; i < res.result.result.length; i++) {
              let moniker = ''
              let validator_address = res.result.result[i].validator_address
              if (validator_address in this.validators) {
                moniker = this.validators[validator_address]['description']['moniker']
              }//x.toFixed(15).replace(/0+$/, "")
              let del = {
                name: moniker,
                validator_address: validator_address,
                shares: res.result.result[i].shares,
                stake: res.result.result[i].balance.amount,
                rewards: await this.getRewards(validator_address),
                undelegate: '',
                withdraw: '',
              }
              this.delegations.push(del)
            }
          }
        }
      },
      getRewards: async function(valAddress) {
        let rewards = '0'
        if (this.clnt !== null && this.w.isWalletUnlocked) {
          let res = await this.clnt.getDelegatorRewards(this.w.address, valAddress)
          if (res.status === 200 && res.result.result.length > 0) {
            rewards = res.result.result[0].amount
          }
        }
        return rewards
      },
      confirmDelegation: function() {
        this.confirmDelegationAsync()
      },
      confirmDelegationAsync: async function () {
        if (this.clnt !== null && this.w.isWalletUnlocked) {
          let fee = {
            "amount": [
              {
                "denom": "nund",
                "amount": "5000"
              }
            ],
            "gas": "190000"
          }

          try {
            let res = await this.clnt.delegate(
            this.delegateData.address,
            this.delegateData.und,
            fee,
            "und",
            this.w.address,
            this.delegateData.memo
            )

            if (res.status === 200) {
              this.$bvToast.toast('Tx hash: ' + res.result.txhash, {
                title: 'Tx successfully broadcast',
                variant: 'success',
                solid: true,
                autoHideDelay: 10000,
                appendToast: true
              })
            }

          } catch (err) {
            this.$bvToast.toast(err.toString(), {
              title: 'Error',
              variant: 'danger',
              solid: true,
              autoHideDelay: 10000,
              appendToast: true
            })

          }
          this.isConfirmDelegate = false
        } else {
          this.clientError()
        }
        this.closeConfirmDelegate()
      },
      confirmUndelegation: function() {
        this.confirmUndelegationAsync()
      },
      confirmUndelegationAsync: async function() {
        if (this.clnt !== null && this.w.isWalletUnlocked) {
          let fee = {
            "amount": [
              {
                "denom": "nund",
                "amount": "5000"
              }
            ],
            "gas": "190000"
          }

          try {
            let res = await this.clnt.undelegate(
            this.undelegateData.address,
            this.undelegateData.und,
            fee,
            "und",
            this.w.address,
            this.undelegateData.memo
            )

            if (res.status === 200) {
              this.$bvToast.toast('Tx hash: ' + res.result.txhash, {
                title: 'Tx successfully broadcast',
                variant: 'success',
                solid: true,
                autoHideDelay: 10000,
                appendToast: true
              })
            }

          } catch (err) {
            this.$bvToast.toast(err.toString(), {
              title: 'Error',
              variant: 'danger',
              solid: true,
              autoHideDelay: 10000,
              appendToast: true
            })
          }
        } else {
          this.clientError()
        }
        this.closeConfirmUndelegate()
      },
      confirmWithdrawReward: function() {
        this.confirmWithdrawRewardAsync()
      },
      confirmWithdrawRewardAsync: async function() {
        if (this.clnt !== null && this.w.isWalletUnlocked) {
          let fee = {
            "amount": [
              {
                "denom": "nund",
                "amount": "5000"
              }
            ],
            "gas": "190000"
          }

          try {
            let res = await this.clnt.withdrawDelegationReward(
            this.withdrawData.address,
            fee,
            this.w.address,
            this.undelegateData.memo
            )

            if (res.status === 200) {
              this.$bvToast.toast('Tx hash: ' + res.result.txhash, {
                title: 'Tx successfully broadcast',
                variant: 'success',
                solid: true,
                autoHideDelay: 10000,
                appendToast: true
              })
            }

          } catch (err) {
            this.$bvToast.toast(err.toString(), {
              title: 'Error',
              variant: 'danger',
              solid: true,
              autoHideDelay: 10000,
              appendToast: true
            })
          }
        } else {
          this.clientError()
        }
        this.closeConfirmWithdraw()
      }
    }
  }
</script>

<style scoped>

</style>