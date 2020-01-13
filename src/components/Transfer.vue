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
        />
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
        />
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
        />
      </b-form-group>

      <b-form-checkbox
      id="transfer-show-fee"
      v-model="isShowFee"
      name="transfer-show-fee"
      >
        Manually set Fees
      </b-form-checkbox>

      <b-button variant="success" @click="showConfirmTransferUnd()">Transfer</b-button>
    </b-form>

  </div>
</template>

<script>
  import {UND_CONFIG} from '@/constants.js'
  const UndClient = require('@unification-com/und-js')

  export default {
    name: "Transfer",
    props: {
      client: Object,
      wallet: Object
    },
    data: function () {
      return {
        clnt: this.client,
        w: this.wallet,
        transfer: {
          to: '',
          und: '0',
          memo: UND_CONFIG.DEFAULT_MEMO
        },
        defaultFee: {
          amount: [
            {
              denom: "nund",
              amount: "5000"
            }
          ],
          gas: "190000"
        },
        fee: {
          amount: [
            {
              denom: "nund",
              amount: "2500"
            }
          ],
          gas: "70000"
        },
        isShowFee: false,
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
      preventSubmit: function() {
        return false
      },
      clearTransfer: function () {
        this.transfer = {
          to: '',
          und: '0',
          memo: UND_CONFIG.DEFAULT_MEMO
        }
        this.fee = this.defaultFee
      },
      showConfirmTransferUnd: function() {

        if(!UndClient.crypto.checkAddress(this.transfer.to, UND_CONFIG.BECH32_PREFIX)) {
          this.showToast('danger', '"' + this.transfer.to + '" is not a valid address')
          return false
        }
        if(this.transfer.und <= 0 || isNaN(this.transfer.und)) {
          this.showToast('danger', 'Amount must be greater than zero')
          return false
        }
        this.$bvModal.show('bv-modal-transfer-und')
      },
      transferUnd: function() {
        this.transferUndAsync()
      },
      transferUndAsync: async function() {
        if (this.clnt !== null && this.w.isWalletUnlocked > 0) {
          try {
            let res = await this.clnt.transferUnd(
            this.transfer.to,
            this.transfer.und,
            this.fee,
            "und",
            this.w.address,
            this.transfer.memo
            )

            if (res.status === 200) {
              this.showToast('success', 'Tx hash: ' + res.result.txhash)
            }

            this.$bvModal.hide('bv-modal-transfer-und')
            this.clearTransfer()
          } catch (err) {
            this.showToast('danger', err.toString())
          }
        } else {
          this.showToast('danger', 'Client not connected or wallet not unlocked. Please reload')
        }
      }
    }
  }
</script>
