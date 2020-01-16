<template>
  <Home v-bind:is-web="true" />
</template>

<script>
  import Home from '@/components/Home.vue'

  export default {
    name: 'App',
    components: { Home }
  }
</script>