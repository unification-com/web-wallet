<template>
  <div v-html="formatted">
  </div>
</template>

<script>
  import Big from "big.js";
  import {UND_CONFIG} from '@/constants.js'

  export default {
    name: "PurchaseOrder",
    props: {
      po: Object
    },
    data: function () {
      return {
        formatted: ''
      }
    },
    mounted() {
      this.formatPo()
    },
    methods: {
      _formatDateTime(timestamp) {
        let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        let d = new Date(parseInt(timestamp)*1000)

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
      formatPo: function() {
        //{ "id": "1", "purchaser": "und15s4ec3s97tu4pstk8tq86l5ues4dxnmadqmrjl", "amount": { "denom": "nund", "amount": "10123450000" }, "status": "reject", "raise_time": "1578480080", "decisions": null, "completion_time": "1578480203" }
        this.formatted = 'PO #' + this.po.id + ' raised for ' + this._formatAmount(this.po.amount.amount) + ' on ' + this._formatDateTime(this.po.raise_time) + '. Status: ' + this.po.status
      }
    }
  }
</script>

<style scoped>

</style>