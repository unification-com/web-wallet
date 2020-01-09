<template>
  <div>

    <Modal
    v-show="isConfirmDelegate"
    @close="closeConfirmDelegate"
    >
      <template v-slot:modalHeader>
        Confirm Action {{delegate.action}}
      </template>
      <template v-slot:modalBody>
        <p>Please confirm:</p>
        Amount: {{delegate.und}} UND<br>
        Validator Address {{delegate.address}}
      </template>
      <template v-slot:modalFooter>
        <button
        type="button"
        class="btn-green"
        @click="confirmDelegation"
        aria-label="Create"
        >
          Confirm
        </button>
        <button
        type="button"
        class="btn-green"
        @click="closeConfirmDelegate"
        aria-label="Close modal"
        >
          Close
        </button>
      </template>
    </Modal>

    <ul class="nav nav-tabs nav-justified">

      <li class="nav-item">
        <a class="nav-link" @click.prevent="setActive('delegations')" :class="{ active: isActive('delegations') }"
           href="#transfer">Delegations</a>
      </li>
      <li class="nav-item">
        <a class="nav-link" @click.prevent="setActive('stake')"
           :class="{ active: isActive('stake') }" href="#stake">Stake</a>
      </li>
    </ul>
    <div class="tab-content py-3" id="staking-content">
      <div class="tab-pane fade" :class="{ 'active show': isActive('delegations') }" id="delegations">

      </div>
      <div class="tab-pane fade" :class="{ 'active show': isActive('stake') }" id="stake">

        <h3>Delegate/Undelegate</h3>
        Action <select v-model="delegate.action">
          <option value="delegate">Delegate</option>
          <option value="undelegate">Undelegate</option>
        </select><br>
        Validator Address: <input type="text" v-model="delegate.address" placeholder=""><br>
        Amount: <input type="text" v-model="delegate.und" placeholder=""> UND<br>
        Memo: <input type="text" v-model="delegate.memo" placeholder=""><br>
        <button @click="showConfirmDelegate()">{{delegate.action}} UND</button>
      </div>
    </div>
  </div>
</template>

<script>
  import Modal from '@/components/Modal.vue'
  import {UND_CONFIG} from '@/constants.js'
  const UndClient = require('@unification-com/und-js')

  export default {
    name: "Staking",
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
        activeItem: 'delegations',
        delegate: {
          address: '',
          und: '',
          memo: 'sent from Unification Web Wallet',
          action: 'delegate'
        },
        isConfirmDelegate: false
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
      showConfirmDelegate: function() {
        if(this.delegate.und <= 0 || isNaN(this.delegate.und)) {
          this.$bvToast.toast('Amount must be greater than zero', {
            title: 'Error',
            variant: 'danger',
            solid: true,
            autoHideDelay: 10000,
            appendToast: true
          })
          return false
        }
        if(!UndClient.crypto.checkAddress(this.delegate.address, UND_CONFIG.BECH32_VAL_PREFIX)) {
          this.$bvToast.toast('"' + this.delegate.address + '" is not a valid operator address', {
            title: 'Error',
            variant: 'danger',
            solid: true,
            autoHideDelay: 10000,
            appendToast: true
          })
          return false
        }


        if(this.delegate.action !== 'delegate' && this.delegate.action !== 'undelegate') {
          this.$bvToast.toast('action must be delegate or undelegate', {
            title: 'Error',
            variant: 'danger',
            solid: true,
            autoHideDelay: 10000,
            appendToast: true
          })
          return false
        }

        this.isConfirmDelegate = true
      },
      closeConfirmDelegate: function() {
        this.isConfirmDelegate = false
      },
      clearDelegation: function() {
        this.delegate = {
          address: '',
          und: '',
          memo: 'sent from Unification Web Wallet',
          action: 'delegate'
        }
      },
      confirmDelegation: async function() {
        if (this.clnt !== null && this.w.isWalletUnlocked > 0) {
          let fee = {
            "amount": [
              {
                "denom": "nund",
                "amount": "5000"
              }
            ],
            "gas": "190000"
          }

          try {
            let res = null
            if(this.delegate.action === 'delegate') {
              res = await this.clnt.delegate(
              this.delegate.address,
              this.delegate.und,
              fee,
              "und",
              this.w.address,
              this.delegate.memo
              )
            } else if(this.delegate.action === 'undelegate') {
              res = await this.clnt.undelegate(
              this.delegate.address,
              this.delegate.und,
              fee,
              "und",
              this.w.address,
              this.delegate.memo
              )
            }

            if (res.status === 200) {
              this.$bvToast.toast('Tx hash: ' + res.result.txhash, {
                title: 'Tx successfully broadcast',
                variant: 'success',
                solid: true,
                autoHideDelay: 10000,
                appendToast: true
              })
            }

            this.closeConfirmDelegate()
            this.clearDelegation()
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