<template>
  <div>
    <span>
      <b-badge variant="info">{{action}}</b-badge>
    </span>
    <span v-html="formatted">
    </span>
  </div>
</template>

<script>

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
        formatted: '',
        action: '',
        address: '',
        datetime: '',
        amount: '',
      }
    },
    mounted() {
      this.formatMsg()
    },
    methods: {
      // Todo - missing Msgs
      formatMsg: function() {
        switch(this.msg.type) {
          case 'cosmos-sdk/MsgSend':
            this.action = "Sent"
            this.formatMsgSend()
            break
          case 'cosmos-sdk/MsgDelegate':
            this.action = "Delegated"
            this.formatMsgDelegate()
            break
          case 'cosmos-sdk/MsgUndelegate':
            this.action = "Undelegated"
            this.formatMsgUnDelegate()
            break
          case 'cosmos-sdk/MsgBeginRedelegate':
            this.action = "Redelegated"
            this.formatMsgBeginRedelegate()
            break
          case 'cosmos-sdk/MsgWithdrawValidatorCommission':
            this.action = "Withdrew Validator Commision"
            this.formatted = this.msg
            break
          case 'cosmos-sdk/MsgWithdrawDelegationReward':
            this.action = "Withdrew Delegation Reward"
            this.formatMsgWithdrawDelegationReward()
            break
          case 'cosmos-sdk/MsgModifyWithdrawAddress':
            this.formatted = this.msg
            break
          case 'cosmos-sdk/MsgUnjail':
            this.formatted = this.msg
            break
          case 'enterprise/PurchaseUnd':
            this.action = "Raised Enterprise Purchase Order"
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
        this.formatted = ' <span class="text-info">' + formattedAmt + '</span> to <span class="text-info">' + msg.to_address + '</span> on <span class="text-info">' + this.formatDateTime(this.tx.timestamp) + '</span>'
      },
      formatPurchaseUnd: function(msg = this.msg.value) {
        let formattedAmt = this.formatAmount(msg.amount.amount)
        this.formatted = ' for <span class="text-info">' + formattedAmt + '</span> on <span class="text-info">' + this.formatDateTime(this.tx.timestamp) + '</span>'
      },
      formatMsgDelegate: function(msg = this.msg.value) {
        let formattedAmt = this.formatAmount(msg.amount.amount)
        this.formatted = ' <span class="text-info">' + formattedAmt + '</span> to <span class="text-info">' + msg.validator_address + '</span> on <span class="text-info">' + this.formatDateTime(this.tx.timestamp) + '</span>'
      },
      formatMsgUnDelegate: function(msg = this.msg.value) {
        let formattedAmt = this.formatAmount(msg.amount.amount)
        this.formatted = ' <span class="text-info">' + formattedAmt + '</span> from <span class="text-info">' + msg.validator_address + '</span> on <span class="text-info">' + this.formatDateTime(this.tx.timestamp) + '</span>'
      },
      formatMsgWithdrawDelegationReward: function(msg = this.msg.value) {
        this.formatted = ' from <span class="text-info">' + msg.validator_address + '</span> on <span class="text-info">' + this.formatDateTime(this.tx.timestamp) + '</span>'
      },
      formatMsgBeginRedelegate: function(msg = this.msg.value) {
        let formattedAmt = this.formatAmount(msg.amount.amount)
        this.formatted = ' <span class="text-info">' + formattedAmt + '</span> from <span class="text-info">' + msg.validator_src_address + '</span> to <span class="text-info">' + msg.validator_dst_address + '</span> on <span class="text-info">' + this.formatDateTime(this.tx.timestamp) + '</span>'
      }
    }
  }
</script>
