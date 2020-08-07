<template>
  <div>
    <b-modal id="bv-modal-transfer-und">
      <template v-slot:modal-title>
        <h3>Confirm FUND Transfer</h3>
      </template>

      <div v-show="!confirmOnLedger">
        <p>Please confirm:</p>
        Sending {{ transfer.und }} FUND<br />
        To {{ transfer.to }}<br />
        Fee: {{ fee.amount[0].amount }}nund<br />
        Gas: {{ fee.gas }}<br />

        <span v-show="showWarning">
          <p>
            <strong>
              Warning: this will leave you with a balance of {{ balanceDiff }}nund. It is recommended you
              leave at least {{ recommendedBalance }}nund to pay for future Tx fees.
            </strong>
          </p>
        </span>
      </div>
      <LedgerConfirm v-show="confirmOnLedger" />

      <template v-slot:modal-footer>
        <b-button v-show="!confirmOnLedger" variant="success" aria-label="Create" @click="transferUnd">
          Confirm
        </b-button>
        <b-button aria-label="Cancel" @click="clearTransfer, $bvModal.hide('bv-modal-transfer-und')">
          Cancel
        </b-button>
      </template>
    </b-modal>

    <h3>Transfer FUND</h3>

    <b-form @submit.prevent="preventSubmit">
      <b-form-group
        id="transfer-send-und-label"
        label="Send:"
        label-for="transfer-send-und"
        description="Amount of FUND to send"
        append="FUND"
      >
        <b-input-group append="FUND">
          <b-form-input
            id="transfer-send-und"
            v-model="transfer.und"
            type="number"
            required
            :state="amountState"
            aria-describedby="input-live-feedback-amount"
            @keydown.enter.prevent="preventSubmit"
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
          @keydown.enter.prevent="preventSubmit"
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
          @keydown.enter.prevent="preventSubmit"
        />
      </b-form-group>

      <b-form-group
        v-show="isShowFee"
        id="transfer-fee-amount-label"
        label="Fee:"
        label-for="transfer-fee-amount"
        description="Fees in nund"
      >
        <b-input-group append="nund">
          <b-form-input
            id="transfer-fee-amount"
            v-model="fee.amount[0].amount"
            type="number"
            trim
            aria-describedby="input-live-feedback-fees"
            :state="feeState"
            @keydown.enter.prevent="preventSubmit"
          />
          <b-form-invalid-feedback id="input-live-feedback-fees">
            Invalid fees
          </b-form-invalid-feedback>
        </b-input-group>
      </b-form-group>
      <b-form-group
        v-show="isShowFee"
        id="transfer-fee-gas-label"
        label="Gas:"
        label-for="transfer-fee-gas"
        description="Gas"
      >
        <b-form-input
          id="transfer-fee-gas"
          v-model="fee.gas"
          type="number"
          trim
          aria-describedby="input-live-feedback-gas"
          :state="gasState"
          @keydown.enter.prevent="preventSubmit"
        />
        <b-form-invalid-feedback id="input-live-feedback-gas">
          Invalid gas
        </b-form-invalid-feedback>
      </b-form-group>

      <b-form-checkbox id="transfer-show-fee" v-model="isShowFee" name="transfer-show-fee">
        Manually set Fees
      </b-form-checkbox>

      <b-button variant="success" :disabled="!formState" @click="showConfirmTransferUnd()">
        Transfer
      </b-button>
    </b-form>
  </div>
</template>

<script>
import { mapState } from "vuex"
import { UND_CONFIG } from "../constants"
import LedgerConfirm from "./LedgerConfirm.vue"

const UndClient = require("@unification-com/und-js")

export default {
  name: "Transfer",
  components: {
    LedgerConfirm,
  },
  data() {
    return {
      transfer: {
        to: "",
        und: "0",
        memo: UND_CONFIG.DEFAULT_MEMO,
      },
      fee: UND_CONFIG.DEFAULT_TRANSFER_FEES,
      isShowFee: false,
      showWarning: false,
      balanceDiff: "0",
      recommendedBalance: UND_CONFIG.RECOMMENDED_MIN_BALANCE,
      confirmOnLedger: false,
    }
  },
  computed: {
    ...mapState({
      client: state => state.client.client,
      chainId: state => state.client.chainId,
      isClientConnected: state => state.client.isConnected,
      wallet: state => state.wallet,
      txs: state => state.txs,
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
      return this.amountState && this.gasState && this.feeState
    },
  },
  methods: {
    preventSubmit() {
      return false
    },
    clearTransfer() {
      this.transfer = null
      this.fee = null
      this.transfer = {
        to: "",
        und: "0",
        memo: UND_CONFIG.DEFAULT_MEMO,
      }
      this.fee = UND_CONFIG.DEFAULT_TRANSFER_FEES
      this.isShowFee = false
      this.showWarning = false
      this.balanceDiff = "0"
      this.confirmOnLedger = false
    },
    showConfirmTransferUnd() {
      if (!UndClient.crypto.checkAddress(this.transfer.to, UND_CONFIG.BECH32_PREFIX)) {
        this.showToast("error", "Error", `"${this.transfer.to}" is not a valid address`)
        return false
      }
      if (this.transfer.und <= 0 || Number.isNaN(this.transfer.und)) {
        this.showToast("error", "Error", "Amount must be greater than zero")
        return false
      }
      if (!this.isValidAmount(this.transfer.und)) {
        this.showToast("error", "Error", "invalid amount")
        return false
      }
      if (this.wallet.balance === 0) {
        this.showToast("error", "Error", "cannot send a transaction with zero available balance")
        return false
      }
      if (this.transfer.und > this.wallet.balance) {
        this.showToast("error", "Error", "cannot transfer more than wallet balance")
        return false
      }

      if (this.transfer.und >= this.wallet.balance) {
        this.showToast(
          "danger",
          "Error",
          "cannot transfer full balance - there will not be enough to pay for Tx fees.",
        )
        return false
      }

      const isValidAmtFees = this.isValidAmountPlusFees(
        this.wallet.balance,
        this.transfer.und,
        this.fee.amount[0].amount,
      )
      if (!isValidAmtFees.isValid) {
        this.showToast(
          "error",
          "Error",
          `not enough balance to pay for transfer + tx fees. Got ${isValidAmtFees.gotUnd} FUND, need ${isValidAmtFees.requiredUnd} FUND`,
        )
        return false
      }
      this.showWarning = isValidAmtFees.warn
      this.balanceDiff = isValidAmtFees.diff

      if (!this.wallet.accountExists) {
        this.showToast("error", "Error", "account does not exists on chain yet")
        return false
      }
      if (!this.isValidFee(this.fee)) {
        this.showToast("error", "Error", "invalid fees")
        return false
      }
      if (!this.isValidGas(this.fee.gas)) {
        this.showToast("error", "Error", "invalid gas amount")
        return false
      }
      if (this.transfer.memo.length > 100) {
        this.showToast("error", "Error", "memo too long > 100 characters")
        return false
      }
      this.$bvModal.show("bv-modal-transfer-und")
      return true
    },
    transferUnd() {
      const isValidAmtFees = this.isValidAmountPlusFees(
        this.wallet.balance,
        this.transfer.und,
        this.fee.amount[0].amount,
      )
      if (!isValidAmtFees.isValid) {
        this.showToast(
          "error",
          "Error",
          `not enough balance to pay for transfer + tx fees. Got ${isValidAmtFees.gotUnd} FUND, need ${isValidAmtFees.requiredUnd} FUND`,
        )
        return false
      }
      this.transferUndAsync()
      return true
    },
    async transferUndAsync() {
      if (this.isClientConnected && this.wallet.isWalletUnlocked > 0) {
        if (this.client.isLedgerMode) {
          this.confirmOnLedger = true
        }
        try {
          const res = await this.client.transferUnd(
            this.transfer.to,
            this.transfer.und,
            this.fee,
            "fund",
            this.wallet.address,
            this.transfer.memo,
          )

          if (res.status === 200) {
            this.showToast(
              "success",
              "FUND Transferred Successfully",
              `Transaction hash: <a href="${this.explorerUrl(this.chainId)}/transactions/${
                res.result.txhash
              }" target="_blank">${res.result.txhash}</a>`,
            )
            await this.$store.dispatch("txs/addTx", {
              txhash: res.result.txhash,
              timestamp: null,
              isSent: true,
            })
          }

          this.$bvModal.hide("bv-modal-transfer-und")
          this.clearTransfer()
        } catch (err) {
          this.showToast("error", "Error", err.toString())
          this.$bvModal.hide("bv-modal-transfer-und")
          this.clearTransfer()
        }
      } else {
        this.clientError()
      }

      this.confirmOnLedger = false
    },
  },
}
</script>
