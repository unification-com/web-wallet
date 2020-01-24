<template>
  <div>
    <!-- undelegate modal -->
    <b-modal id="bv-modal-undelegate-und">
      <template v-slot:modal-title>
        <h3>Undelegate UND</h3>
      </template>
      <b-form @submit.prevent="preventSubmit">
        <b-form-group
        id="undelegate-und-label"
        label="Undelegate:"
        label-for="undelegate-und"
        description="Amount of UND to undelegate"
        >
          <b-input-group append="UND">
            <b-form-input
            id="undelegate-und"
            v-model="undelegateData.und"
            type="number"
            required
            v-on:keydown.enter.prevent="preventSubmit"
            :state="unDelegateAmountState"
            aria-describedby="input-live-feedback-undelegate-amount"
            />
            <b-form-invalid-feedback id="input-live-feedback-undelegate-amount">
              Invalid amount
            </b-form-invalid-feedback>
          </b-input-group>
        </b-form-group>
        <p>
          <b>(maximum {{undelegateData.max}}UND)</b><br>
        </p>
        <b-form-group
        id="undelegate-from-label"
        label="From:"
        label-for="undelegate-from"
        description="Address to undelegate from"
        >
          <b-form-input
          id="undelegate-from"
          v-model="undelegateData.address"
          type="text"
          required
          plaintext
          />
        </b-form-group>

        <b-form-group
        id="undelegate-fee-amount-label"
        label="Fee:"
        label-for="undelegate-fee-amount"
        description="Fees in nund"
        v-show="isShowFee"
        >
          <b-input-group append="nund">
            <b-form-input
            id="undelegate-fee-amount"
            v-model="fee.amount[0].amount"
            type="number"
            trim
            v-on:keydown.enter.prevent="preventSubmit"
            aria-describedby="input-live-feedback-undelegate-fees"
            :state="feeState"
            />
            <b-form-invalid-feedback id="input-live-feedback-undelegate-fees">
              Invalid fees
            </b-form-invalid-feedback>
          </b-input-group>
        </b-form-group>
        <b-form-group
        id="undelegate-fee-gas-label"
        label="Gas:"
        label-for="undelegate-fee-gas"
        description="Gas"
        v-show="isShowFee"
        >
          <b-form-input
          id="undelegate-fee-gas"
          v-model="fee.gas"
          type="number"
          trim
          v-on:keydown.enter.prevent="preventSubmit"
          aria-describedby="input-live-feedback-undelegate-gas"
          :state="gasState"
          />
          <b-form-invalid-feedback id="input-live-feedback-undelegate-gas">
            Invalid gas
          </b-form-invalid-feedback>
        </b-form-group>

        <b-form-checkbox
        id="undelegate-show-fee"
        v-model="isShowFee"
        name="undelegate-show-fee"
        >
          Manually set Fees
        </b-form-checkbox>
        <p>
          <b>Note:</b> outstanding rewards will automatically be withdrawn during undelegation
        </p>
      </b-form>
      <template v-slot:modal-footer>
        <b-button
        variant="success"
        @click="showConfirmUnDelegation"
        aria-label="Create"
        :disabled="!unDelegateFormState"
        >
          Undelegate
        </b-button>
        <b-button
        @click="$bvModal.hide('bv-modal-undelegate-und')"
        aria-label="Cancel"
        >
          Cancel
        </b-button>
      </template>
    </b-modal>

    <!-- confirm undelegate modal -->
    <b-modal id="bv-modal-confirm-undelegate-und">
      <template v-slot:modal-title>
        <h3>Confirm Undelegate UND</h3>
      </template>
      Undelegate <span class="text-info">{{ undelegateData.und }}UND</span>
      from {{getValidatorMoniker(undelegateData.address)}}?<br>
      Fee: {{fee.amount[0].amount}}nund<br>
      Gas: {{fee.gas}}
      <template v-slot:modal-footer>
        <b-button
        variant="success"
        @click="confirmUndelegation"
        aria-label="Create"
        >
          Confirm
        </b-button>
        <b-button
        @click="$bvModal.hide('bv-modal-confirm-undelegate-und')"
        aria-label="Cancel"
        >
          Cancel
        </b-button>
      </template>
    </b-modal>

    <!-- redelegate modal -->
    <b-modal id="bv-modal-redelegate-und">
      <template v-slot:modal-title>
        <h3>Redelegate UND</h3>
      </template>
      <b-form @submit.prevent="preventSubmit">
        <b-form-group
        id="redelegate-und-label"
        label="redelegate:"
        label-for="redelegate-und"
        description="Amount of UND to redelegate"
        >
          <b-input-group append="UND">
            <b-form-input
            id="redelegate-und"
            v-model="redelegateData.und"
            type="number"
            required
            v-on:keydown.enter.prevent="preventSubmit"
            :state="reDelegateAmountState"
            aria-describedby="input-live-feedback-redelegate-amount"
            />
            <b-form-invalid-feedback id="input-live-feedback-redelegate-amount">
              Invalid amount
            </b-form-invalid-feedback>
          </b-input-group>
        </b-form-group>
        <p>
          <b>(maximum {{redelegateData.max}}UND)</b><br>
        </p>
        <b-form-group
        id="redelegate-from-label"
        label="From:"
        label-for="redelegate-from"
        description="Address to redelegate from"
        >
          <b-form-input
          id="redelegate-from"
          v-model="redelegateData.src"
          type="text"
          required
          plaintext
          v-on:keydown.enter.prevent="preventSubmit"
          />
        </b-form-group>

        <b-form-group
        id="redelegate-node-label"
        label="To:"
        label-for="redelegate-node"
        description="Select an existing validator"
        >
          <b-form-select id="redelegate-node" v-model="redelegateData.dst" :options="validators.validatorsSelect"/>
        </b-form-group>
        <b-form-group
        id="redelegate-manual-node-label"
        label="Or Manually Enter Validator:"
        label-for="redelegate-manual-node"
        description="Alternatively, enter a validator address manually (note - this starts with undvaloper)"
        >
          <b-form-input
          id="redelegate-manual-node"
          v-model="redelegateData.dst"
          type="text"
          required
          v-on:keydown.enter.prevent="preventSubmit"
          />
        </b-form-group>

        <b-form-group
        id="redelegate-fee-amount-label"
        label="Fee:"
        label-for="redelegate-fee-amount"
        description="Fees in nund"
        v-show="isShowFee"
        >
          <b-input-group append="nund">
            <b-form-input
            id="redelegate-fee-amount"
            v-model="fee.amount[0].amount"
            type="number"
            trim
            v-on:keydown.enter.prevent="preventSubmit"
            aria-describedby="input-live-feedback-redelegate-fees"
            :state="feeState"
            />
            <b-form-invalid-feedback id="input-live-feedback-redelegate-fees">
              Invalid fees
            </b-form-invalid-feedback>
          </b-input-group>
        </b-form-group>
        <b-form-group
        id="redelegate-fee-gas-label"
        label="Gas:"
        label-for="redelegate-fee-gas"
        description="Gas"
        v-show="isShowFee"
        >
          <b-form-input
          id="redelegate-fee-gas"
          v-model="fee.gas"
          type="number"
          trim
          v-on:keydown.enter.prevent="preventSubmit"
          aria-describedby="input-live-feedback-redelegate-gas"
          :state="gasState"
          />
          <b-form-invalid-feedback id="input-live-feedback-redelegate-gas">
            Invalid gas
          </b-form-invalid-feedback>
        </b-form-group>

        <b-form-checkbox
        id="redelegate-show-fee"
        v-model="isShowFee"
        name="redelegate-show-fee"
        >
          Manually set Fees
        </b-form-checkbox>
      </b-form>

      <p>
        <b>Note:</b> outstanding rewards will automatically be withdrawn during redelegation
      </p>
      <template v-slot:modal-footer>
        <b-button
        variant="success"
        @click="showConfirmReDelegation"
        aria-label="Redelegate"
        :disabled="!reDelegateFormState"
        >
          Redelegate
        </b-button>
        <b-button
        @click="$bvModal.hide('bv-modal-redelegate-und')"
        aria-label="Cancel"
        >
          Cancel
        </b-button>
      </template>
    </b-modal>

    <!-- confirm redelegate modal -->
    <b-modal id="bv-modal-confirm-redelegate-und">
      <template v-slot:modal-title>
        <h3>Confirm redelegate UND</h3>
      </template>
      redelegate <span class="text-info">{{ redelegateData.und }}UND</span>
      from {{getValidatorMoniker(redelegateData.src)}}?<br>
      to {{getValidatorMoniker(redelegateData.dst)}}?<br>
      Fee: {{fee.amount[0].amount}}nund<br>
      Gas: {{fee.gas}}
      <template v-slot:modal-footer>
        <b-button
        variant="success"
        @click="confirmRedelegation"
        aria-label="Confirm"
        >
          Confirm
        </b-button>
        <b-button
        @click="$bvModal.hide('bv-modal-confirm-redelegate-und')"
        aria-label="Cancel"
        >
          Cancel
        </b-button>
      </template>
    </b-modal>


    <!-- confirm withdraw rewards modal -->
    <b-modal id="bv-modal-confirm-withdraw-rewards">
      <template v-slot:modal-title>
        <h3>Confirm Withdraw Rewards</h3>
      </template>
      Withdraw <span class="text-info">{{ withdrawData.und }} UND</span><br>
      from {{getValidatorMoniker(withdrawData.address)}}<br><br>
      Fee: {{fee.amount[0].amount}}nund<br>
      Gas: {{fee.gas}}
      <b-form @submit.prevent="preventSubmit">
        <b-form-group
        id="withdraw-fee-amount-label"
        label="Fee:"
        label-for="withdraw-fee-amount"
        description="Fees in nund"
        v-show="isShowFee"
        >
          <b-input-group append="nund">
            <b-form-input
            id="withdraw-fee-amount"
            v-model="fee.amount[0].amount"
            type="text"
            trim
            v-on:keydown.enter.prevent="preventSubmit"
            aria-describedby="input-live-feedback-withdraw-fees"
            :state="feeState"
            />
            <b-form-invalid-feedback id="input-live-feedback-withdraw-fees">
              Invalid fees
            </b-form-invalid-feedback>
          </b-input-group>
        </b-form-group>
        <b-form-group
        id="withdraw-fee-gas-label"
        label="Gas:"
        label-for="withdraw-fee-gas"
        description="Gas"
        v-show="isShowFee"
        >
          <b-form-input
          id="withdraw-fee-gas"
          v-model="fee.gas"
          type="text"
          trim
          v-on:keydown.enter.prevent="preventSubmit"
          aria-describedby="input-live-feedback-withdraw-gas"
          :state="gasState"
          />
          <b-form-invalid-feedback id="input-live-feedback-withdraw-gas">
            Invalid gas
          </b-form-invalid-feedback>
        </b-form-group>

        <b-form-checkbox
        id="withdraw-show-fee"
        v-model="isShowFee"
        name="withdraw-show-fee"
        >
          Manually set Fees
        </b-form-checkbox>
      </b-form>
      <template v-slot:modal-footer>
        <b-button
        variant="success"
        @click="confirmWithdrawReward"
        aria-label="Create"
        :disabled="!withdrawFormState"
        >
          Confirm
        </b-button>
        <b-button
        @click="$bvModal.hide('bv-modal-confirm-withdraw-rewards')"
        aria-label="Cancel"
        >
          Cancel
        </b-button>
      </template>
    </b-modal>

    <b-container class="bv-example-row">
      <b-row>
        <b-col>
          <h3>Current Delegations and Rewards</h3>
        </b-col>
        <b-col>
          <b-button @click="getDelegations()">Refresh</b-button>
        </b-col>
      </b-row>
    </b-container>

    <div v-show="isDataLoading">
      <b-spinner style="width: 3rem; height: 3rem;" label="Large Spinner"/>
    </div>

    <div v-show="!isDataLoading">
      <b-table :items="JSON.parse(JSON.stringify(delegations.delegations.slice()))" :fields="delegationsFields" striped responsive="sm">

        <template v-slot:cell(show_details)="row">
          <b-button size="sm" @click="row.toggleDetails" class="mr-2">
            {{ row.detailsShowing ? 'Hide' : 'Show'}} Details
          </b-button>
        </template>
        <template v-slot:row-details="row">
          <b-card>
            <b-row class="mb-2">
              <b-col sm="3" class="text-sm-right"><b>Moniker:</b></b-col>
              <b-col>{{ row.item.description.moniker }}</b-col>
            </b-row>
            <b-row class="mb-2">
              <b-col sm="3" class="text-sm-right"><b>Operator Address:</b></b-col>
              <b-col>{{ row.item.validator_address }}</b-col>
            </b-row>
            <b-row class="mb-2">
              <b-col sm="3" class="text-sm-right"><b>Identity:</b></b-col>
              <b-col>{{ row.item.description.identity }}</b-col>
            </b-row>
            <b-row class="mb-2">
              <b-col sm="3" class="text-sm-right"><b>Website:</b></b-col>
              <b-col>{{ row.item.description.website }}</b-col>
            </b-row>
            <b-row class="mb-2">
              <b-col sm="3" class="text-sm-right"><b>Security Contact:</b></b-col>
              <b-col>{{ row.item.description.security_contact }}</b-col>
            </b-row>
            <b-row class="mb-2">
              <b-col sm="3" class="text-sm-right"><b>Details:</b></b-col>
              <b-col>{{ row.item.description.details }}</b-col>
            </b-row>
            <b-button variant="warning" size="sm" @click="initUndelegate(row.item)" class="mr-2">
              Undelegate
            </b-button>

            <b-button variant="info" size="sm" @click="initRedelegate(row.item)" class="mr-2">
              Redelegate
            </b-button>
            <b-button v-show="row.item.rewards > 0" variant="success" size="sm" @click="showConfirmWithdraw(row.item)" class="mr-2">
              Withdraw Rewards
            </b-button>
            <b-button size="sm" @click="row.toggleDetails">
              Hide Details
            </b-button>
          </b-card>
        </template>
        <template v-slot:cell(shares)="data">
          <b class="text-info">{{ Number(data.value) }}</b>
        </template>
        <template v-slot:cell(delegated)="data">
          <b class="text-info">{{ formatAmount(data.value)}}</b>
        </template>
        <template v-slot:cell(rewards)="data">
          <b class="text-info">{{ formatAmount(data.value)}}</b>
        </template>

      </b-table>
    </div>
  </div>
</template>

<script>
  import {UND_CONFIG} from '@/constants.js'
  import { mapState, mapGetters } from 'vuex'
  const UndClient = require('@unification-com/und-js')

  export default {
    name: "StakingDelegations",
    computed: {
      ...mapState({
        client: state => state.client.client,
        chainId: state => state.client.chainId,
        isClientConnected: state => state.client.isConnected,
        wallet: state => state.wallet,
        txs: state => state.txs,
        validators: state => state.validators,
        delegations: state => state.delegations
      }),
      ...mapGetters('validators', [
        'getValidatorDescription',
        'getValidatorMoniker',
      ]),
      unDelegateAmountState() {
        return this.isValidAmount(this.undelegateData.und)
      },
      unDelegateFormState() {
        return (this.unDelegateAmountState && this.gasState && this.feeState)
      },
      reDelegateAmountState() {
        return this.isValidAmount(this.redelegateData.und)
      },
      reDelegateFormState() {
        return (this.reDelegateAmountState && this.gasState && this.feeState)
      },
      withdrawFormState() {
        return (this.gasState && this.feeState)
      },
      gasState() {
        return this.isValidGas(this.fee.gas)
      },
      feeState() {
        return this.isValidFee(this.fee)
      }
    },
    data: function () {
      return {
        activeItem: 'delegations',
        undelegateData: {
          address: '',
          und: '0',
          max: '',
          memo: UND_CONFIG.DEFAULT_MEMO
        },
        redelegateData: {
          src: '',
          dst: '',
          und: '0',
          max: '',
          memo: UND_CONFIG.DEFAULT_MEMO
        },
        withdrawData: {
          address: '',
          und: '0'
        },
        fee: UND_CONFIG.DEFULT_DELEGATE_FEE,
        delegationsFields: ['name', 'shares', 'delegated', 'rewards', 'show_details'],
        isDataLoading: false,
        isShowFee: false,
      }
    },
    methods: {
      // Todo - display and modify withdraw address
      preventSubmit: function () {
        return false
      },
      checkFeesAndGas: function () {
        if (!this.isValidFee(this.fee)) {
          this.showToast('danger', 'Error', 'invalid fees')
          return false
        }
        if (!this.isValidGas(this.fee.gas)) {
          this.showToast('danger', 'Error', 'invalid gas amount')
          return false
        }
        return true
      },
      showConfirmUnDelegation: function () {
        if (!this.isValidAmount(this.undelegateData.und)) {
          this.showToast('danger', 'Error', 'invalid amount')
          return false
        }
        if (this.wallet.balance === 0) {
          this.showToast('danger', 'Error', 'cannot send a transaction with zero available balance')
          return false
        }
        if (!this.wallet.accountExists) {
          this.showToast('danger', 'Error', 'account does not exists on chain yet')
          return false
        }
        if (this.undelegateData.und <= 0 || isNaN(this.undelegateData.und) || this.undelegateData.und > this.undelegateData.max) {
          this.showToast('danger', 'Error', 'Amount must be greater than zero, and less than ' + this.undelegateData.max + 'UND')
          return false
        }
        if (!UndClient.crypto.checkAddress(this.undelegateData.address, UND_CONFIG.BECH32_VAL_PREFIX)) {
          this.showToast('danger', 'Error', '"' + this.undelegateData.address + '" is not a valid operator address')
          return false
        }
        if (this.undelegateData.memo.length > 100) {
          this.showToast('danger', 'Error', 'memo too long > 100 characters')
          return false
        }
        if (!this.checkFeesAndGas()) {
          return false
        }
        this.$bvModal.hide('bv-modal-undelegate-und')
        this.$bvModal.show('bv-modal-confirm-undelegate-und')
      },
      showConfirmReDelegation: function () {

        if (!this.isValidAmount(this.redelegateData.und)) {
          this.showToast('danger', 'Error', 'invalid amount')
          return false
        }
        if (this.wallet.balance === 0) {
          this.showToast('danger', 'Error', 'cannot send a transaction with zero available balance')
          return false
        }
        if (!this.wallet.accountExists) {
          this.showToast('danger', 'Error', 'account does not exists on chain yet')
          return false
        }
        if (this.redelegateData.und <= 0 || isNaN(this.redelegateData.und) || this.redelegateData.und > this.redelegateData.max) {
          this.showToast('danger', 'Error', 'Amount must be greater than zero, and less than ' + this.redelegateData.max + 'UND')
          return false
        }
        if (!UndClient.crypto.checkAddress(this.redelegateData.dst, UND_CONFIG.BECH32_VAL_PREFIX)) {
          this.showToast('danger', 'Error', '"' + this.redelegateData.dst + '" is not a valid operator address')
          return false
        }
        if (!UndClient.crypto.checkAddress(this.redelegateData.src, UND_CONFIG.BECH32_VAL_PREFIX)) {
          this.showToast('danger', 'Error', '"' + this.redelegateData.src + '" is not a valid operator address')
          return false
        }
        if (this.redelegateData.src === this.redelegateData.dst) {
          this.showToast('danger', 'Error', 'cannot redelegate to same address')
          return false
        }
        if (this.redelegateData.memo.length > 100) {
          this.showToast('danger', 'Error', 'memo too long > 100 characters')
          return false
        }
        if (!this.checkFeesAndGas()) {
          return false
        }
        this.$bvModal.hide('bv-modal-redelegate-und')
        this.$bvModal.show('bv-modal-confirm-redelegate-und')
      },
      showConfirmWithdraw: function (item) {
        this.clearWithdrawData()
        this.withdrawData.address = item.validator_address
        this.withdrawData.und = this.nundToUnd(item.rewards)
        if (this.wallet.balance === 0) {
          this.showToast('danger', 'Error', 'cannot send a transaction with zero available balance')
          return false
        }
        if (!this.wallet.accountExists) {
          this.showToast('danger', 'Error', 'account does not exists on chain yet')
          return false
        }
        this.$bvModal.show('bv-modal-confirm-withdraw-rewards')
      },
      clearUnDelegateData: function () {
        this.undelegateData = null
        this.fee = null
        this.undelegateData = {
          address: '',
          und: '0',
          max: '',
          memo: UND_CONFIG.DEFAULT_MEMO
        }
        this.fee = UND_CONFIG.DEFAULT_UNDELEGATE_FEE
        this.isShowFee = false
      },
      clearReDelegateData: function () {
        this.redelegateData = null
        this.fee = null
        this.redelegateData = {
          src: '',
          dst: '',
          und: '0',
          max: '',
          memo: UND_CONFIG.DEFAULT_MEMO
        }
        this.fee = UND_CONFIG.DEFAULT_REDELEGATE_FEE
        this.isShowFee = false
      },
      clearWithdrawData: function () {
        this.withdrawData = null
        this.fee = null
        this.withdrawData = {
          address: '',
          und: '0'
        }
        this.fee = UND_CONFIG.DEFAULT_WITHDRAW_REWARDS_FEE
        this.isShowFee = false
      },
      initUndelegate: function (item) {
        this.clearUnDelegateData()
        this.undelegateData.address = item.validator_address
        this.undelegateData.max = this.nundToUnd(item.delegated)
        this.$bvModal.show('bv-modal-undelegate-und')
      },
      initRedelegate: function(item) {
        this.clearReDelegateData()
        this.redelegateData.src = item.validator_address
        this.redelegateData.max = this.nundToUnd(item.delegated)
        this.$bvModal.show('bv-modal-redelegate-und')
      },
      getDelegations: async function () {
        if (this.isClientConnected && this.wallet.isWalletUnlocked) {
          this.isDataLoading = true
          let res = await this.client.getDelegations()
          if (res.status === 200) {
            for (let i = 0; i < res.result.result.length; i++) {
              let validator_address = res.result.result[i].validator_address
              let description = this.getValidatorDescription(validator_address)
              let rewards = await this.getDelegatorRewards(validator_address)

              let del = {
                name: description['moniker'],
                validator_address: validator_address,
                shares: res.result.result[i].shares,
                delegated: res.result.result[i].balance.amount,
                rewards: rewards,
                description: description
              }
              await this.$store.dispatch('delegations/addEditDelegation', del)
            }
          }
          this.isDataLoading = false
        }
      },
      getDelegatorRewards: async function (valAddress) {
        let rewards = '0'
        if (this.isClientConnected && this.wallet.isWalletUnlocked) {
          let res = await this.client.getDelegatorRewards(this.wallet.address, valAddress)
          if (res.status === 200 && res.result.result.length > 0) {
            rewards = res.result.result[0].amount
          }
        }
        return rewards
      },
      confirmUndelegation: function () {
        this.confirmUndelegationAsync()
      },
      confirmUndelegationAsync: async function () {
        if (this.isClientConnected && this.wallet.isWalletUnlocked) {

          try {
            let res = await this.client.undelegate(
            this.undelegateData.address,
            this.undelegateData.und,
            this.fee,
            "und",
            this.wallet.address,
            this.undelegateData.memo
            )

            if (res.status === 200) {
              this.showToast('success', 'Success', 'Tx hash: ' + res.result.txhash)
              await this.$store.dispatch('txs/addTx', {
                txhash: res.result.txhash,
                timestamp: null,
                isSent: true})
            }

          } catch (err) {
            this.showToast('danger', 'Error', err.toString())
          }
        } else {
          this.clientError()
        }
        this.clearUnDelegateData()
        this.$bvModal.hide('bv-modal-confirm-undelegate-und')
      },
      confirmRedelegation: function() {
        this.confirmRedelegationAsync()
      },
      confirmRedelegationAsync: async function() {
        if (this.isClientConnected && this.wallet.isWalletUnlocked) {

          try {
            let res = await this.client.redelegate(
            this.redelegateData.src,
            this.redelegateData.dst,
            this.redelegateData.und,
            this.fee,
            "und",
            this.wallet.address,
            this.redelegateData.memo
            )

            if (res.status === 200) {
              this.showToast('success', 'Success', 'Tx hash: ' + res.result.txhash)
              await this.$store.dispatch('txs/addTx',{
                txhash: res.result.txhash,
                timestamp: null,
                isSent: true})
            }

          } catch (err) {
            this.showToast('danger', 'Error', err.toString())
          }
        } else {
          this.clientError()
        }
        this.clearReDelegateData()
        this.$bvModal.hide('bv-modal-confirm-redelegate-und')
      },
      confirmWithdrawReward: function () {
        this.confirmWithdrawRewardAsync()
      },
      confirmWithdrawRewardAsync: async function () {
        if (this.isClientConnected && this.wallet.isWalletUnlocked) {
          try {
            let res = await this.client.withdrawDelegationReward(
            this.withdrawData.address,
            this.fee,
            this.wallet.address,
            this.undelegateData.memo
            )

            if (res.status === 200) {
              this.showToast('success', 'Success', 'Tx hash: ' + res.result.txhash)
              await this.$store.dispatch('txs/addTx', {
                txhash: res.result.txhash,
                timestamp: null,
                isSent: true})
            }

          } catch (err) {
            this.showToast('danger', 'Error', err.toString())
          }
        } else {
          this.clientError()
        }
        this.$bvModal.hide('bv-modal-confirm-withdraw-rewards')
      }
    }
  }
</script>
