import '@babel/polyfill'
import 'mutationobserver-shim'
import Vue from 'vue'
import '../plugins/bootstrap-vue'
import '../plugins/utils'
import App from './App.vue'
import 'bootstrap'
import 'bootstrap/dist/css/bootstrap.min.css'
import '@/assets/scss/custom.scss'

/* eslint-disable no-new */
new Vue({
  el: '#app',
  render: h => h(App)
})
