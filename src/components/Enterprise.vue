<template>
  <div>
    <Modal
    v-show="isConfirmRaisePo"
    @close="closeConfirmRaisePo"
    >
      <template v-slot:modalHeader>
        Confirm Raise Purchase Order
      </template>
      <template v-slot:modalBody>
        <p>Please confirm:</p>
        Raising Purchase Order for {{po.und}} UND<br>
      </template>
      <template v-slot:modalFooter>
        <button
        type="button"
        class="btn-green"
        @click="raisePo"
        aria-label="Create"
        >
          Confirm
        </button>
        <button
        type="button"
        class="btn-green"
        @click="closeConfirmRaisePo"
        aria-label="Close modal"
        >
          Close
        </button>
      </template>
    </Modal>

    <ul class="nav nav-tabs nav-justified">
      <li class="nav-item">
        <a class="nav-link" @click.prevent="setActive('raise')"
           :class="{ active: isActive('raise') }" href="#raise">Raise Purchase Order</a>
      </li>

      <li class="nav-item">
        <a class="nav-link" @click.prevent="setActive('view'), getPurchaseOrders()"
           :class="{ active: isActive('view') }" href="#view">View Purchase Orders</a>
      </li>
    </ul>
    <div class="tab-content py-3" id="enterprise-content">
      <div class="tab-pane fade" :class="{ 'active show': isActive('raise') }" id="raise">
        Raise Purchase Order for: <input type="text" v-model="po.und" placeholder=""> UND<br>
        Memo: <input type="text" v-model="po.memo" placeholder="proof of purchase"><br>
        <button @click="showConfirmRaisePo()">Raise Ourchse Order</button>
      </div>
      <div class="tab-pane fade" :class="{ 'active show': isActive('view') }" id="view">
        <button @click="getPurchaseOrders()">Refresh</button>
        <p>Previous Purchase Orders</p>

        <ul id="po-list">
          <li v-for="po in pos">
            <PurchaseOrder v-bind:po="po"/>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
  import Modal from '@/components/Modal.vue'
  import PurchaseOrder from '@/components/PurchaseOrder.vue'
  const UndClient = require('@unification-com/und-js')

  export default {
    name: "Enterprise",
    components: {
      Modal,
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
        isConfirmRaisePo: false,
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
      clearPo: function () {
        this.po = {
          und: '0',
          memo: ''
        }
      },
      getPurchaseOrders: async function() {
        this.pos = []
        if (this.clnt !== null && this.w.isWalletUnlocked > 0) {
          let res = await this.clnt.getEnteprisePos()
          if (res.status === 200) {
            this.pos = res.result.result
          }
        }
      },
      showConfirmRaisePo: function() {

        if(this.po.und <= 0 || isNaN(this.po.und)) {
          this.$bvToast.toast('Amount must be greater than zero', {
            title: 'Error',
            variant: 'danger',
            solid: true,
            autoHideDelay: 10000,
            appendToast: true
          })
          return false
        }
        this.isConfirmRaisePo = true
      },
      closeConfirmRaisePo: function() {
        this.isConfirmRaisePo = false
      },
      raisePo: async function() {

        if (this.clnt !== null && this.w.isWalletUnlocked > 0) {
          let fee = {
            "amount": [
              {
                "denom": "nund",
                "amount": "2500"
              }
            ],
            "gas": "90000"
          }

          try {
            let res = await this.clnt.raiseEnterprisePO(
            this.po.und,
            fee,
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

            this.closeConfirmRaisePo()
            this.clearPo()
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
      }
    }
  }
</script>

<style scoped>

</style>