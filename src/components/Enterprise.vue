<template>
  <div>
    <b-modal id="bv-modal-confirm-raise-po">
      <template v-slot:modal-title>
        <h3>Confirm UND Transfer</h3>
      </template>
      <p>
        Please confirm:<br>
        Raising Purchase Order for {{po.und}} UND<br>
        Proof: {{po.memo}}<br>
        Fee: {{fee.amount[0].amount}}nund<br>
        Gas: {{fee.gas}}
      </p>
      <template v-slot:modal-footer>
        <b-button
        variant="success"
        @click="raisePo"
        aria-label="Confirm"
        >
          Confirm
        </b-button>
        <b-button
        @click="$bvModal.hide('bv-modal-confirm-raise-po')"
        aria-label="Cancel"
        >
          Cancel
        </b-button>
      </template>
    </b-modal>

    <b-card no-body>
      <b-tabs pills card>
        <b-tab title="Raise Purchase Order" active>
          <b-card-text>
            <h3>Raise a New Enterprise Purchase Order</h3>

            <b-form @submit.prevent="preventSubmit">
              <b-form-group
              id="po-und-label"
              label="Raise Purchase Order for:"
              label-for="po-und"
              description="Amount of Enterprise UND to raise purchase order for"
              >
                <b-input-group append="UND">
                  <b-form-input
                  id="po-und"
                  v-model="po.und"
                  type="text"
                  required
                  v-on:keydown.enter.prevent="preventSubmit"
                  />
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
                v-on:keydown.enter.prevent="preventSubmit"
                />
              </b-form-group>

              <b-form-group
              id="enterprise-fee-amount-label"
              label="Fee:"
              label-for="enterprise-fee-amount"
              description="Fees in nund"
              v-show="isShowFee"
              >
                <b-input-group append="nund">
                  <b-form-input
                  id="enterprise-fee-amount"
                  v-model="fee.amount[0].amount"
                  type="text"
                  trim
                  v-on:keydown.enter.prevent="preventSubmit"
                  />
                </b-input-group>
              </b-form-group>
              <b-form-group
              id="enterprise-fee-gas-label"
              label="Gas:"
              label-for="enterprise-fee-gas"
              description="Gas"
              v-show="isShowFee"
              >
                <b-form-input
                id="enterprise-fee-gas"
                v-model="fee.gas"
                type="text"
                trim
                v-on:keydown.enter.prevent="preventSubmit"
                />
              </b-form-group>

              <b-form-checkbox
              id="enterprise-show-fee"
              v-model="isShowFee"
              name="enterprise-show-fee"
              >
                Manually set Fees
              </b-form-checkbox>
              <b-button variant="success" @click="showConfirmRaisePo()">Raise Ourchse Order</b-button>
            </b-form>
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
                  <b-button @click="getPurchaseOrders()">Refresh</b-button>
                </b-col>
              </b-row>
            </b-container>

            <div v-show="isDataLoading">
              <b-spinner style="width: 3rem; height: 3rem;" label="Large Spinner"/>
            </div>

            <div v-show="!isDataLoading">
              <b-list-group id="po-list">
                <b-list-group-item v-for="po in pos" v-bind:key="po.id">
                  <PurchaseOrder v-bind:po="po"/>
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
  import PurchaseOrder from '@/components/PurchaseOrder.vue'

  const UndClient = require('@unification-com/und-js')

  export default {
    name: "Enterprise",
    components: {
      PurchaseOrder
    },
    props: {
      client: Object,
      wallet: Object
    },
    data: function () {
      return {
        clnt: this.client,
        w: this.wallet,
        activeItem: 'raise',
        po: {
          und: '0',
          memo: ''
        },
        pos: [],
        defaultFee: {
          amount: [
            {
              denom: "nund",
              amount: "2500"
            }
          ],
          gas: "90000"
        },
        fee: {
          amount: [
            {
              denom: "nund",
              amount: "2500"
            }
          ],
          gas: "90000"
        },
        isDataLoading: false,
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
      clearPo: function () {
        this.po = {
          und: '0',
          memo: ''
        }
        this.fee = this.defaultFee
        this.isShowFee = false
      },
      getPurchaseOrders: async function () {
        this.pos = []
        this.isDataLoading = true
        if (this.clnt !== null && this.w.isWalletUnlocked > 0) {
          let res = await this.clnt.getEnteprisePos()
          if (res.status === 200) {
            this.pos = res.result.result
          }
        }
        this.isDataLoading = false
      },
      showConfirmRaisePo: function () {

        if (this.po.und <= 0 || isNaN(this.po.und)) {
          this.$bvToast.toast('Amount must be greater than zero', {
            title: 'Error',
            variant: 'danger',
            solid: true,
            autoHideDelay: 10000,
            appendToast: true
          })
          return false
        }
        this.$bvModal.show('bv-modal-confirm-raise-po')
      },
      raisePo: async function () {

        if (this.clnt !== null && this.w.isWalletUnlocked > 0) {

          try {
            let res = await this.clnt.raiseEnterprisePO(
            this.po.und,
            this.fee,
            "und",
            this.w.address,
            this.po.memo
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
          this.$bvToast.toast("Client not connected or wallet not unlocked. Please reload", {
            title: 'Error',
            variant: 'danger',
            solid: true,
            autoHideDelay: 10000,
            appendToast: true
          })
        }

        this.$bvModal.hide('bv-modal-confirm-raise-po')
        this.clearPo()
      }
    }
  }
</script>
