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
            this.formatted = this.msg
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
      _formatDateTime(timestamp) {
        let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        let d = new Date(timestamp)

        let min = d.getMinutes();
        if (min < 10) {
          min = "0" + min;
        }
        let sec = d.getSeconds();
        if (sec < 10) {
          sec = "0" + sec;
        }

        let formatted = d.getDate() + ' '
        + months[d.getMonth()] + ' '
        + d.getFullYear() + ' '
        + d.getHours() + ':'
        + min + ':'
        + sec

        return formatted
      },
      _formatAmount: function(amount) {

        let formattedAmt = amount + 'nund'

        try {
          let amountBig = new Big(amount)
          if (amountBig.e >= 6) {
            let und = Number(amountBig.div(UND_CONFIG.BASENUMBER))
            formattedAmt = und + 'UND'
          }
        } catch(e) {}

        return formattedAmt
      },
      formatMsgSend: function(msg = this.msg.value) {
        let formattedAmt = this._formatAmount(msg.amount[0].amount)
        this.formatted = '<span class="tx-action">Sent</span> <span class="tx-amount">' + formattedAmt + '</span> to <span class="tx-address">' + msg.to_address + '</span> on <span class="tx-time">' + this._formatDateTime(this.tx.timestamp) + '</span>'
      },
      formatPurchaseUnd: function(msg = this.msg.value) {
        let formattedAmt = this._formatAmount(msg.amount.amount)
        this.formatted = '<span class="tx-action">Raised Enterprise Purchase Order</span> for <span class="tx-amount">' + formattedAmt + '</span> on <span class="tx-time">' + this._formatDateTime(this.tx.timestamp) + '</span>'
      },
      formatMsgDelegate: function(msg = this.msg.value) {
        let formattedAmt = this._formatAmount(msg.amount.amount)
        this.formatted = '<span class="tx-action">Delegated</span> ' + formattedAmt + ' to <span class="tx-address">' + msg.validator_address + '</span> on <span class="tx-time">' + this._formatDateTime(this.tx.timestamp) + '</span>'
      },
      formatMsgUnDelegate: function(msg = this.msg.value) {
        let formattedAmt = this._formatAmount(msg.amount.amount)
        this.formatted = '<span class="tx-action">Undelegated</span> ' + formattedAmt + ' from <span class="tx-address">' + msg.validator_address + '</span> on <span class="tx-time">' + this._formatDateTime(this.tx.timestamp) + '</span>'
      }
    }
  }
</script>