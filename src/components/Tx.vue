<template>
  <div>
    <span class="badge badge-success" v-show="!txSummary.isSent && txSummary.txSuccess" style=" margin-right:5px;">
      <b-icon-download style="width:20px; height:20px"/>
    </span>
    <span class="badge badge-info" v-show="txSummary.isSent && txSummary.txSuccess" style=" margin-right:5px;">
      <b-icon-upload style="width:20px; height:20px"/>
    </span>
    <span class="badge badge-danger" v-show="!txSummary.txSuccess && fullTx.txData !== null" style=" margin-right:5px;">
      <b-icon-alert-triangle style="width:20px; height:20px" />
    </span>

    <span class="badge badge-info" v-show="fullTx.txData === null" style=" margin-right:5px;">
      <b-icon-info style="width:20px; height:20px" />
    </span>
    <span>{{txSummary.txhash.substring(0, 12)}}...</span>
    <span class="badge badge-secondary" style="margin-left:5px;"
          v-b-toggle="'more-tx-' + txSummary.txhash"
          v-show="fullTx.txData !== null"
    >
      <b-icon-three-dots />
    </span>
    <b-collapse :id="'more-tx-' + txSummary.txhash" class="mt-2">
      <b-card>
        Tx Hash: {{ txSummary.txhash }}<br />
        Block: {{ txSummary.height }}<br />
        Gas Wanted: {{ txSummary.gas_wanted }}<br />
        Gas Used: {{ txSummary.gas_used }}<br />
        Fee: {{ txSummary.fee }}<br />

        <div v-show="txSummary.txSuccess === false">
          <span class="text-danger">Fail Reason: {{ failReason }}</span>
        </div>
      </b-card>
    </b-collapse>

    <br/>
    <div>
      <span v-show="txSummary.txSuccess === false">
      <b-badge variant="danger">FAILED</b-badge> to
    </span>
      <span :class="badge">{{ action }}</span>
      <span v-html="formatted">
    </span>
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
        txSummary: this.tx.txSummary,
        formatted: '',
        action: '',
        badge: 'badge badge-info',
        failReason: '',
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
      legacyParseErrorLog: function() {
        try {
          let logMsgObj = JSON.parse(this.fullTx.txData.logs[0].log)
          this.failReason = logMsgObj.message
        } catch(e) {
          this.failReason = ''
        }
      },
      // Todo - missing Msgs
      formatMsg: function () {
        if (this.fullTx.txData === null) {
          this.action = "Pending"
          this.badge = 'badge badge-info'
          this.formatted = '...'
          this.txSummary.height = ''
          this.txSummary.gas_wanted = ''
          this.txSummary.gas_used = ''
          this.txSummary.fee = ''
        } else {
          this.txSummary.height = this.fullTx.txData.height
          this.txSummary.gas_wanted = this.fullTx.txData.gas_wanted
          this.txSummary.gas_used = this.fullTx.txData.gas_used
          this.txSummary.fee = this.fullTx.txData.tx.value.fee.amount[0].amount + this.fullTx.txData.tx.value.fee.amount[0].denom

          if(this.txSummary.txSuccess === false) {
            if(!('codespace' in this.fullTx.txData)) {
              // legacy support
              this.legacyParseErrorLog()
            } else {
              // und v1.2.0
              this.failReason = this.fullTx.txData['raw_log']
            }
          }
          const msg = this.fullTx.txData.tx.value.msg[0]
          switch (msg.type) {
            case 'cosmos-sdk/MsgSend':
              if(this.txSummary.txSuccess === false) {
                this.action = "Send"
              } else {
                this.action = "Sent"
              }

              this.badge = 'badge badge-transfer'
              this.formatMsgSend(msg.value)
              break
            case 'cosmos-sdk/MsgDelegate':
              if(this.txSummary.txSuccess === false) {
                this.action = "Delegate"
              } else {
                this.action = "Delegated"
              }

              this.badge = 'badge badge-staking'
              this.formatMsgDelegate(msg.value)
              break
            case 'cosmos-sdk/MsgUndelegate':
              if(this.txSummary.txSuccess === false) {
                this.action = "Undelegate"
              } else {
                this.action = "Undelegated"
              }

              this.badge = 'badge badge-staking'
              this.formatMsgUnDelegate(msg.value)
              break
            case 'cosmos-sdk/MsgBeginRedelegate':
              if(this.txSummary.txSuccess === false) {
                this.action = "Redelegate"
              } else {
                this.action = "Redelegated"
              }

              this.badge = 'badge badge-staking'
              this.formatMsgBeginRedelegate(msg.value)
              break
            case 'cosmos-sdk/MsgWithdrawValidatorCommission':
              if(this.txSummary.txSuccess === false) {
                this.action = "Withdraw Validator Commision"
              } else {
                this.action = "Withdrew Validator Commision"
              }

              this.badge = 'badge badge-staking'

              this.formatted = '' // Todo
              break
            case 'cosmos-sdk/MsgWithdrawDelegationReward':
              let withdrawAmount = null
              if(this.txSummary.txSuccess === false) {
                this.action = "Withdraw Delegation Reward"
              } else {
                this.action = "Withdrew Delegation Reward"
                try {
                  let withdrawObj = {}
                  // Todo - don't assume events & logs obj order is always the same
                  if('events' in this.fullTx.txData) {
                    //legacy
                    withdrawObj = this.fullTx.txData.events[1].attributes[1]
                  } else {
                    // und v1.2.0
                    withdrawObj = this.fullTx.txData.logs[0].events[1].attributes[1]
                  }
                  if(withdrawObj.key === 'amount') {
                    withdrawAmount = withdrawObj.value.replace('nund', '')
                  }
                } catch(e) {

                }
              }
              this.badge = 'badge badge-staking'
              this.formatMsgWithdrawDelegationReward(msg.value, withdrawAmount)
              break
            case 'cosmos-sdk/MsgModifyWithdrawAddress':
              if(this.txSummary.txSuccess === false) {
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
              if(this.txSummary.txSuccess === false) {
                this.action = "Raise Enterprise Purchase Order"
              } else {
                this.action = "Raised Enterprise Purchase Order"
              }

              this.badge = 'badge badge-enterprise'
              this.formatPurchaseUnd(msg.value)
              break
            case 'enterprise/ProcessUndPurchaseOrder':
              if(this.txSummary.txSuccess === false) {
                this.action = "Process UND Enterprise Purchase Order"
              } else {
                this.action = "Processed UND Enterprise Purchase Order"
              }

              this.badge = 'badge badge-enterprise'

              this.formatted = '' // Todo
              break
            case 'wrkchain/RegisterWrkChain':
              if(this.txSummary.txSuccess === false) {
                this.action = "Register WRKChain"
              } else {
                this.action = "Registered WRKChain"
              }

              this.badge = 'badge badge-wrkchain'
              this.formatted = '' // Todo
              break
            case 'wrkchain/RecordWrkChainBlock':if(this.txSummary.txSuccess === false) {
              this.action = "Record WRKChain Hash"
            } else {
              this.action = "Recorded WRKChain Hash"
            }

              this.badge = 'badge badge-wrkchain'
              this.formatted = '' // Todo
              break
            case 'beacon/RegisterBeacon':
              if(this.txSummary.txSuccess === false) {
                this.action = "Register BEACON"
              } else {
                this.action = "Registered BEACON"
              }

              this.badge = 'badge badge-beacon'
              this.formatted = '' // Todo
              break
            case 'beacon/RecordBeaconTimestamp':
              if(this.txSummary.txSuccess === false) {
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
        if (this.txSummary.isSent) {
          this.formatted = ' <span class="text-info">' + formattedAmt + '</span> to <span class="text-info">' + msg.to_address + '</span> on <span class="text-info">' + this.formatDateTime(this.txSummary.timestamp) + '</span>'
        } else {
          this.action = 'Received'
          this.formatted = ' <span class="text-info">' + formattedAmt + '</span> from <span class="text-info">' + msg.from_address + '</span> on <span class="text-info">' + this.formatDateTime(this.txSummary.timestamp) + '</span>'
        }
      },
      formatPurchaseUnd: function (msg) {
        let formattedAmt = this.formatAmount(msg.amount.amount)
        this.formatted = ' for <span class="text-info">' + formattedAmt + '</span> on <span class="text-info">' + this.formatDateTime(this.txSummary.timestamp) + '</span>'
      },
      formatMsgDelegate: function (msg) {
        let formattedAmt = this.formatAmount(msg.amount.amount)
        let moniker = this.getValidatorMoniker(msg.validator_address)
        this.formatted = ' <span class="text-info">' + formattedAmt + '</span> to <span class="text-info">' + moniker + '</span> on <span class="text-info">' + this.formatDateTime(this.txSummary.timestamp) + '</span>'
      },
      formatMsgUnDelegate: function (msg) {
        let formattedAmt = this.formatAmount(msg.amount.amount)
        let moniker = this.getValidatorMoniker(msg.validator_address)
        this.formatted = ' <span class="text-info">' + formattedAmt + '</span> from <span class="text-info">' + moniker + '</span> on <span class="text-info">' + this.formatDateTime(this.txSummary.timestamp) + '</span>'
      },
      formatMsgWithdrawDelegationReward: function (msg, withdrawAmount) {
        let moniker = this.getValidatorMoniker(msg.validator_address)

        let formattedAmt = ''
        if(withdrawAmount !== null) {
          formattedAmt = ' of <span class="text-info">' + this.formatAmount(withdrawAmount) + '</span>'
        }
        this.formatted = formattedAmt + ' from <span class="text-info">' + moniker + '</span> on <span class="text-info">' + this.formatDateTime(this.txSummary.timestamp) + '</span>'
      },
      formatMsgBeginRedelegate: function (msg) {
        let formattedAmt = this.formatAmount(msg.amount.amount)
        let moniker_src = this.getValidatorMoniker(msg.validator_src_address)
        let moniker_dst = this.getValidatorMoniker(msg.validator_dst_address)
        this.formatted = ' <span class="text-info">' + formattedAmt + '</span> from <span class="text-info">' + moniker_src + '</span> to <span class="text-info">' + moniker_dst + '</span> on <span class="text-info">' + this.formatDateTime(this.txSummary.timestamp) + '</span>'
      }
    }
  }
</script>
