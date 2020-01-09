<template>
  <div>
    <Modal
    v-show="isConfirmTransferUnd"
    @close="closeConfirmTransferUnd"
    >
      <template v-slot:modalHeader>
        Confirm Transfer
      </template>
      <template v-slot:modalBody>
        <p>Please confirm:</p>
        Sending {{transfer.und}} UND<br>
        To {{transfer.to}}
      </template>
      <template v-slot:modalFooter>
        <button
        type="button"
        class="btn-green"
        @click="transferUnd"
        aria-label="Create"
        >
          Confirm
        </button>
        <button
        type="button"
        class="btn-green"
        @click="closeConfirmTransferUnd"
        aria-label="Close modal"
        >
          Close
        </button>
      </template>
    </Modal>

    Send: <input type="text" v-model="transfer.und" placeholder=""> UND<br>
    To: <input type="text" v-model="transfer.to" placeholder=""><br>
    Memo: <input type="text" v-model="transfer.memo" placeholder=""><br>
    <button @click="showConfirmTransferUnd()">Transfer</button>

  </div>
</template>

<script>
  import Modal from '@/components/Modal.vue'
  import {UND_CONFIG} from '@/constants.js'
  const UndClient = require('@unification-com/und-js')

  export default {
    name: "Transfer",
    components: {
      Modal
    },
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
          memo: 'sent from Unification Web Wallet'
        },
        isConfirmTransferUnd: false,
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
      clearTransfer: function () {
        this.transfer = {
          to: '',
          und: '0',
          memo: 'sent from Unification Web Wallet'
        }
      },
      showConfirmTransferUnd: function() {

        if(!UndClient.crypto.checkAddress(this.transfer.to, UND_CONFIG.BECH32_PREFIX)) {
          this.$bvToast.toast('"' + this.transfer.to + '" is not a valid address', {
            title: 'Error',
            variant: 'danger',
            solid: true,
            autoHideDelay: 10000,
            appendToast: true
          })
          return false
        }
        if(this.transfer.und <= 0 || isNaN(this.transfer.und)) {
          this.$bvToast.toast('Amount must be greater than zero', {
            title: 'Error',
            variant: 'danger',
            solid: true,
            autoHideDelay: 10000,
            appendToast: true
          })
          return false
        }
        this.isConfirmTransferUnd = true
      },
      closeConfirmTransferUnd: function() {
        this.isConfirmTransferUnd = false
      },
      transferUnd: async function() {
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
            let res = await this.clnt.transferUnd(
            this.transfer.to,
            this.transfer.und,
            fee,
            "und",
            this.w.address,
            this.transfer.memo
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

            this.closeConfirmTransferUnd()
            this.clearTransfer()
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