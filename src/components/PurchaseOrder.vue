<template>
  <div>
    <span>
      <b-badge variant="info">PO #{{po.id}}</b-badge>
    </span>
    <span v-html="formatted">
    </span>
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
        this.formatted = ' raised for <span class="text-info">' + this.formatAmount(this.po.amount.amount) + '</span> on <span class="text-info">' + this.formatDateTime(this.po.raise_time) + '</span>. Status: ' + this.po.status
      }
    }
  }
</script>
