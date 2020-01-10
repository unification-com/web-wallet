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
      formatPo: function() {
        this.formatted = 'PO #' + this.po.id + ' raised for ' + this.formatAmount(this.po.amount.amount) + ' on ' + this.formatDateTime(this.po.raise_time) + '. Status: ' + this.po.status
      }
    }
  }
</script>

<style scoped>

</style>