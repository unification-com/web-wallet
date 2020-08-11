<template>
  <Home :is-web="true" />
</template>
<script>
import Home from "../components/Home.vue"

export default {
  name: "App",
  components: { Home },
}
</script>
