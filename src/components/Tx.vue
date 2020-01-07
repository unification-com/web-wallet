<template>
  <div>
    {{formatted}}
  </div>
</template>

<script>

  import Big from 'big.js'
  const BASENUMBER = Math.pow(10, 9)

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
        console.log(this.tx)
        switch(this.msg.type) {
          case 'cosmos-sdk/MsgSend':
            this.formatMsgSend()
            break
          default:
            this.formatted = this.msg
            break
        }
      },
      formatMsgSend: function() {
        let msg = this.msg.value
        let amount = new Big(msg.amount[0].amount)
        let und = Number(amount.div(BASENUMBER))
        this.formatted = "Sent " + und + "UND to " + msg.to_address + " on " + this.tx.timestamp
      }
    }
  }
</script>