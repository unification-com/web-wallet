<template>
  <div>
    <span class="badge badge-success" v-show="!fullTx.txSummary.isSent && fullTx.txSummary.txSuccess" style=" margin-right:5px;">
      <b-icon-download style="width:20px; height:20px"/>
    </span>
    <span class="badge badge-warning" v-show="fullTx.txSummary.isSent && fullTx.txSummary.txSuccess" style=" margin-right:5px;">
      <b-icon-upload style="width:20px; height:20px"/>
    </span>
    <span class="badge badge-danger" v-show="!fullTx.txSummary.txSuccess && fullTx.txData !== null" style=" margin-right:5px;">
      <b-icon-alert-triangle style="width:20px; height:20px" />
    </span>

    <span class="badge badge-info" v-show="fullTx.txData === null" style=" margin-right:5px;">
      <b-icon-info style="width:20px; height:20px" />
    </span>
    <span>{{fullTx.txSummary.txhash}}</span><br/>
    <div>
      <span v-show="fullTx.txSummary.txSuccess === false">
      <b-badge variant="danger">FAILED</b-badge> to
    </span>
      <span :class="badge">{{ action }}</span>
      <span v-html="formatted">
    </span>
      <div v-show="fullTx.txSummary.txSuccess === false">
        <span class="text-danger">Reason: {{ fullTx.txSummary.parsedErrorMsg }}</span>
      </div>
    </div>
  </div>
</template>

<script>
  import {mapGetters} from 'vuex'

  export default {
    name: 'Tx',
    computed: {
      ...mapGetters('validators', [
        'getValidatorMoniker',
      ])
    },
    props: {
      tx: Object
    },
    data: function () {
      return {
        fullTx: this.tx,
        formatted: '',
        action: '',
        badge: 'badge badge-info'
      }
    },
    watch: {
      tx: function (val) {
        this.fullTx = val
        this.formatMsg()
      }
    },
    mounted() {
      this.formatMsg()
    },
    methods: {
      // Todo - missing Msgs
      formatMsg: function () {
        if (this.fullTx.txData === null) {
          this.action = "Pending"
          this.badge = 'badge badge-info'
          this.formatted = '...'
        } else {
          const msg = this.fullTx.txData.tx.value.msg[0]
          switch (msg.type) {
            case 'cosmos-sdk/MsgSend':
              if(this.fullTx.txSummary.txSuccess === false) {
                this.action = "Send"
              } else {
                this.action = "Sent"
              }

              this.badge = 'badge badge-transfer'
              this.formatMsgSend(msg.value)
              break
            case 'cosmos-sdk/MsgDelegate':
              if(this.fullTx.txSummary.txSuccess === false) {
                this.action = "Delegate"
              } else {
                this.action = "Delegated"
              }

              this.badge = 'badge badge-staking'
              this.formatMsgDelegate(msg.value)
              break
            case 'cosmos-sdk/MsgUndelegate':
              if(this.fullTx.txSummary.txSuccess === false) {
                this.action = "Undelegate"
              } else {
                this.action = "Undelegated"
              }

              this.badge = 'badge badge-staking'
              this.formatMsgUnDelegate(msg.value)
              break
            case 'cosmos-sdk/MsgBeginRedelegate':
              if(this.fullTx.txSummary.txSuccess === false) {
                this.action = "Redelegate"
              } else {
                this.action = "Redelegated"
              }

              this.badge = 'badge badge-staking'
              this.formatMsgBeginRedelegate(msg.value)
              break
            case 'cosmos-sdk/MsgWithdrawValidatorCommission':
              if(this.fullTx.txSummary.txSuccess === false) {
                this.action = "Withdraw Validator Commision"
              } else {
                this.action = "Withdrew Validator Commision"
              }

              this.badge = 'badge badge-staking'

              this.formatted = '' // Todo
              break
            case 'cosmos-sdk/MsgWithdrawDelegationReward':
              if(this.fullTx.txSummary.txSuccess === false) {
                this.action = "Withdraw Delegation Reward"
              } else {
                this.action = "Withdrew Delegation Reward"
              }

              this.badge = 'badge badge-staking'
              this.formatMsgWithdrawDelegationReward(msg.value)
              break
            case 'cosmos-sdk/MsgModifyWithdrawAddress':
              if(this.fullTx.txSummary.txSuccess === false) {
                this.action = "Modify Withdraw Address"
              } else {
                this.action = "Modified Withdraw Address"
              }

              this.badge = 'badge badge-staking'
              this.formatted = '' // Todo
              break
            case 'cosmos-sdk/MsgUnjail':
              this.formatted = '' // Todo
              break
            case 'enterprise/PurchaseUnd':
              if(this.fullTx.txSummary.txSuccess === false) {
                this.action = "Raise Enterprise Purchase Order"
              } else {
                this.action = "Raised Enterprise Purchase Order"
              }

              this.badge = 'badge badge-enterprise'
              this.formatPurchaseUnd(msg.value)
              break
            case 'enterprise/ProcessUndPurchaseOrder':
              if(this.fullTx.txSummary.txSuccess === false) {
                this.action = "Process UND Enterprise Purchase Order"
              } else {
                this.action = "Processed UND Enterprise Purchase Order"
              }

              this.badge = 'badge badge-enterprise'

              this.formatted = '' // Todo
              break
            case 'wrkchain/RegisterWrkChain':
              if(this.fullTx.txSummary.txSuccess === false) {
                this.action = "Register WRKChain"
              } else {
                this.action = "Registered WRKChain"
              }

              this.badge = 'badge badge-wrkchain'
              this.formatted = '' // Todo
              break
            case 'wrkchain/RecordWrkChainBlock':if(this.fullTx.txSummary.txSuccess === false) {
              this.action = "Record WRKChain Hash"
            } else {
              this.action = "Recorded WRKChain Hash"
            }

              this.badge = 'badge badge-wrkchain'
              this.formatted = '' // Todo
              break
            case 'beacon/RegisterBeacon':
              if(this.fullTx.txSummary.txSuccess === false) {
                this.action = "Register BEACON"
              } else {
                this.action = "Registered BEACON"
              }

              this.badge = 'badge badge-beacon'
              this.formatted = '' // Todo
              break
            case 'beacon/RecordBeaconTimestamp':
              if(this.fullTx.txSummary.txSuccess === false) {
                this.action = "Record BEACON Timestamp"
              } else {
                this.action = "Recorded BEACON Timestamp"
              }

              this.badge = 'badge badge-beacon'
              this.formatted = '' // Todo
              break
            default:
              this.formatted = '' // Todo
              break
          }
        }
      },
      formatMsgSend: function (msg) {
        let formattedAmt = this.formatAmount(msg.amount[0].amount)
        if (this.fullTx.txSummary.isSent) {
          this.formatted = ' <span class="text-info">' + formattedAmt + '</span> to <span class="text-info">' + msg.to_address + '</span> on <span class="text-info">' + this.formatDateTime(this.fullTx.txSummary.timestamp) + '</span>'
        } else {
          this.action = 'Received'
          this.formatted = ' <span class="text-info">' + formattedAmt + '</span> from <span class="text-info">' + msg.from_address + '</span> on <span class="text-info">' + this.formatDateTime(this.fullTx.txSummary.timestamp) + '</span>'
        }
      },
      formatPurchaseUnd: function (msg) {
        let formattedAmt = this.formatAmount(msg.amount.amount)
        this.formatted = ' for <span class="text-info">' + formattedAmt + '</span> on <span class="text-info">' + this.formatDateTime(this.fullTx.txSummary.timestamp) + '</span>'
      },
      formatMsgDelegate: function (msg) {
        let formattedAmt = this.formatAmount(msg.amount.amount)
        let moniker = this.getValidatorMoniker(msg.validator_address)
        this.formatted = ' <span class="text-info">' + formattedAmt + '</span> to <span class="text-info">' + moniker + '</span> on <span class="text-info">' + this.formatDateTime(this.fullTx.txSummary.timestamp) + '</span>'
      },
      formatMsgUnDelegate: function (msg) {
        let formattedAmt = this.formatAmount(msg.amount.amount)
        let moniker = this.getValidatorMoniker(msg.validator_address)
        this.formatted = ' <span class="text-info">' + formattedAmt + '</span> from <span class="text-info">' + moniker + '</span> on <span class="text-info">' + this.formatDateTime(this.fullTx.txSummary.timestamp) + '</span>'
      },
      formatMsgWithdrawDelegationReward: function (msg) {
        let moniker = this.getValidatorMoniker(msg.validator_address)
        this.formatted = ' from <span class="text-info">' + moniker + '</span> on <span class="text-info">' + this.formatDateTime(this.fullTx.txSummary.timestamp) + '</span>'
      },
      formatMsgBeginRedelegate: function (msg) {
        let formattedAmt = this.formatAmount(msg.amount.amount)
        let moniker_src = this.getValidatorMoniker(msg.validator_src_address)
        let moniker_dst = this.getValidatorMoniker(msg.validator_dst_address)
        this.formatted = ' <span class="text-info">' + formattedAmt + '</span> from <span class="text-info">' + moniker_src + '</span> to <span class="text-info">' + moniker_dst + '</span> on <span class="text-info">' + this.formatDateTime(this.fullTx.txSummary.timestamp) + '</span>'
      }
    }
  }
</script>
