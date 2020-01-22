<template>
  <div>
    <span>{{txhash}}</span><br/>
    <span :class="badge">{{ action }}</span>
    <span v-html="formatted">
    </span>
  </div>
</template>

<script>
  import { mapGetters } from 'vuex'

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
        txhash: this.tx.txhash,
        txData: this.tx.tx,
        msg: this.tx.tx.value.msg[0],
        formatted: '',
        action: '',
        badge: 'badge badge-info'
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
            this.badge ='badge badge-success'
            this.formatMsgSend()
            break
          case 'cosmos-sdk/MsgDelegate':
            this.action = "Delegated"
            this.badge ='badge badge-warning'
            this.formatMsgDelegate()
            break
          case 'cosmos-sdk/MsgUndelegate':
            this.action = "Undelegated"
            this.badge ='badge badge-warning'
            this.formatMsgUnDelegate()
            break
          case 'cosmos-sdk/MsgBeginRedelegate':
            this.action = "Redelegated"
            this.badge ='badge badge-warning'
            this.formatMsgBeginRedelegate()
            break
          case 'cosmos-sdk/MsgWithdrawValidatorCommission':
            this.action = "Withdrew Validator Commision"
            this.badge ='badge badge-warning'
            this.formatted = this.msg
            break
          case 'cosmos-sdk/MsgWithdrawDelegationReward':
            this.action = "Withdrew Delegation Reward"
            this.badge ='badge badge-warning'
            this.formatMsgWithdrawDelegationReward()
            break
          case 'cosmos-sdk/MsgModifyWithdrawAddress':
            this.action = "Modified Withdraw Address"
            this.badge ='badge badge-warning'
            this.formatted = this.msg
            break
          case 'cosmos-sdk/MsgUnjail':
            this.formatted = this.msg
            break
          case 'enterprise/PurchaseUnd':
            this.action = "Raised Enterprise Purchase Order"
            this.badge ='badge badge-info'
            this.formatPurchaseUnd()
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
        let moniker = this.getValidatorMoniker(msg.validator_address)
        this.formatted = ' <span class="text-info">' + formattedAmt + '</span> to <span class="text-info">' + moniker + '</span> on <span class="text-info">' + this.formatDateTime(this.tx.timestamp) + '</span>'
      },
      formatMsgUnDelegate: function(msg = this.msg.value) {
        let formattedAmt = this.formatAmount(msg.amount.amount)
        let moniker = this.getValidatorMoniker(msg.validator_address)
        this.formatted = ' <span class="text-info">' + formattedAmt + '</span> from <span class="text-info">' + moniker + '</span> on <span class="text-info">' + this.formatDateTime(this.tx.timestamp) + '</span>'
      },
      formatMsgWithdrawDelegationReward: function(msg = this.msg.value) {
        let moniker = this.getValidatorMoniker(msg.validator_address)
        this.formatted = ' from <span class="text-info">' + moniker + '</span> on <span class="text-info">' + this.formatDateTime(this.tx.timestamp) + '</span>'
      },
      formatMsgBeginRedelegate: function(msg = this.msg.value) {
        let formattedAmt = this.formatAmount(msg.amount.amount)
        let moniker_src = this.getValidatorMoniker(msg.validator_src_address)
        let moniker_dst = this.getValidatorMoniker(msg.validator_dst_address)
        this.formatted = ' <span class="text-info">' + formattedAmt + '</span> from <span class="text-info">' + moniker_src + '</span> to <span class="text-info">' + moniker_dst + '</span> on <span class="text-info">' + this.formatDateTime(this.tx.timestamp) + '</span>'
      }
    }
  }
</script>
