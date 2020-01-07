<template>
  <ul id="transaction-list">
    <li v-for="tx in txs">
      <Tx v-bind:tx="tx"/>
    </li>
  </ul>
</template>

<script>

  import Tx from '@/components/Tx.vue'

  export default {
    name: 'Transactions',
    components: {
      Tx
    },
    props: {
      txs: Array
    },
    methods: {

    }
  }
</script>