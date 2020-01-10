<template>
  <div v-html="formatted">
  </div>
</template>

<script>

  import Big from 'big.js'
  import {UND_CONFIG} from '@/constants.js'

  export default {
    name: 'Tx',
    props: {
      tx: Object
    },
    data: function () {
      return {
        txhash: this.tx.txhash,
        txData: this.tx.tx,
        msg: this.tx.tx.value.msg[0],
        formatted: ''
      }
    },
    mounted() {
      this.formatMsg()
    },
    methods: {
      formatMsg: function() {
        switch(this.msg.type) {
          case 'cosmos-sdk/MsgSend':
            this.formatMsgSend()
            break
          case 'cosmos-sdk/MsgDelegate':
            this.formatMsgDelegate()
            break
          case 'cosmos-sdk/MsgUndelegate':
            this.formatMsgUnDelegate()
            break
          case 'cosmos-sdk/MsgBeginRedelegate':
            this.formatted = this.msg
            break
          case 'cosmos-sdk/MsgWithdrawValidatorCommission':
            this.formatted = this.msg
            break
          case 'cosmos-sdk/MsgWithdrawDelegationReward':
            this.formatMsgWithdrawDelegationReward()
            break
          case 'cosmos-sdk/MsgModifyWithdrawAddress':
            this.formatted = this.msg
            break
          case 'cosmos-sdk/MsgUnjail':
            this.formatted = this.msg
            break
          case 'enterprise/PurchaseUnd':
            this.formatPurchaseUnd(this.msg.value)
            break
          case 'enterprise/ProcessUndPurchaseOrder':
            this.formatted = this.msg
            break
          case 'wrkchain/RegisterWrkChain':
            this.formatted = this.msg
            break
          case 'wrkchain/RecordWrkChainBlock':
            this.formatted = this.msg
            break
          case 'beacon/RegisterBeacon':
            this.formatted = this.msg
            break
          case 'beacon/RecordBeaconTimestamp':
            this.formatted = this.msg
            break
          default:
            this.formatted = this.msg
            break
        }
      },
      formatMsgSend: function(msg = this.msg.value) {
        let formattedAmt = this.formatAmount(msg.amount[0].amount)
        this.formatted = '<span class="tx-action">Sent</span> <span class="tx-amount">' + formattedAmt + '</span> to <span class="tx-address">' + msg.to_address + '</span> on <span class="tx-time">' + this.formatDateTime(this.tx.timestamp) + '</span>'
      },
      formatPurchaseUnd: function(msg = this.msg.value) {
        let formattedAmt = this.formatAmount(msg.amount.amount)
        this.formatted = '<span class="tx-action">Raised Enterprise Purchase Order</span> for <span class="tx-amount">' + formattedAmt + '</span> on <span class="tx-time">' + this.formatDateTime(this.tx.timestamp) + '</span>'
      },
      formatMsgDelegate: function(msg = this.msg.value) {
        let formattedAmt = this.formatAmount(msg.amount.amount)
        this.formatted = '<span class="tx-action">Delegated</span> ' + formattedAmt + ' to <span class="tx-address">' + msg.validator_address + '</span> on <span class="tx-time">' + this.formatDateTime(this.tx.timestamp) + '</span>'
      },
      formatMsgUnDelegate: function(msg = this.msg.value) {
        let formattedAmt = this.formatAmount(msg.amount.amount)
        this.formatted = '<span class="tx-action">Undelegated</span> ' + formattedAmt + ' from <span class="tx-address">' + msg.validator_address + '</span> on <span class="tx-time">' + this.formatDateTime(this.tx.timestamp) + '</span>'
      },
      formatMsgWithdrawDelegationReward: function(msg = this.msg.value) {
        this.formatted = '<span class="tx-action">Withdrew Reward</span> from <span class="tx-address">' + msg.validator_address + '</span> on <span class="tx-time">' + this.formatDateTime(this.tx.timestamp) + '</span>'
      }
    }
  }
</script>