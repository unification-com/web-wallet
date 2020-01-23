<template>
  <div>
    <b-modal id="bv-modal-transfer-und">
      <template v-slot:modal-title>
        <h3>Confirm UND Transfer</h3>
      </template>
      <p>Please confirm:</p>
      Sending {{transfer.und}} UND<br>
      To {{transfer.to}}<br>
      Fee: {{fee.amount[0].amount}}nund<br>
      Gas: {{fee.gas}}
      <template v-slot:modal-footer>
        <b-button
        variant="success"
        @click="transferUnd"
        aria-label="Create"
        >
          Confirm
        </b-button>
        <b-button
        @click="$bvModal.hide('bv-modal-transfer-und')"
        aria-label="Cancel"
        >
          Cancel
        </b-button>
      </template>
    </b-modal>

    <h3>Transfer UND</h3>

    <b-form @submit.prevent="preventSubmit">
      <b-form-group
      id="transfer-send-und-label"
      label="Send:"
      label-for="transfer-send-und"
      description="Amount of UND to send"
      append="UND"
      >
        <b-input-group append="UND">
        <b-form-input
        id="transfer-send-und"
        v-model="transfer.und"
        type="number"
        required
        v-on:keydown.enter.prevent="preventSubmit"
        :state="amountState"
        aria-describedby="input-live-feedback-amount"
        />
          <b-form-invalid-feedback id="input-live-feedback-amount">
            Invalid amount
          </b-form-invalid-feedback>
        </b-input-group>
      </b-form-group>

      <b-form-group
      id="transfer-send-to-label"
      label="To:"
      label-for="transfer-send-to"
      description="Address to send to"
      >
        <b-form-input
        id="transfer-send-to"
        v-model="transfer.to"
        type="text"
        required
        placeholder=""
        trim
        v-on:keydown.enter.prevent="preventSubmit"
        />
      </b-form-group>

      <b-form-group
      id="transfer-send-memo-label"
      label="Memo:"
      label-for="transfer-send-memo"
      description="Optional Memo"
      >
        <b-form-input
        id="transfer-send-memo"
        v-model="transfer.memo"
        type="text"
        trim
        v-on:keydown.enter.prevent="preventSubmit"
        />
      </b-form-group>

      <b-form-group
      id="transfer-fee-amount-label"
      label="Fee:"
      label-for="transfer-fee-amount"
      description="Fees in nund"
      v-show="isShowFee"
      >
        <b-input-group append="nund">
        <b-form-input
        id="transfer-fee-amount"
        v-model="fee.amount[0].amount"
        type="number"
        trim
        v-on:keydown.enter.prevent="preventSubmit"
        aria-describedby="input-live-feedback-fees"
        :state="feeState"
        />
          <b-form-invalid-feedback id="input-live-feedback-fees">
            Invalid fees
          </b-form-invalid-feedback>
        </b-input-group>
      </b-form-group>
      <b-form-group
      id="transfer-fee-gas-label"
      label="Gas:"
      label-for="transfer-fee-gas"
      description="Gas"
      v-show="isShowFee"
      >
        <b-form-input
        id="transfer-fee-gas"
        v-model="fee.gas"
        type="number"
        trim
        v-on:keydown.enter.prevent="preventSubmit"
        aria-describedby="input-live-feedback-gas"
        :state="gasState"
        />
        <b-form-invalid-feedback id="input-live-feedback-gas">
          Invalid gas
        </b-form-invalid-feedback>
      </b-form-group>

      <b-form-checkbox
      id="transfer-show-fee"
      v-model="isShowFee"
      name="transfer-show-fee"
      >
        Manually set Fees
      </b-form-checkbox>

      <b-button variant="success" @click="showConfirmTransferUnd()" :disabled="!formState">Transfer</b-button>
    </b-form>

  </div>
</template>

<script>
  import {UND_CONFIG} from '@/constants.js'
  import { mapState } from 'vuex'
  const UndClient = require('@unification-com/und-js')

  export default {
    name: "Transfer",
    computed: {
      ...mapState({
        client: state => state.client.client,
        chainId: state => state.client.chainId,
        isClientConnected: state => state.client.isConnected,
        wallet: state => state.wallet,
        txs: state => state.txs
      }),
      amountState() {
        return this.isValidAmount(this.transfer.und)
      },
      gasState() {
        return this.isValidGas(this.fee.gas)
      },
      feeState() {
        return this.isValidFee(this.fee)
      },
      formState() {
        return (this.amountState && this.gasState && this.feeState)
      }
    },
    data: function () {
      return {
        transfer: {
          to: '',
          und: '0',
          memo: UND_CONFIG.DEFAULT_MEMO
        },
        fee: UND_CONFIG.DEFAULT_TRANSFER_FEES,
        isShowFee: false,
      }
    },
    methods: {
      preventSubmit: function() {
        return false
      },
      clearTransfer: function () {
        this.transfer = null
        this.fee = null
        this.transfer = {
          to: '',
          und: '0',
          memo: UND_CONFIG.DEFAULT_MEMO
        }
        this.fee = UND_CONFIG.DEFAULT_TRANSFER_FEES
        this.isShowFee = false
      },
      showConfirmTransferUnd: function() {

        if(!UndClient.crypto.checkAddress(this.transfer.to, UND_CONFIG.BECH32_PREFIX)) {
          this.showToast('danger', 'Error', '"' + this.transfer.to + '" is not a valid address')
          return false
        }
        if(this.transfer.und <= 0 || isNaN(this.transfer.und)) {
          this.showToast('danger', 'Error', 'Amount must be greater than zero')
          return false
        }
        if(!this.isValidAmount(this.transfer.und)) {
          this.showToast('danger', 'Error', 'invalid amount')
          return false
        }
        if(this.wallet.balance === 0) {
          this.showToast('danger', 'Error', 'cannot send a transaction with zero available balance')
          return false
        }
        if(this.transfer.und > this.wallet.balance) {
          this.showToast('danger', 'Error', 'cannot transfer more than balance')
          return false
        }
        if(!this.wallet.accountExists) {
          this.showToast('danger', 'Error', 'account does not exists on chain yet')
          return false
        }
        if(!this.isValidFee(this.fee)) {
          this.showToast('danger', 'Error', 'invalid fees')
          return false
        }
        if(!this.isValidGas(this.fee.gas)) {
          this.showToast('danger', 'Error', 'invalid gas amount')
          return false
        }
        if(this.transfer.memo.length > 100) {
          this.showToast('danger', 'Error', 'memo too long > 100 characters')
          return false
        }
        this.$bvModal.show('bv-modal-transfer-und')
      },
      transferUnd: function() {
        this.transferUndAsync()
      },
      transferUndAsync: async function() {
        if (this.isClientConnected && this.wallet.isWalletUnlocked > 0) {
          try {
            let res = await this.client.transferUnd(
            this.transfer.to,
            this.transfer.und,
            this.fee,
            "und",
            this.wallet.address,
            this.transfer.memo
            )

            if (res.status === 200) {
              this.showToast('success', 'Success', 'Tx hash: ' + res.result.txhash)
              await this.$store.dispatch('txs/addTxHash', res.result.txhash)
            }

            this.$bvModal.hide('bv-modal-transfer-und')
            this.clearTransfer()
          } catch (err) {
            this.showToast('danger', 'Error', err.toString())
          }
        } else {
          this.clientError()
        }
      }
    }
  }
</script>
