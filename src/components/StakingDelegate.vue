<template>
  <div>
    <!-- delegate FUND confirmation modal -->
    <b-modal id="bv-modal-confirm-delegate-und">
      <template v-slot:modal-title>
        <h3>Confirm Delegate FUND</h3>
      </template>

      <div v-show="!confirmOnLedger">
        <p>Please confirm delegation:</p>
        Amount: <span class="text-info">{{ delegateData.und }} FUND</span><br />
        Validator: {{ getValidatorMoniker(delegateData.address) }}<br />
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
        <b-button v-show="!confirmOnLedger" variant="success" aria-label="Confirm" @click="confirmDelegation">
          Confirm
        </b-button>
        <b-button
          aria-label="Cancel"
          @click="clearDelegateData, $bvModal.hide('bv-modal-confirm-delegate-und')"
        >
          Cancel
        </b-button>
      </template>
    </b-modal>

    <!-- delegate form -->
    <h3>Delegate FUND</h3>

    <div v-show="isDataLoading">
      <b-spinner style="width: 3rem; height: 3rem;" label="Large Spinner" />
    </div>

    <div v-show="!isDataLoading">
      <b-form @submit.prevent="preventSubmit">
        <b-form-group
          id="delegate-node-label"
          label="Select Existing (active) Validator:"
          label-for="delegate-node"
          description="Select an existing (active) validator"
        >
          <b-form-select
            id="delegate-node"
            v-model="delegateData.address"
            :options="validators.validatorsSelect"
            @change="getValidatorInfo"
          />
        </b-form-group>

        <div
          v-show="selectedValidatorMetadata !== null && delegateData.address in validators.validators"
          class="validator-info rounded"
        >
          <h5>
            "<a :href="explorerUrlPrefix + '/validators/' + selectedValidatorOperatorAddress" target="_blank">
              {{ selectedValidatorMoniker }} </a
            >"
            <span v-show="selectedValidatorJailed" class="badge badge-danger">Jailed</span>
            Validator Info
          </h5>
          Operator Address:
          <a :href="explorerUrlPrefix + '/validators/' + selectedValidatorOperatorAddress" target="_blank">
            {{ selectedValidatorOperatorAddress }}
          </a>
          <b-icon-box-arrow-up-right /><br />
          Website: <a :href="selectedValidatorWebsite" target="_blank">{{ selectedValidatorWebsite }}</a
          ><br />
          Identity: {{ selectedValidatorIdentity }}<br />
          Security Contact: {{ selectedValidatorSecurity }}<br />
          Details: {{ selectedValidatorDetails.replace(/<[^>]*>?/gm, " ") }}<br />
          Total Staked: {{ selectedValidatorStakedTokens }}<br />
          Total Shares: {{ selectedValidatorShares }}<br />
          Commission Rate: {{ selectedValidatorCommissionRate }}%<br />
          Max Commission Rate: {{ selectedValidatorCommissionMaxRate }}%<br />
          Commission Change Rate: {{ selectedValidatorCommissionMaxChangeRate }}%
        </div>

        <br />
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
            @keydown.enter.prevent="preventSubmit"
          />
        </b-form-group>

        <b-form-group
          id="delegate-und-label"
          label="Amount:"
          label-for="delegate-und"
          description="Amount of FUND to delegate"
        >
          <b-input-group append="FUND">
            <b-form-input
              id="delegate-und"
              v-model="delegateData.und"
              type="number"
              required
              placeholder=""
              :state="delegateAmountState"
              aria-describedby="input-live-feedback-delegate-amount"
              @keydown.enter.prevent="preventSubmit"
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
            @keydown.enter.prevent="preventSubmit"
          />
        </b-form-group>

        <b-form-group
          v-show="isShowFee"
          id="delegate-fee-amount-label"
          label="Fee:"
          label-for="delegate-fee-amount"
          description="Fees in nund"
        >
          <b-input-group append="nund">
            <b-form-input
              id="delegate-fee-amount"
              v-model="fee.amount[0].amount"
              type="number"
              trim
              aria-describedby="input-live-feedback-delegate-fees"
              :state="feeState"
              @keydown.enter.prevent="preventSubmit"
            />
            <b-form-invalid-feedback id="input-live-feedback-delegate-fees">
              Invalid fees
            </b-form-invalid-feedback>
          </b-input-group>
        </b-form-group>
        <b-form-group
          v-show="isShowFee"
          id="delegate-fee-gas-label"
          label="Gas:"
          label-for="delegate-fee-gas"
          description="Gas"
        >
          <b-form-input
            id="delegate-fee-gas"
            v-model="fee.gas"
            type="number"
            trim
            aria-describedby="input-live-feedback-delegate-gas"
            :state="gasState"
            @keydown.enter.prevent="preventSubmit"
          />
          <b-form-invalid-feedback id="input-live-feedback-delegate-gas">
            Invalid gas
          </b-form-invalid-feedback>
        </b-form-group>

        <b-form-checkbox id="delegate-show-fee" v-model="isShowFee" name="delegate-show-fee">
          Manually set Fees
        </b-form-checkbox>

        <b-button variant="success" :disabled="!delegateFormState" @click="showConfirmDelegate()">
          Delegate FUND
        </b-button>
      </b-form>
      <br />
      <b>Note:</b> if you are delegating to a Validator that you already have a stake with, outstanding
      rewards will be automatically withdrawn
    </div>
  </div>
</template>

<script>
import { mapState, mapGetters } from "vuex"
import { UND_CONFIG } from "../constants"
import LedgerConfirm from "./LedgerConfirm.vue"

const UndClient = require("@unification-com/und-js")

export default {
  name: "StakingDelegate",
  components: {
    LedgerConfirm,
  },
  data() {
    return {
      delegateData: {
        address: "",
        und: "0",
        memo: UND_CONFIG.DEFAULT_MEMO,
      },
      fee: UND_CONFIG.DEFULT_DELEGATE_FEE,
      isDataLoading: false,
      isShowFee: false,
      selectedValidatorMetadata: null,
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
      validators: state => state.validators,
    }),
    ...mapGetters("validators", ["getValidatorMoniker"]),
    delegateAmountState() {
      return this.isValidAmount(this.delegateData.und)
    },
    delegateFormState() {
      return this.delegateAmountState && this.gasState && this.feeState
    },
    gasState() {
      return this.isValidGas(this.fee.gas)
    },
    feeState() {
      return this.isValidFee(this.fee)
    },
    explorerUrlPrefix() {
      return this.explorerUrl(this.chainId)
    },
    selectedValidatorMoniker() {
      if (this.selectedValidatorMetadata !== null && "description" in this.selectedValidatorMetadata) {
        return this.selectedValidatorMetadata.description.moniker
      }
      return ""
    },
    selectedValidatorOperatorAddress() {
      if (this.selectedValidatorMetadata !== null && "operator_address" in this.selectedValidatorMetadata) {
        return this.selectedValidatorMetadata.operator_address
      }
      return ""
    },
    selectedValidatorIdentity() {
      if (this.selectedValidatorMetadata !== null && "description" in this.selectedValidatorMetadata) {
        return this.selectedValidatorMetadata.description.identity
      }
      return ""
    },
    selectedValidatorWebsite() {
      if (this.selectedValidatorMetadata !== null && "description" in this.selectedValidatorMetadata) {
        return this.selectedValidatorMetadata.description.website
      }
      return ""
    },
    selectedValidatorSecurity() {
      if (this.selectedValidatorMetadata !== null && "description" in this.selectedValidatorMetadata) {
        return this.selectedValidatorMetadata.description.security_contact
      }
      return ""
    },
    selectedValidatorDetails() {
      if (this.selectedValidatorMetadata !== null && "description" in this.selectedValidatorMetadata) {
        return this.selectedValidatorMetadata.description.details
      }
      return ""
    },
    selectedValidatorConsensusPubKey() {
      if (this.selectedValidatorMetadata !== null && "consensus_pubkey" in this.selectedValidatorMetadata) {
        return this.selectedValidatorMetadata.consensus_pubkey
      }
      return ""
    },
    selectedValidatorJailed() {
      if (this.selectedValidatorMetadata !== null && "jailed" in this.selectedValidatorMetadata) {
        return this.selectedValidatorMetadata.jailed === "true"
      }
      return false
    },
    selectedValidatorCommissionRate() {
      if (this.selectedValidatorMetadata !== null && "commission" in this.selectedValidatorMetadata) {
        return parseFloat(this.selectedValidatorMetadata.commission.commission_rates.rate) * 100
      }
      return ""
    },
    selectedValidatorCommissionMaxRate() {
      if (this.selectedValidatorMetadata !== null && "commission" in this.selectedValidatorMetadata) {
        return parseFloat(this.selectedValidatorMetadata.commission.commission_rates.max_rate) * 100
      }
      return ""
    },
    selectedValidatorCommissionMaxChangeRate() {
      if (this.selectedValidatorMetadata !== null && "commission" in this.selectedValidatorMetadata) {
        return parseFloat(this.selectedValidatorMetadata.commission.commission_rates.max_change_rate) * 100
      }
      return ""
    },
    selectedValidatorStakedTokens() {
      if (this.selectedValidatorMetadata !== null && "tokens" in this.selectedValidatorMetadata) {
        return this.formatAmount(this.selectedValidatorMetadata.tokens)
      }
      return ""
    },
    selectedValidatorShares() {
      if (this.selectedValidatorMetadata !== null && "delegator_shares" in this.selectedValidatorMetadata) {
        const shares = new Intl.NumberFormat("en-GB", { maximumSignificantDigits: 21 }).format(
          this.selectedValidatorMetadata.delegator_shares,
        )
        return shares
      }
      return ""
    },
  },
  methods: {
    preventSubmit() {
      return false
    },
    getValidatorInfo() {
      this.selectedValidatorMetadata = null
      if (this.delegateData.address in this.validators.validators) {
        this.selectedValidatorMetadata = this.validators.validators[this.delegateData.address]
      }
    },
    checkFeesAndGas() {
      if (!this.isValidFee(this.fee)) {
        this.showToast("danger", "Error", "invalid fees")
        return false
      }
      if (!this.isValidGas(this.fee.gas)) {
        this.showToast("danger", "Error", "invalid gas amount")
        return false
      }
      return true
    },
    showConfirmDelegate() {
      if (this.delegateData.und <= 0 || Number.isNaN(this.delegateData.und)) {
        this.showToast("danger", "Error", "Amount must be greater than zero")
        return false
      }
      if (!this.isValidAmount(this.delegateData.und)) {
        this.showToast("danger", "Error", "invalid amount")
        return false
      }
      if (this.wallet.balance === 0) {
        this.showToast("danger", "Error", "cannot send a transaction with zero available balance")
        return false
      }
      if (!this.wallet.accountExists) {
        this.showToast("danger", "Error", "account does not exists on chain yet")
        return false
      }
      if (this.delegateData.und > this.wallet.balance) {
        this.showToast("danger", "Error", "cannot delegate more than your balance")
        return false
      }
      if (this.delegateData.und >= this.wallet.balance) {
        this.showToast(
          "danger",
          "Error",
          "cannot delegate full balance - there will not be enough to pay for Tx fees.",
        )
        return false
      }
      const isValidAmtFees = this.isValidAmountPlusFees(
        this.wallet.balance,
        this.delegateData.und,
        this.fee.amount[0].amount,
      )
      if (!isValidAmtFees.isValid) {
        this.showToast(
          "danger",
          "Error",
          `not enough balance to pay for stake + tx fees. Got ${isValidAmtFees.gotUnd} FUND, need ${isValidAmtFees.requiredUnd} FUND`,
        )
        return false
      }
      this.showWarning = isValidAmtFees.warn
      this.balanceDiff = isValidAmtFees.diff

      if (!UndClient.crypto.checkAddress(this.delegateData.address, UND_CONFIG.BECH32_VAL_PREFIX)) {
        this.showToast("danger", "Error", `"${this.delegateData.address}" is not a valid operator address`)
        return false
      }
      if (this.delegateData.memo.length > 100) {
        this.showToast("danger", "Error", "memo too long > 100 characters")
        return false
      }
      if (!this.checkFeesAndGas()) {
        return false
      }
      this.$bvModal.show("bv-modal-confirm-delegate-und")
      return true
    },
    clearDelegateData() {
      this.delegateData = null
      this.fee = null
      this.delegateData = {
        address: "",
        und: "0",
        memo: UND_CONFIG.DEFAULT_MEMO,
      }
      this.fee = UND_CONFIG.DEFULT_DELEGATE_FEE
      this.isShowFee = false
      this.selectedValidatorMetadata = null
      this.isShowFee = false
      this.showWarning = false
      this.balanceDiff = "0"
      this.confirmOnLedger = false
    },
    confirmDelegation() {
      const isValidAmtFees = this.isValidAmountPlusFees(
        this.wallet.balance,
        this.delegateData.und,
        this.fee.amount[0].amount,
      )
      if (!isValidAmtFees.isValid) {
        this.showToast(
          "danger",
          "Error",
          `not enough balance to pay for stake + tx fees. Got ${isValidAmtFees.gotUnd} FUND, need ${isValidAmtFees.requiredUnd} FUND`,
        )
        return false
      }
      this.confirmDelegationAsync()
      return true
    },
    async confirmDelegationAsync() {
      if (this.isClientConnected && this.wallet.isWalletUnlocked) {
        if (this.client.isLedgerMode) {
          this.confirmOnLedger = true
        }
        try {
          const res = await this.client.delegate(
            this.delegateData.address,
            this.delegateData.und,
            this.fee,
            "fund",
            this.wallet.address,
            this.delegateData.memo,
          )

          if (res.status === 200) {
            this.showToast(
              "success",
              "FUND Delegated Successfully",
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
        } catch (err) {
          this.showToast("error", "Error", err.toString())
        }
      } else {
        this.clientError()
      }
      this.clearDelegateData()
      this.$bvModal.hide("bv-modal-confirm-delegate-und")
      this.confirmOnLedger = false
    },
  },
}
</script>

<style scoped>
.validator-info {
  color: white;
  background-color: #0174c7;
  padding: 15px;
}
.validator-info a {
  color: white;
}
</style>
