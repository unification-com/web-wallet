<template>
  <div>
    <!-- undelegate modal -->
    <b-modal id="bv-modal-undelegate-und">
      <template v-slot:modal-title>
        <h3>Undelegate FUND</h3>
      </template>
      <b-form @submit.prevent="preventSubmit">
        <b-form-group
          id="undelegate-und-label"
          label="Undelegate:"
          label-for="undelegate-und"
          description="Amount of FUND to undelegate"
        >
          <b-input-group append="FUND">
            <b-form-input
              id="undelegate-und"
              v-model="undelegateData.und"
              type="number"
              required
              :state="unDelegateAmountState"
              aria-describedby="input-live-feedback-undelegate-amount"
              @keydown.enter.prevent="preventSubmit"
            />
            <b-form-invalid-feedback id="input-live-feedback-undelegate-amount">
              Invalid amount
            </b-form-invalid-feedback>
          </b-input-group>
        </b-form-group>
        <p>
          <b>(maximum {{ undelegateData.max }} FUND)</b><br />
        </p>
        <b-form-group
          id="undelegate-from-label"
          :label="'From Validator ' + getValidatorMoniker(undelegateData.address)"
          label-for="undelegate-from"
          description="Address to undelegate from"
        >
          <span class="wallet_address">
            <b-form-input
              id="undelegate-from"
              v-model="undelegateData.address"
              type="text"
              required
              plaintext
            />
          </span>
        </b-form-group>

        <b-form-group
          v-show="isShowFee"
          id="undelegate-fee-amount-label"
          label="Fee:"
          label-for="undelegate-fee-amount"
          description="Fees in nund"
        >
          <b-input-group append="nund">
            <b-form-input
              id="undelegate-fee-amount"
              v-model="fee.amount[0].amount"
              type="number"
              trim
              aria-describedby="input-live-feedback-undelegate-fees"
              :state="feeState"
              @keydown.enter.prevent="preventSubmit"
            />
            <b-form-invalid-feedback id="input-live-feedback-undelegate-fees">
              Invalid fees
            </b-form-invalid-feedback>
          </b-input-group>
        </b-form-group>
        <b-form-group
          v-show="isShowFee"
          id="undelegate-fee-gas-label"
          label="Gas:"
          label-for="undelegate-fee-gas"
          description="Gas"
        >
          <b-form-input
            id="undelegate-fee-gas"
            v-model="fee.gas"
            type="number"
            trim
            aria-describedby="input-live-feedback-undelegate-gas"
            :state="gasState"
            @keydown.enter.prevent="preventSubmit"
          />
          <b-form-invalid-feedback id="input-live-feedback-undelegate-gas">
            Invalid gas
          </b-form-invalid-feedback>
        </b-form-group>

        <b-form-checkbox id="undelegate-show-fee" v-model="isShowFee" name="undelegate-show-fee">
          Manually set Fees
        </b-form-checkbox>
        <p><b>Note:</b> outstanding rewards will automatically be withdrawn during undelegation</p>
      </b-form>
      <template v-slot:modal-footer>
        <b-button
          variant="success"
          aria-label="Create"
          :disabled="!unDelegateFormState"
          @click="showConfirmUnDelegation"
        >
          Undelegate
        </b-button>
        <b-button aria-label="Cancel" @click="$bvModal.hide('bv-modal-undelegate-und')">
          Cancel
        </b-button>
      </template>
    </b-modal>

    <!-- confirm undelegate modal -->
    <b-modal id="bv-modal-confirm-undelegate-und">
      <template v-slot:modal-title>
        <h3>Confirm Undelegate FUND</h3>
      </template>
      <div>
        Chain ID: {{ chainId }}<br />
        Undelegate <span class="text-info">{{ undelegateData.und }} FUND</span><br />
        From: <span class="wallet_address"> {{ wallet.address }} </span><br />
        Validator Name: {{ getValidatorMoniker(undelegateData.address) }}<br />
        Validator Address: <span class="wallet_address"> {{ undelegateData.address }} </span><br />
        Fee: {{ fee.amount[0].amount }}nund ({{ nundToUnd(fee.amount[0].amount) }} FUND)<br />
        Gas: {{ fee.gas }}<br />
        <span v-show="undelegateData.memo">Memo: {{ undelegateData.memo }}</span>
      </div>
      <LedgerConfirm v-show="confirmOnLedger" />
      <template v-slot:modal-footer>
        <b-button
          v-show="!confirmOnLedger"
          variant="success"
          aria-label="Create"
          @click="confirmUndelegation"
        >
          Confirm
        </b-button>
        <b-button
          v-show="!confirmOnLedger"
          aria-label="Cancel"
          @click="$bvModal.hide('bv-modal-confirm-undelegate-und')"
        >
          Cancel
        </b-button>
      </template>
    </b-modal>

    <!-- redelegate modal -->
    <b-modal id="bv-modal-redelegate-und">
      <template v-slot:modal-title>
        <h3>Redelegate FUND</h3>
      </template>
      <b-form @submit.prevent="preventSubmit">
        <b-form-group
          id="redelegate-und-label"
          label="redelegate:"
          label-for="redelegate-und"
          description="Amount of FUND to redelegate"
        >
          <b-input-group append="FUND">
            <b-form-input
              id="redelegate-und"
              v-model="redelegateData.und"
              type="number"
              required
              :state="reDelegateAmountState"
              aria-describedby="input-live-feedback-redelegate-amount"
              @keydown.enter.prevent="preventSubmit"
            />
            <b-form-invalid-feedback id="input-live-feedback-redelegate-amount">
              Invalid amount
            </b-form-invalid-feedback>
          </b-input-group>
        </b-form-group>
        <p>
          <b>(maximum {{ redelegateData.max }} FUND)</b><br />
        </p>
        <b-form-group
          id="redelegate-from-label"
          :label="'From Validator: ' + getValidatorMoniker(redelegateData.src)"
          label-for="redelegate-from"
          description="Address to redelegate from"
        >
          <span class="wallet_address">
            <b-form-input
              id="redelegate-from"
              v-model="redelegateData.src"
              type="text"
              required
              plaintext
              @keydown.enter.prevent="preventSubmit"
            />
          </span>
        </b-form-group>

        <b-form-group
          id="redelegate-node-label"
          label="To Validator:"
          label-for="redelegate-node"
          description="Select an existing validator"
        >
          <b-form-select
            id="redelegate-node"
            v-model="redelegateData.dst"
            :options="validators.validatorsSelect"
          />
        </b-form-group>
        <b-form-group
          id="redelegate-manual-node-label"
          label="Or Manually Enter Validator:"
          label-for="redelegate-manual-node"
          description="Alternatively, enter a validator address manually (note - this starts with undvaloper)"
        >
          <span class="wallet_address">
            <b-form-input
              id="redelegate-manual-node"
              v-model="redelegateData.dst"
              type="text"
              required
              @keydown.enter.prevent="preventSubmit"
            />
          </span>
        </b-form-group>

        <b-form-group
          id="redelegate-memo-label"
          label="Memo:"
          label-for="redelegate-memo"
          description="Optional Memo"
        >
          <b-form-input
            id="redelegate-memo"
            v-model="redelegateData.memo"
            type="text"
            trim
            @keydown.enter.prevent="preventSubmit"
          />
        </b-form-group>

        <b-form-group
          v-show="isShowFee"
          id="redelegate-fee-amount-label"
          label="Fee:"
          label-for="redelegate-fee-amount"
          description="Fees in nund"
        >
          <b-input-group append="nund">
            <b-form-input
              id="redelegate-fee-amount"
              v-model="fee.amount[0].amount"
              type="number"
              trim
              aria-describedby="input-live-feedback-redelegate-fees"
              :state="feeState"
              @keydown.enter.prevent="preventSubmit"
            />
            <b-form-invalid-feedback id="input-live-feedback-redelegate-fees">
              Invalid fees
            </b-form-invalid-feedback>
          </b-input-group>
        </b-form-group>
        <b-form-group
          v-show="isShowFee"
          id="redelegate-fee-gas-label"
          label="Gas:"
          label-for="redelegate-fee-gas"
          description="Gas"
        >
          <b-form-input
            id="redelegate-fee-gas"
            v-model="fee.gas"
            type="number"
            trim
            aria-describedby="input-live-feedback-redelegate-gas"
            :state="gasState"
            @keydown.enter.prevent="preventSubmit"
          />
          <b-form-invalid-feedback id="input-live-feedback-redelegate-gas">
            Invalid gas
          </b-form-invalid-feedback>
        </b-form-group>

        <b-form-checkbox id="redelegate-show-fee" v-model="isShowFee" name="redelegate-show-fee">
          Manually set Fees
        </b-form-checkbox>
      </b-form>

      <p><b>Note:</b> outstanding rewards will automatically be withdrawn during redelegation</p>
      <template v-slot:modal-footer>
        <b-button
          variant="success"
          aria-label="Redelegate"
          :disabled="!reDelegateFormState"
          @click="showConfirmReDelegation"
        >
          Redelegate
        </b-button>
        <b-button aria-label="Cancel" @click="$bvModal.hide('bv-modal-redelegate-und')">
          Cancel
        </b-button>
      </template>
    </b-modal>

    <!-- confirm redelegate modal -->
    <b-modal id="bv-modal-confirm-redelegate-und">
      <template v-slot:modal-title>
        <h3>Confirm redelegate FUND</h3>
      </template>
      <div>
        Chain ID: {{ chainId }}<br />
        Redelegate <span class="text-info">{{ redelegateData.und }} FUND</span><br />
        From: <span class="wallet_address"> {{ wallet.address }} </span><br />
        Validator From: {{ getValidatorMoniker(redelegateData.src) }}
        <span class="wallet_address"> {{ redelegateData.src }} </span><br />
        Validator To: {{ getValidatorMoniker(redelegateData.dst) }}
        <span class="wallet_address"> {{ redelegateData.dst }} </span><br />
        Fee: {{ fee.amount[0].amount }}nund ({{ nundToUnd(fee.amount[0].amount) }} FUND)<br />
        Gas: {{ fee.gas }}<br />
        <span v-show="redelegateData.memo">Memo: {{ redelegateData.memo }}</span>
      </div>
      <LedgerConfirm v-show="confirmOnLedger" />
      <template v-slot:modal-footer>
        <b-button
          v-show="!confirmOnLedger"
          variant="success"
          aria-label="Confirm"
          @click="confirmRedelegation"
        >
          Confirm
        </b-button>
        <b-button
          v-show="!confirmOnLedger"
          aria-label="Cancel"
          @click="$bvModal.hide('bv-modal-confirm-redelegate-und')"
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
      <div>
        Chain ID: {{ chainId }}<br />
        Withdraw <span class="text-info">{{ withdrawData.und }} FUND</span><br />
        For: <span class="wallet_address"> {{ wallet.address }} </span><br />
        From Validator: {{ getValidatorMoniker(withdrawData.address) }}<br />
        Validator Address: <span class="wallet_address"> {{ withdrawData.address }} </span><br />
        Fee: {{ fee.amount[0].amount }}nund ({{ nundToUnd(fee.amount[0].amount) }} FUND)<br />
        Gas: {{ fee.gas }}<br />
        <span v-show="withdrawData.memo">Memo: {{ withdrawData.memo }}</span>

        <b-form @submit.prevent="preventSubmit">
          <b-form-group
            v-show="isShowFee"
            id="withdraw-fee-amount-label"
            label="Fee:"
            label-for="withdraw-fee-amount"
            description="Fees in nund"
          >
            <b-input-group append="nund">
              <b-form-input
                id="withdraw-fee-amount"
                v-model="fee.amount[0].amount"
                type="text"
                trim
                aria-describedby="input-live-feedback-withdraw-fees"
                :state="feeState"
                @keydown.enter.prevent="preventSubmit"
              />
              <b-form-invalid-feedback id="input-live-feedback-withdraw-fees">
                Invalid fees
              </b-form-invalid-feedback>
            </b-input-group>
          </b-form-group>
          <b-form-group
            v-show="isShowFee"
            id="withdraw-fee-gas-label"
            label="Gas:"
            label-for="withdraw-fee-gas"
            description="Gas"
          >
            <b-form-input
              id="withdraw-fee-gas"
              v-model="fee.gas"
              type="text"
              trim
              aria-describedby="input-live-feedback-withdraw-gas"
              :state="gasState"
              @keydown.enter.prevent="preventSubmit"
            />
            <b-form-invalid-feedback id="input-live-feedback-withdraw-gas">
              Invalid gas
            </b-form-invalid-feedback>
          </b-form-group>

          <b-form-checkbox id="withdraw-show-fee" v-model="isShowFee" name="withdraw-show-fee">
            Manually set Fees
          </b-form-checkbox>
        </b-form>
      </div>
      <LedgerConfirm v-show="confirmOnLedger" />
      <template v-slot:modal-footer>
        <b-button
          v-show="!confirmOnLedger"
          variant="success"
          aria-label="Create"
          :disabled="!withdrawFormState"
          @click="confirmWithdrawReward"
        >
          Confirm
        </b-button>
        <b-button
          v-show="!confirmOnLedger"
          aria-label="Cancel"
          @click="$bvModal.hide('bv-modal-confirm-withdraw-rewards')"
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
          <b-button @click="getDelegations(), getDelegatorRewards()">
            Refresh
          </b-button>
        </b-col>
      </b-row>
    </b-container>

    <div v-show="isDataLoading">
      <b-spinner style="width: 3rem; height: 3rem;" label="Large Spinner" />
    </div>

    <div v-show="!isDataLoading">
      <b-table
        :items="JSON.parse(JSON.stringify(delegationsObj))"
        :fields="delegationsFields"
        striped
        responsive="sm"
      >
        <template v-slot:cell(show_details)="row">
          <b-button size="sm" class="mr-2" @click="row.toggleDetails">
            {{ row.detailsShowing ? "Hide" : "Show" }} Details
          </b-button>
        </template>
        <template v-slot:row-details="row">
          <b-card>
            <b-row class="mb-2">
              <b-col sm="3" class="text-sm-right">
                <b>Moniker:</b>
              </b-col>
              <b-col>
                <a :href="explorerUrlPrefix + '/validator/' + row.item.validator_address" target="_blank">
                  {{ getValidatorDescription(row.item.validator_address).moniker }}
                  <b-icon-box-arrow-up-right />
                </a>
              </b-col>
            </b-row>
            <b-row class="mb-2">
              <b-col sm="3" class="text-sm-right">
                <b>Operator Address:</b>
              </b-col>
              <b-col>
                <span class="wallet_address">
                  <a :href="explorerUrlPrefix + '/validator/' + row.item.validator_address" target="_blank">
                    {{ row.item.validator_address }}
                    <b-icon-box-arrow-up-right />
                  </a>
                </span>
              </b-col>
            </b-row>
            <b-row class="mb-2">
              <b-col sm="3" class="text-sm-right">
                <b>Identity:</b>
              </b-col>
              <b-col>{{ getValidatorDescription(row.item.validator_address).identity }}</b-col>
            </b-row>
            <b-row class="mb-2">
              <b-col sm="3" class="text-sm-right">
                <b>Website:</b>
              </b-col>
              <b-col>{{ getValidatorDescription(row.item.validator_address).website }}</b-col>
            </b-row>
            <b-row class="mb-2">
              <b-col sm="3" class="text-sm-right">
                <b>Security Contact:</b>
              </b-col>
              <b-col>{{ getValidatorDescription(row.item.validator_address).security_contact }}</b-col>
            </b-row>
            <b-row class="mb-2">
              <b-col sm="3" class="text-sm-right">
                <b>Details:</b>
              </b-col>
              <b-col>
                {{ getValidatorDescription(row.item.validator_address).details.replace(/<[^>]*>?/gm, " ") }}
              </b-col>
            </b-row>
            <b-button variant="warning" size="sm" class="mr-2" @click="initUndelegate(row.item)">
              Undelegate
            </b-button>

            <b-button variant="info" size="sm" class="mr-2" @click="initRedelegate(row.item)">
              Redelegate
            </b-button>
            <b-button
              v-show="row.item.rewards > 0"
              variant="success"
              size="sm"
              class="mr-2"
              @click="showConfirmWithdraw(row.item)"
            >
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
          <b class="text-info">{{ formatAmount(data.value) }}</b>
        </template>
        <template v-slot:cell(rewards)="data">
          <b class="text-info">{{ formatAmount(data.value) }}</b>
        </template>
      </b-table>
    </div>
  </div>
</template>

<script>
import { mapState, mapGetters } from "vuex"
import Big from "big.js"
import { UND_CONFIG } from "../constants"
import LedgerConfirm from "./LedgerConfirm.vue"

const UndClient = require("@unification-com/und-js")

export default {
  name: "StakingDelegations",
  components: {
    LedgerConfirm,
  },
  data() {
    return {
      activeItem: "delegations",
      undelegateData: {
        address: "",
        und: "0",
        max: "",
        memo: UND_CONFIG.DEFAULT_MEMO,
      },
      redelegateData: {
        src: "",
        dst: "",
        und: "0",
        max: "",
        memo: UND_CONFIG.DEFAULT_MEMO,
      },
      withdrawData: {
        address: "",
        und: "0",
      },
      fee: UND_CONFIG.DEFULT_DELEGATE_FEE,
      delegationsFields: ["name", "shares", "delegated", "rewards", "show_details"],
      isDataLoading: false,
      isShowFee: false,
      delegationsObj: [],
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
      delegations: state => state.delegations,
    }),
    ...mapGetters({
      getValidatorDescription: "validators/getValidatorDescription",
      getValidatorMoniker: "validators/getValidatorMoniker",
      getReward: "delegations/getReward",
    }),
    explorerUrlPrefix() {
      return this.explorerUrl(this.chainId)
    },
    unDelegateAmountState() {
      return this.isValidAmount(this.undelegateData.und)
    },
    unDelegateFormState() {
      return this.unDelegateAmountState && this.gasState && this.feeState
    },
    reDelegateAmountState() {
      return this.isValidAmount(this.redelegateData.und)
    },
    reDelegateFormState() {
      return this.reDelegateAmountState && this.gasState && this.feeState
    },
    withdrawFormState() {
      return this.gasState && this.feeState
    },
    gasState() {
      return this.isValidGas(this.fee.gas)
    },
    feeState() {
      return this.isValidFee(this.fee)
    },
  },
  methods: {
    // Todo - display and modify withdraw address
    preventSubmit() {
      return false
    },
    generateDisplayObj() {
      this.delegationsObj = []
      for (let i = 0; i < this.delegations.delegations.length; i += 1) {
        const validatorAddress = this.delegations.delegations[i].validator_address
        const d = {
          validator_address: validatorAddress,
          name: this.getValidatorDescription(validatorAddress).moniker,
          shares: this.delegations.delegations[i].shares,
          delegated: this.delegations.delegations[i].balance.amount,
          rewards: this.getReward(validatorAddress),
        }
        this.delegationsObj.push(d)
      }
    },
    checkFeesAndGas() {
      if (!this.isValidFee(this.fee)) {
        this.showToast("error", "Error", "invalid fees")
        return false
      }
      if (!this.isValidGas(this.fee.gas)) {
        this.showToast("error", "Error", "invalid gas amount")
        return false
      }
      return true
    },
    showConfirmUnDelegation() {
      if (!this.isValidAmount(this.undelegateData.und)) {
        this.showToast("error", "Error", "invalid amount")
        return false
      }
      if (this.wallet.balance === 0) {
        this.showToast("error", "Error", "cannot send a transaction with zero available balance")
        return false
      }
      if (!this.wallet.accountExists) {
        this.showToast("error", "Error", "account does not exists on chain yet")
        return false
      }
      if (
        this.undelegateData.und <= 0 ||
        // eslint-disable-next-line no-restricted-globals
        isNaN(this.undelegateData.und) ||
        this.undelegateData.und > this.undelegateData.max
      ) {
        this.showToast(
          "error",
          "Error",
          `Amount must be greater than zero, and less than ${this.undelegateData.max} FUND`,
        )
        return false
      }
      if (!UndClient.crypto.checkAddress(this.undelegateData.address, UND_CONFIG.BECH32_VAL_PREFIX)) {
        this.showToast("error", "Error", `"${this.undelegateData.address}" is not a valid operator address`)
        return false
      }
      if (this.undelegateData.memo.length > 100) {
        this.showToast("error", "Error", "memo too long > 100 characters")
        return false
      }
      if (!this.checkFeesAndGas()) {
        return false
      }
      this.$bvModal.hide("bv-modal-undelegate-und")
      this.$bvModal.show("bv-modal-confirm-undelegate-und")
      return true
    },
    showConfirmReDelegation() {
      if (!this.isValidAmount(this.redelegateData.und)) {
        this.showToast("error", "Error", "invalid amount")
        return false
      }
      if (this.wallet.balance === 0) {
        this.showToast("error", "Error", "cannot send a transaction with zero available balance")
        return false
      }
      if (!this.wallet.accountExists) {
        this.showToast("error", "Error", "account does not exists on chain yet")
        return false
      }
      if (
        this.redelegateData.und <= 0 ||
        Number.isNaN(this.redelegateData.und) ||
        this.redelegateData.und > this.redelegateData.max
      ) {
        this.showToast(
          "error",
          "Error",
          `Amount must be greater than zero, and less than ${this.redelegateData.max} FUND`,
        )
        return false
      }
      if (!UndClient.crypto.checkAddress(this.redelegateData.dst, UND_CONFIG.BECH32_VAL_PREFIX)) {
        this.showToast("error", "Error", `"${this.redelegateData.dst}" is not a valid operator address`)
        return false
      }
      if (!UndClient.crypto.checkAddress(this.redelegateData.src, UND_CONFIG.BECH32_VAL_PREFIX)) {
        this.showToast("error", "Error", `"${this.redelegateData.src}" is not a valid operator address`)
        return false
      }
      if (this.redelegateData.src === this.redelegateData.dst) {
        this.showToast("error", "Error", "cannot redelegate to same address")
        return false
      }
      if (this.redelegateData.memo.length > 100) {
        this.showToast("error", "Error", "memo too long > 100 characters")
        return false
      }
      if (!this.checkFeesAndGas()) {
        return false
      }
      this.$bvModal.hide("bv-modal-redelegate-und")
      this.$bvModal.show("bv-modal-confirm-redelegate-und")
      return true
    },
    showConfirmWithdraw(item) {
      this.clearWithdrawData()
      this.withdrawData.address = item.validator_address
      this.withdrawData.und = this.nundToUnd(item.rewards)
      if (this.wallet.balance === 0) {
        this.showToast("error", "Error", "cannot send a transaction with zero available balance")
        return false
      }
      if (!this.wallet.accountExists) {
        this.showToast("error", "Error", "account does not exists on chain yet")
        return false
      }
      this.$bvModal.show("bv-modal-confirm-withdraw-rewards")
      return true
    },
    clearUnDelegateData() {
      this.undelegateData = null
      this.fee = null
      this.undelegateData = {
        address: "",
        und: "0",
        max: "",
        memo: UND_CONFIG.DEFAULT_MEMO,
      }
      this.fee = UND_CONFIG.DEFAULT_UNDELEGATE_FEE
      this.isShowFee = false
      this.confirmOnLedger = false
    },
    clearReDelegateData() {
      this.redelegateData = null
      this.fee = null
      this.redelegateData = {
        src: "",
        dst: "",
        und: "0",
        max: "",
        memo: UND_CONFIG.DEFAULT_MEMO,
      }
      this.fee = UND_CONFIG.DEFAULT_REDELEGATE_FEE
      this.isShowFee = false
      this.confirmOnLedger = false
    },
    clearWithdrawData() {
      this.withdrawData = null
      this.fee = null
      this.withdrawData = {
        address: "",
        und: "0",
      }
      this.fee = UND_CONFIG.DEFAULT_WITHDRAW_REWARDS_FEE
      this.isShowFee = false
      this.confirmOnLedger = false
    },
    initUndelegate(item) {
      this.clearUnDelegateData()
      this.undelegateData.address = item.validator_address
      this.undelegateData.max = this.nundToUnd(item.delegated)
      this.$bvModal.show("bv-modal-undelegate-und")
    },
    initRedelegate(item) {
      this.clearReDelegateData()
      this.redelegateData.src = item.validator_address
      this.redelegateData.max = this.nundToUnd(item.delegated)
      this.$bvModal.show("bv-modal-redelegate-und")
    },
    async getDelegations() {
      if (this.isClientConnected && this.wallet.isWalletUnlocked) {
        await this.$store.dispatch("delegations/clearDelegations")
        this.isDataLoading = true
        let totalDelegations = 0
        let totalShares = new Big("0")
        let totalStaked = new Big("0")

        const res = await this.client.getDelegations()
        if (res.status === 200) {
          totalDelegations = res.result.result.length
          const addEditDelegationRes = []
          for (let i = 0; i < res.result.result.length; i += 1) {
            totalShares = totalShares.add(res.result.result[i].shares)
            totalStaked = totalStaked.add(res.result.result[i].balance.amount)
            addEditDelegationRes.push(
              this.$store.dispatch("delegations/addEditDelegation", res.result.result[i]),
            )
          }
          await Promise.all(addEditDelegationRes)
        } else {
          this.handleUndJsError(res)
        }
        await this.$store.dispatch("wallet/setTotalShares", totalShares)
        await this.$store.dispatch("wallet/setTotalStaked", totalStaked)
        await this.$store.dispatch("wallet/setTotalDelegations", totalDelegations)
        this.isDataLoading = false
      }
      this.generateDisplayObj()
    },
    async getDelegatorRewards() {
      let total = 0.0
      if (this.isClientConnected && this.wallet.isWalletUnlocked) {
        const res = await this.client.getDelegatorRewards(this.wallet.address)
        if (res.status === 200 && res.result.result.rewards) {
          const updateRewardRes = []
          if (res.result.result.total) {
            total = res.result.result.total[0].amount
          }
          for (let i = 0; i < res.result.result.rewards.length; i += 1) {
            updateRewardRes.push(
              this.$store.dispatch("delegations/updateReward", res.result.result.rewards[i]),
            )
          }
          await Promise.all(updateRewardRes)
        } else if (res.status !== 200) {
          this.handleUndJsError(res)
        }
        await this.$store.dispatch("wallet/setTotalRewards", total)
      }
    },
    confirmUndelegation() {
      this.confirmUndelegationAsync()
    },
    async confirmUndelegationAsync() {
      if (this.isClientConnected && this.wallet.isWalletUnlocked) {
        if (this.client.isLedgerMode) {
          this.confirmOnLedger = true
        }
        try {
          const res = await this.client.undelegate(
            this.undelegateData.address,
            this.undelegateData.und,
            this.fee,
            "fund",
            this.wallet.address,
            this.undelegateData.memo,
          )

          if (res.status === 200) {
            this.showToast(
              "success",
              "FUND Undelegated Successfully",
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
      this.clearUnDelegateData()
      this.$bvModal.hide("bv-modal-confirm-undelegate-und")
      this.confirmOnLedger = false
    },
    confirmRedelegation() {
      this.confirmRedelegationAsync()
    },
    async confirmRedelegationAsync() {
      if (this.isClientConnected && this.wallet.isWalletUnlocked) {
        if (this.client.isLedgerMode) {
          this.confirmOnLedger = true
        }
        try {
          const res = await this.client.redelegate(
            this.redelegateData.src,
            this.redelegateData.dst,
            this.redelegateData.und,
            this.fee,
            "fund",
            this.wallet.address,
            this.redelegateData.memo,
          )

          if (res.status === 200) {
            this.showToast(
              "success",
              "FUND Redelegated Successfully",
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
      this.clearReDelegateData()
      this.$bvModal.hide("bv-modal-confirm-redelegate-und")
      this.confirmOnLedger = false
    },
    confirmWithdrawReward() {
      this.confirmWithdrawRewardAsync()
    },
    async confirmWithdrawRewardAsync() {
      if (this.isClientConnected && this.wallet.isWalletUnlocked) {
        if (this.client.isLedgerMode) {
          this.confirmOnLedger = true
        }
        try {
          const res = await this.client.withdrawDelegationReward(
            this.withdrawData.address,
            this.fee,
            this.wallet.address,
            this.undelegateData.memo,
          )

          if (res.status === 200) {
            this.showToast(
              "success",
              "Rewards Withdrawn Successfully",
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
      this.confirmOnLedger = false
      this.$bvModal.hide("bv-modal-confirm-withdraw-rewards")
    },
  },
}
</script>
