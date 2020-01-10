<template>
  <div>

    <!-- delegate UND confirmation modal -->
    <b-modal id="bv-modal-confirm-delegate-und">
      <template v-slot:modal-title>
        <h3>Confirm Delegate UND</h3>
      </template>
      <p>Please confirm delegation:</p>
      Amount: <span class="text-info">{{delegateData.und}} UND</span><br>
      Validator: {{getValidatorMoniker(delegateData.address)}}<br>
      Fee: {{fee.amount[0].amount}}nund<br>
      Gas: {{fee.gas}}
      <template v-slot:modal-footer>
        <b-button
        variant="success"
        @click="confirmDelegation"
        aria-label="Confirm"
        >
          Confirm
        </b-button>
        <b-button
        @click="$bvModal.hide('bv-modal-confirm-delegate-und')"
        aria-label="Cancel"
        >
          Cancel
        </b-button>
      </template>
    </b-modal>

    <!-- undelegate modal -->
    <b-modal id="bv-modal-undelegate-und">
      <template v-slot:modal-title>
        <h3>Undelegate UND</h3>
      </template>
        <b-form-group
        id="undelegate-und-label"
        label="Undelegate:"
        label-for="undelegate-und"
        description="Amount of UND to undelegate"
        >
          <b-input-group append="UND">
            <b-form-input
            id="undelegate-und"
            v-model="undelegateData.und"
            type="text"
            required
            />
          </b-input-group>
        </b-form-group>
        <b-form-group
        id="undelegate-from-label"
        label="From:"
        label-for="undelegate-from"
        description="Address to undelegate from"
        >
          <b-form-input
          id="undelegate-from"
          v-model="undelegateData.address"
          type="text"
          required
          />
        </b-form-group>

        <b-form-group
        id="undelegate-fee-amount-label"
        label="Fee:"
        label-for="undelegate-fee-amount"
        description="Fees in nund"
        v-show="isShowFee"
        >
          <b-input-group append="nund">
            <b-form-input
            id="undelegate-fee-amount"
            v-model="fee.amount[0].amount"
            type="text"
            trim
            />
          </b-input-group>
        </b-form-group>
        <b-form-group
        id="undelegate-fee-gas-label"
        label="Gas:"
        label-for="undelegate-fee-gas"
        description="Gas"
        v-show="isShowFee"
        >
          <b-form-input
          id="undelegate-fee-gas"
          v-model="fee.gas"
          type="text"
          trim
          />
        </b-form-group>

        <b-form-checkbox
        id="undelegate-show-fee"
        v-model="isShowFee"
        name="undelegate-show-fee"
        >
          Manually set Fees
        </b-form-checkbox>
      <p>
        <b>(maximum {{undelegateData.max}}UND)</b><br>
        <b>Note:</b> outstanding rewards will automatically be withdrawn during undelegation
      </p>
      <template v-slot:modal-footer>
        <b-button
        variant="success"
        @click="showConfirmUnDelegation"
        aria-label="Create"
        >
          Undelegate
        </b-button>
        <b-button
        @click="$bvModal.hide('bv-modal-undelegate-und')"
        aria-label="Cancel"
        >
          Cancel
        </b-button>
      </template>
    </b-modal>

    <!-- confirm undelegate modal -->
    <b-modal id="bv-modal-confirm-undelegate-und">
      <template v-slot:modal-title>
        <h3>Confirm Undelegate UND</h3>
      </template>
      Undelegate <span class="text-info">{{ undelegateData.und }}UND</span>
      from {{getValidatorMoniker(undelegateData.address)}}?<br>
      Fee: {{fee.amount[0].amount}}nund<br>
      Gas: {{fee.gas}}
      <template v-slot:modal-footer>
        <b-button
        variant="success"
        @click="confirmUndelegation"
        aria-label="Create"
        >
          Confirm
        </b-button>
        <b-button
        @click="$bvModal.hide('bv-modal-confirm-undelegate-und')"
        aria-label="Cancel"
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
      Withdraw <span class="text-info">{{ withdrawData.und }} UND</span><br>
      from {{getValidatorMoniker(withdrawData.address)}}<br><br>
      Fee: {{fee.amount[0].amount}}nund<br>
      Gas: {{fee.gas}}
      <b-form-group
      id="withdraw-fee-amount-label"
      label="Fee:"
      label-for="withdraw-fee-amount"
      description="Fees in nund"
      v-show="isShowFee"
      >
        <b-input-group append="nund">
          <b-form-input
          id="withdraw-fee-amount"
          v-model="fee.amount[0].amount"
          type="text"
          trim
          />
        </b-input-group>
      </b-form-group>
      <b-form-group
      id="withdraw-fee-gas-label"
      label="Gas:"
      label-for="withdraw-fee-gas"
      description="Gas"
      v-show="isShowFee"
      >
        <b-form-input
        id="withdraw-fee-gas"
        v-model="fee.gas"
        type="text"
        trim
        />
      </b-form-group>

      <b-form-checkbox
      id="withdraw-show-fee"
      v-model="isShowFee"
      name="withdraw-show-fee"
      >
        Manually set Fees
      </b-form-checkbox>
      <template v-slot:modal-footer>
        <b-button
        variant="success"
        @click="confirmWithdrawReward"
        aria-label="Create"
        >
          Confirm
        </b-button>
        <b-button
        @click="$bvModal.hide('bv-modal-confirm-withdraw-rewards')"
        aria-label="Cancel"
        >
          Cancel
        </b-button>
      </template>
    </b-modal>

    <b-card no-body>
      <b-tabs pills card>
        <b-tab title="Delegations" active @click.prevent="getDelegations()">
          <b-card-text>
            <b-container class="bv-example-row">
              <b-row>
                <b-col>
                  <h3>Current Delegations and Rewards</h3>
                </b-col>
                <b-col>
                  <b-button @click="getDelegations()">Refresh</b-button>
                </b-col>
              </b-row>
            </b-container>

            <div v-show="isDataLoading">
              <b-spinner style="width: 3rem; height: 3rem;" label="Large Spinner"/>
            </div>

            <div v-show="!isDataLoading">
              <b-table :items="delegations" :fields="delegationsFields" striped responsive="sm">

                <template v-slot:cell(show_details)="row">
                  <b-button size="sm" @click="row.toggleDetails" class="mr-2">
                    {{ row.detailsShowing ? 'Hide' : 'Show'}} Details
                  </b-button>
                </template>
                <template v-slot:row-details="row">
                  <b-card>
                    <b-row class="mb-2">
                      <b-col sm="3" class="text-sm-right"><b>Moniker:</b></b-col>
                      <b-col>{{ row.item.description.moniker }}</b-col>
                    </b-row>
                    <b-row class="mb-2">
                      <b-col sm="3" class="text-sm-right"><b>Address:</b></b-col>
                      <b-col>{{ row.item.validator_address }}</b-col>
                    </b-row>
                    <b-row class="mb-2">
                      <b-col sm="3" class="text-sm-right"><b>Identity:</b></b-col>
                      <b-col>{{ row.item.description.identity }}</b-col>
                    </b-row>
                    <b-row class="mb-2">
                      <b-col sm="3" class="text-sm-right"><b>Website:</b></b-col>
                      <b-col>{{ row.item.description.website }}</b-col>
                    </b-row>
                    <b-row class="mb-2">
                      <b-col sm="3" class="text-sm-right"><b>Security Contact:</b></b-col>
                      <b-col>{{ row.item.description.security_contact }}</b-col>
                    </b-row>
                    <b-row class="mb-2">
                      <b-col sm="3" class="text-sm-right"><b>Details:</b></b-col>
                      <b-col>{{ row.item.description.details }}</b-col>
                    </b-row>
                    <b-button variant="danger" size="sm" @click="initUndelegate(row.item)" class="mr-2">
                      Undelegate
                    </b-button>
                    <b-button variant="success" size="sm" @click="showConfirmWithdraw(row.item)" class="mr-2">
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
                <template v-slot:cell(stake)="data">
                  <b class="text-info">{{ formatAmount(data.value)}}</b>
                </template>
                <template v-slot:cell(rewards)="data">
                  <b class="text-info">{{ formatAmount(data.value)}}</b>
                </template>
              </b-table>
            </div>
          </b-card-text>
        </b-tab>
        <b-tab title="Stake" @click.prevent="getDelegations()">
          <b-card-text>
            <h3>Stake UND</h3>

            <div v-show="isDataLoading">
              <b-spinner style="width: 3rem; height: 3rem;" label="Large Spinner"/>
            </div>

            <div v-show="!isDataLoading">
              <b-form v-on:@submit.prevent="false">
                <b-form-group
                id="delegate-node-label"
                label="Select Existing Validator:"
                label-for="delegate-node"
                description="Select an existing validator"
                >
                  <b-form-select id="delegate-node" v-model="delegateData.address" :options="validatorsSelect"/>
                </b-form-group>
              </b-form>

              <b-form v-on:@submit.prevent="false">
                <b-form-group
                id="delegate-manual-node-label"
                label="Or Manually Enter Validator:"
                label-for="delegate-manual-node"
                description="Alternatively, enter a validator address manually (note - this starts with undvaloper)"
                >
                  <b-form-input
                  id="delegate-manual-node"
                  v-model="delegateData.address"
                  type="text"
                  required
                  />
                </b-form-group>

                <b-form-group
                id="delegate-und-label"
                label="Amount:"
                label-for="delegate-und"
                description="Amount of UND to delegate"
                >
                  <b-input-group append="UND">
                    <b-form-input
                    id="delegate-und"
                    v-model="delegateData.und"
                    type="text"
                    required
                    placeholder=""
                    />
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
                  />
                </b-form-group>

                <b-form-group
                id="delegate-fee-amount-label"
                label="Fee:"
                label-for="delegate-fee-amount"
                description="Fees in nund"
                v-show="isShowFee"
                >
                  <b-input-group append="nund">
                    <b-form-input
                    id="delegate-fee-amount"
                    v-model="fee.amount[0].amount"
                    type="text"
                    trim
                    />
                  </b-input-group>
                </b-form-group>
                <b-form-group
                id="delegate-fee-gas-label"
                label="Gas:"
                label-for="delegate-fee-gas"
                description="Gas"
                v-show="isShowFee"
                >
                  <b-form-input
                  id="delegate-fee-gas"
                  v-model="fee.gas"
                  type="text"
                  trim
                  />
                </b-form-group>

                <b-form-checkbox
                id="delegate-show-fee"
                v-model="isShowFee"
                name="delegate-show-fee"
                >
                  Manually set Fees
                </b-form-checkbox>

                <b-button variant="success" @click="showConfirmDelegate()">Delegate UND</b-button>
              </b-form>
              <br>
              <b>Note:</b> outstanding rewards will automatically be withdrawn during delegation
            </div>
          </b-card-text>
        </b-tab>
      </b-tabs>
    </b-card>
  </div>
</template>

<script>
  import {UND_CONFIG} from '@/constants.js'

  const UndClient = require('@unification-com/und-js')

  export default {
    name: "Staking",
    props: {
      client: Object,
      wallet: Object
    },
    data: function () {
      return {
        clnt: this.client,
        w: this.wallet,
        activeItem: 'delegations',
        delegateData: {
          address: '',
          und: '',
          memo: UND_CONFIG.DEFAULT_MEMO
        },
        undelegateData: {
          address: '',
          und: '',
          max: '',
          memo: UND_CONFIG.DEFAULT_MEMO
        },
        withdrawData: {
          address: '',
          und: ''
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
              amount: "5000"
            }
          ],
          gas: "190000"
        },
        validators: {},
        validatorsSelect: [],
        delegations: [],
        delegationsFields: ['name', 'shares', 'stake', 'rewards', 'show_details'],
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
      showConfirmDelegate: function () {
        if (this.delegateData.und <= 0 || isNaN(this.delegateData.und)) {
          this.$bvToast.toast('Amount must be greater than zero', {
            title: 'Error',
            variant: 'danger',
            solid: true,
            autoHideDelay: 10000,
            appendToast: true
          })
          return false
        }
        if (this.delegateData.und >= this.w.balance) {
          this.$bvToast.toast('cannot delegate more than your balance', {
            title: 'Error',
            variant: 'danger',
            solid: true,
            autoHideDelay: 10000,
            appendToast: true
          })
          return false
        }
        if (!UndClient.crypto.checkAddress(this.delegateData.address, UND_CONFIG.BECH32_VAL_PREFIX)) {
          this.$bvToast.toast('"' + this.delegateData.address + '" is not a valid operator address', {
            title: 'Error',
            variant: 'danger',
            solid: true,
            autoHideDelay: 10000,
            appendToast: true
          })
          return false
        }
        this.$bvModal.show('bv-modal-confirm-delegate-und')
      },
      showConfirmUnDelegation: function () {
        if (this.undelegateData.und <= 0 || isNaN(this.undelegateData.und) || this.undelegateData.und > this.undelegateData.max) {
          this.$bvToast.toast('Amount must be greater than zero, and less than ' + this.undelegateData.max + 'UND', {
            title: 'Error',
            variant: 'danger',
            solid: true,
            autoHideDelay: 10000,
            appendToast: true
          })
          return false
        }
        if (!UndClient.crypto.checkAddress(this.undelegateData.address, UND_CONFIG.BECH32_VAL_PREFIX)) {
          this.$bvToast.toast('"' + this.undelegateData.address + '" is not a valid operator address', {
            title: 'Error',
            variant: 'danger',
            solid: true,
            autoHideDelay: 10000,
            appendToast: true
          })
          return false
        }
        this.$bvModal.hide('bv-modal-undelegate-und')
        this.$bvModal.show('bv-modal-confirm-undelegate-und')
      },
      showConfirmWithdraw: function (item) {
        this.clearWithdrawData()
        this.withdrawData.address = item.validator_address
        this.withdrawData.und = this.nundToUnd(item.rewards)
        this.$bvModal.show('bv-modal-confirm-withdraw-rewards')
      },
      clearDelegateData: function () {
        this.delegateData = {
          address: '',
          und: '',
          memo: UND_CONFIG.DEFAULT_MEMO
        }
        this.fee = this.defaultFee
        this.isShowFee = false
      },
      clearUnDelegateData: function () {
        this.undelegateData = {
          address: '',
          und: '',
          max: '',
          memo: UND_CONFIG.DEFAULT_MEMO
        }
        this.fee = this.defaultFee
        this.isShowFee = false
      },
      clearWithdrawData: function () {
        this.withdrawData = {
          address: '',
          und: ''
        }
        this.fee = this.defaultFee
        this.isShowFee = false
      },
      initUndelegate: function (item) {
        this.clearUnDelegateData()
        this.undelegateData.address = item.validator_address
        this.undelegateData.max = this.nundToUnd(item.stake)
        this.$bvModal.show('bv-modal-undelegate-und')
      },
      clientError: function () {
        this.$bvToast.toast("Client not connected or wallet not unlocked. Please reload", {
          title: 'Error',
          variant: 'danger',
          solid: true,
          autoHideDelay: 10000,
          appendToast: true
        })
      },
      getValidatorMoniker: function (validatorAddress) {
        let moniker = validatorAddress
        if (validatorAddress in this.validators) {
          moniker = this.validators[validatorAddress]['description']['moniker']
        }
        return moniker
      },
      getValidatorDescription: function (validatorAddress) {
        let description = {
          moniker: '',
          identity: '',
          website: '',
          security_contact: '',
          details: '',
        }
        if (validatorAddress in this.validators) {
          description = this.validators[validatorAddress]['description']
        }
        return description
      },
      getValidators: async function () {
        this.validators = {}
        this.validatorsSelect = []
        if (this.clnt !== null && this.w.isWalletUnlocked) {
          let res = await this.clnt.getValidators()
          if (res.status === 200) {
            for (let i = 0; i < res.result.result.length; i++) {
              this.validators[res.result.result[i].operator_address] = res.result.result[i]
              let valOption = {
                value: res.result.result[i].operator_address,
                text: res.result.result[i].description.moniker
              }
              this.validatorsSelect.push(valOption)
            }
          }
        }
      },
      getDelegations: async function () {
        this.delegations = []
        if (this.clnt !== null && this.w.isWalletUnlocked) {
          this.isDataLoading = true
          await this.getValidators()
          let res = await this.clnt.getDelegations()
          if (res.status === 200) {
            for (let i = 0; i < res.result.result.length; i++) {
              let moniker = ''
              let validator_address = res.result.result[i].validator_address
              if (validator_address in this.validators) {
                moniker = this.validators[validator_address]['description']['moniker']
              }

              let del = {
                name: moniker,
                validator_address: validator_address,
                shares: res.result.result[i].shares,
                stake: res.result.result[i].balance.amount,
                rewards: await this.getRewards(validator_address),
                description: this.getValidatorDescription(validator_address)
              }

              this.delegations.push(del)
            }
          }
          this.isDataLoading = false
        }
      },
      getRewards: async function (valAddress) {
        let rewards = '0'
        if (this.clnt !== null && this.w.isWalletUnlocked) {
          let res = await this.clnt.getDelegatorRewards(this.w.address, valAddress)
          if (res.status === 200 && res.result.result.length > 0) {
            rewards = res.result.result[0].amount
          }
        }
        return rewards
      },
      confirmDelegation: function () {
        this.confirmDelegationAsync()
      },
      confirmDelegationAsync: async function () {
        if (this.clnt !== null && this.w.isWalletUnlocked) {
          try {
            let res = await this.clnt.delegate(
            this.delegateData.address,
            this.delegateData.und,
            this.fee,
            "und",
            this.w.address,
            this.delegateData.memo
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
          this.clientError()
        }
        this.clearDelegateData()
        this.$bvModal.hide('bv-modal-confirm-delegate-und')
      },
      confirmUndelegation: function () {
        this.confirmUndelegationAsync()
      },
      confirmUndelegationAsync: async function () {
        if (this.clnt !== null && this.w.isWalletUnlocked) {

          try {
            let res = await this.clnt.undelegate(
            this.undelegateData.address,
            this.undelegateData.und,
            this.fee,
            "und",
            this.w.address,
            this.undelegateData.memo
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
          this.clientError()
        }
        this.clearUnDelegateData()
        this.$bvModal.hide('bv-modal-confirm-undelegate-und')
      },
      confirmWithdrawReward: function () {
        this.confirmWithdrawRewardAsync()
      },
      confirmWithdrawRewardAsync: async function () {
        if (this.clnt !== null && this.w.isWalletUnlocked) {
          try {
            let res = await this.clnt.withdrawDelegationReward(
            this.withdrawData.address,
            this.fee,
            this.w.address,
            this.undelegateData.memo
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
          this.clientError()
        }
        this.$bvModal.hide('bv-modal-confirm-withdraw-rewards')
      }
    }
  }
</script>
