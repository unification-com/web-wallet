<template>
  <div>
    <b-modal id="bv-modal-confirm-raise-po">
      <template v-slot:modal-title>
        <h3>Confirm FUND Transfer</h3>
      </template>
      <p>
        Please confirm:<br />
        Raising Purchase Order for {{ po.und }} FUND<br />
        Proof: {{ po.memo }}<br />
        Fee: {{ fee.amount }}nund<br />
        Gas: {{ fee.gas }}
      </p>
      <template v-slot:modal-footer>
        <b-button variant="success" aria-label="Confirm" @click="raisePo">
          Confirm
        </b-button>
        <b-button aria-label="Cancel" @click="$bvModal.hide('bv-modal-confirm-raise-po')">
          Cancel
        </b-button>
      </template>
    </b-modal>

    <b-card no-body>
      <b-tabs pills card>
        <b-tab title="Raise Purchase Order" active>
          <b-card-text>
            <h3>Raise a New Enterprise Purchase Order</h3>

            <div v-show="wallet.entWhitelisted" id="raise-po-form">
              <b-form @submit.prevent="preventSubmit">
                <b-form-group
                  id="po-und-label"
                  label="Raise Purchase Order for:"
                  label-for="po-und"
                  description="Amount of Enterprise FUND to raise purchase order for"
                >
                  <b-input-group append="FUND">
                    <b-form-input
                      id="po-und"
                      v-model="po.und"
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
                  id="po-memo-label"
                  label="Proof:"
                  label-for="po-memo"
                  description="Proof of Purchase, e.g. Receipt ID"
                >
                  <b-form-input
                    id="po-memo"
                    v-model="po.memo"
                    type="text"
                    trim
                    required
                    @keydown.enter.prevent="preventSubmit"
                  />
                </b-form-group>

                <b-form-group
                  v-show="isShowFee"
                  id="enterprise-fee-amount-label"
                  label="Fee:"
                  label-for="enterprise-fee-amount"
                  description="Fees in nund"
                >
                  <b-input-group append="nund">
                    <b-form-input
                      id="enterprise-fee-amount"
                      v-model="fee.amount"
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
                  id="enterprise-fee-gas-label"
                  label="Gas:"
                  label-for="enterprise-fee-gas"
                  description="Gas"
                >
                  <b-form-input
                    id="enterprise-fee-gas"
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

                <b-form-checkbox id="enterprise-show-fee" v-model="isShowFee" name="enterprise-show-fee">
                  Manually set Fees
                </b-form-checkbox>
                <b-button variant="success" :disabled="!formState" @click="showConfirmRaisePo()">
                  Raise Purchase Order
                </b-button>
              </b-form>
            </div>
            <div v-show="!wallet.entWhitelisted" id="raise-po-no-whitelist">
              <p>
                <b>Sorry!</b> Your wallet address is not currently authorised to raise Enterprise Purchase
                orders.
              </p>
            </div>
          </b-card-text>
        </b-tab>
        <b-tab title="View Purchase Orders" @click.prevent="getPurchaseOrders()">
          <b-card-text>
            <b-container class="bv-example-row">
              <b-row>
                <b-col>
                  <h3>Previous Purchase Orders</h3>
                </b-col>
                <b-col>
                  <b-button @click="getPurchaseOrders()">
                    Refresh
                  </b-button>
                </b-col>
              </b-row>
            </b-container>

            <div v-show="isDataLoading">
              <b-spinner style="width: 3rem; height: 3rem;" label="Large Spinner" />
            </div>

            <div v-show="!isDataLoading">
              <b-list-group id="po-list">
                <b-list-group-item v-for="po in pos" :key="po.id">
                  <PurchaseOrder :po="po" />
                </b-list-group-item>
              </b-list-group>
            </div>
          </b-card-text>
        </b-tab>
      </b-tabs>
    </b-card>
  </div>
</template>

<script>
import { mapState } from "vuex"
import PurchaseOrder from "./PurchaseOrder.vue"
import { UND_CONFIG } from "../../constants"

export default {
  name: "Enterprise",
  components: {
    PurchaseOrder,
  },
  data() {
    return {
      activeItem: "raise",
      po: {
        und: "0",
        memo: "",
      },
      pos: [],
      fee: { ...UND_CONFIG.DEFAULT_RAISE_PO_FEE },
      isDataLoading: false,
      isShowFee: false,
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
      return this.isValidAmount(this.po.und)
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
    clearPo() {
      this.po = null
      this.fee = null
      this.po = {
        und: "0",
        memo: "",
      }
      this.fee = { ...UND_CONFIG.DEFAULT_RAISE_PO_FEE }
      this.isShowFee = false
    },
    async getPurchaseOrders() {
      this.pos = []
      this.isDataLoading = true
      if (this.isClientConnected && this.wallet.isWalletUnlocked > 0) {
        const res = await this.client.getEnteprisePos()
        if (res.status === 200) {
          this.pos = res.result.result
        } else {
          this.handleUndJsError(res)
        }
      }
      this.isDataLoading = false
    },
    showConfirmRaisePo() {
      if (this.po.und <= 0 || Number.isNaN(this.po.und)) {
        this.showToast("error", "Error", "Amount must be greater than zero")
        return false
      }
      if (!this.isValidAmount(this.po.und)) {
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
      if (!this.isValidFee(this.fee)) {
        this.showToast("error", "Error", "invalid fees")
        return false
      }
      if (!this.isValidGas(this.fee.gas)) {
        this.showToast("error", "Error", "invalid gas amount")
        return false
      }
      if (this.po.memo.length > 100) {
        this.showToast("error", "Error", "proof/receipt too long > 100 characters")
        return false
      }

      this.$bvModal.show("bv-modal-confirm-raise-po")
      return true
    },
    async raisePo() {
      if (this.isClientConnected && this.wallet.isWalletUnlocked > 0) {
        try {
          const res = await this.client.raiseEnterprisePO(
            this.po.und,
            this.fee,
            "fund",
            this.wallet.address,
            this.po.memo,
          )

          if (res.status === 200) {
            this.showToast("success", "Success", `Tx hash: ${res.result.txhash}`)
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

      this.$bvModal.hide("bv-modal-confirm-raise-po")
      this.clearPo()
    },
  },
}
</script>
