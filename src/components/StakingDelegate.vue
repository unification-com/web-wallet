<template>
  <div>
    <!-- delegate UND confirmation modal -->
    <b-modal id="bv-modal-confirm-delegate-und">
      <template v-slot:modal-title>
        <h3>Confirm Delegate UND</h3>
      </template>
      <p>Please confirm delegation:</p>
      Amount: <span class="text-info">{{delegateData.und}} UND</span><br>
      Validator: {{getValidatorMoniker(delegateData.address)}}<br>
      Fee: {{fee.amount[0].amount}}nund<br>
      Gas: {{fee.gas}}
      <template v-slot:modal-footer>
        <b-button
        variant="success"
        @click="confirmDelegation"
        aria-label="Confirm"
        >
          Confirm
        </b-button>
        <b-button
        @click="$bvModal.hide('bv-modal-confirm-delegate-und')"
        aria-label="Cancel"
        >
          Cancel
        </b-button>
      </template>
    </b-modal>

    <!-- delegate form -->
    <h3>Delegate UND</h3>

    <div v-show="isDataLoading">
      <b-spinner style="width: 3rem; height: 3rem;" label="Large Spinner"/>
    </div>

    <div v-show="!isDataLoading">
      <b-form @submit.prevent="preventSubmit">
        <b-form-group
        id="delegate-node-label"
        label="Select Existing Validator:"
        label-for="delegate-node"
        description="Select an existing validator"
        >
          <b-form-select id="delegate-node" v-model="delegateData.address" :options="validators.validatorsSelect"/>
        </b-form-group>
        <b-form-group
        id="delegate-manual-node-label"
        label="Or Manually Enter Validator:"
        label-for="delegate-manual-node"
        description="Alternatively, enter a validator's operator address manually (note - this starts with undvaloper)"
        >
          <b-form-input
          id="delegate-manual-node"
          v-model="delegateData.address"
          type="text"
          required
          v-on:keydown.enter.prevent="preventSubmit"
          />
        </b-form-group>

        <b-form-group
        id="delegate-und-label"
        label="Amount:"
        label-for="delegate-und"
        description="Amount of UND to delegate"
        >
          <b-input-group append="UND">
            <b-form-input
            id="delegate-und"
            v-model="delegateData.und"
            type="number"
            required
            placeholder=""
            v-on:keydown.enter.prevent="preventSubmit"
            :state="delegateAmountState"
            aria-describedby="input-live-feedback-delegate-amount"
            />
            <b-form-invalid-feedback id="input-live-feedback-delegate-amount">
              Invalid amount
            </b-form-invalid-feedback>
          </b-input-group>
        </b-form-group>
        <b-form-group
        id="delegate-memo-label"
        label="Memo:"
        label-for="delegate-memo"
        description="Optional Memo"
        >
          <b-form-input
          id="delegate-memo"
          v-model="delegateData.memo"
          type="text"
          trim
          v-on:keydown.enter.prevent="preventSubmit"
          />
        </b-form-group>

        <b-form-group
        id="delegate-fee-amount-label"
        label="Fee:"
        label-for="delegate-fee-amount"
        description="Fees in nund"
        v-show="isShowFee"
        >
          <b-input-group append="nund">
            <b-form-input
            id="delegate-fee-amount"
            v-model="fee.amount[0].amount"
            type="number"
            trim
            v-on:keydown.enter.prevent="preventSubmit"
            aria-describedby="input-live-feedback-delegate-fees"
            :state="feeState"
            />
            <b-form-invalid-feedback id="input-live-feedback-delegate-fees">
              Invalid fees
            </b-form-invalid-feedback>
          </b-input-group>
        </b-form-group>
        <b-form-group
        id="delegate-fee-gas-label"
        label="Gas:"
        label-for="delegate-fee-gas"
        description="Gas"
        v-show="isShowFee"
        >
          <b-form-input
          id="delegate-fee-gas"
          v-model="fee.gas"
          type="number"
          trim
          v-on:keydown.enter.prevent="preventSubmit"
          aria-describedby="input-live-feedback-delegate-gas"
          :state="gasState"
          />
          <b-form-invalid-feedback id="input-live-feedback-delegate-gas">
            Invalid gas
          </b-form-invalid-feedback>
        </b-form-group>

        <b-form-checkbox
        id="delegate-show-fee"
        v-model="isShowFee"
        name="delegate-show-fee"
        >
          Manually set Fees
        </b-form-checkbox>

        <b-button variant="success" @click="showConfirmDelegate()" :disabled="!delegateFormState">Delegate UND</b-button>
      </b-form>
      <br>
      <b>Note:</b> outstanding rewards will automatically be withdrawn during delegation
    </div>
  </div>
</template>

<script>
  import {UND_CONFIG} from '@/constants.js'
  import { mapState, mapGetters } from 'vuex'

  const UndClient = require('@unification-com/und-js')

  export default {
    name: "StakingDelegate",
    computed: {
      ...mapState({
        client: state => state.client.client,
        chainId: state => state.client.chainId,
        isClientConnected: state => state.client.isConnected,
        wallet: state => state.wallet,
        txs: state => state.txs,
        validators: state => state.validators,
      }),
      ...mapGetters('validators', [
        'getValidatorMoniker',
      ]),
      delegateAmountState() {
        return this.isValidAmount(this.delegateData.und)
      },
      delegateFormState() {
        return (this.delegateAmountState && this.gasState && this.feeState)
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
        delegateData: {
          address: '',
          und: '0',
          memo: UND_CONFIG.DEFAULT_MEMO
        },
        fee: UND_CONFIG.DEFULT_DELEGATE_FEE,
        isDataLoading: false,
        isShowFee: false,
      }
    },
    methods: {
      preventSubmit: function () {
        return false
      },
      checkFeesAndGas: function() {
        if(!this.isValidFee(this.fee)) {
          this.showToast('danger', 'Error', 'invalid fees')
          return false
        }
        if(!this.isValidGas(this.fee.gas)) {
          this.showToast('danger', 'Error', 'invalid gas amount')
          return false
        }
        return true
      },
      showConfirmDelegate: function () {
        if (this.delegateData.und <= 0 || isNaN(this.delegateData.und)) {
          this.showToast('danger', 'Error', 'Amount must be greater than zero')
          return false
        }
        if(!this.isValidAmount(this.delegateData.und)) {
          this.showToast('danger', 'Error', 'invalid amount')
          return false
        }
        if(this.wallet.balance === 0) {
          this.showToast('danger', 'Error', 'cannot send a transaction with zero available balance')
          return false
        }
        if(!this.wallet.accountExists) {
          this.showToast('danger', 'Error', 'account does not exists on chain yet')
          return false
        }
        if (this.delegateData.und >= this.wallet.balance) {
          this.showToast('danger', 'Error', 'cannot delegate more than your balance')
          return false
        }
        if (!UndClient.crypto.checkAddress(this.delegateData.address, UND_CONFIG.BECH32_VAL_PREFIX)) {
          this.showToast('danger', 'Error', '"' + this.delegateData.address + '" is not a valid operator address')
          return false
        }
        if(this.delegateData.memo.length > 100) {
          this.showToast('danger', 'Error', 'memo too long > 100 characters')
          return false
        }
        if(!this.checkFeesAndGas()) {
          return false
        }
        this.$bvModal.show('bv-modal-confirm-delegate-und')
      },
      clearDelegateData: function () {
        this.delegateData = null
        this.fee = null
        this.delegateData = {
          address: '',
          und: '0',
          memo: UND_CONFIG.DEFAULT_MEMO
        }
        this.fee = UND_CONFIG.DEFULT_DELEGATE_FEE
        this.isShowFee = false
      },
      confirmDelegation: function () {
        this.confirmDelegationAsync()
      },
      confirmDelegationAsync: async function () {
        if (this.isClientConnected && this.wallet.isWalletUnlocked) {
          try {
            let res = await this.client.delegate(
            this.delegateData.address,
            this.delegateData.und,
            this.fee,
            "und",
            this.wallet.address,
            this.delegateData.memo
            )

            if (res.status === 200) {
              this.showToast('success', 'Success', 'Tx hash: ' + res.result.txhash)
              await this.$store.dispatch('txs/addTxHash', res.result.txhash)
            }

          } catch (err) {
            this.showToast('danger', 'Error', err.toString())
          }
        } else {
          this.clientError()
        }
        this.clearDelegateData()
        this.$bvModal.hide('bv-modal-confirm-delegate-und')
      },
    }
  }
</script>
