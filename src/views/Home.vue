<template>
  <div class="home">
    <Wallet/>
  </div>
</template>

<script>
// @ is an alias to /src
import Wallet from '@/components/Wallet.vue'

export default {
  name: 'home',
  components: {
    Wallet
  },
}
</script>
