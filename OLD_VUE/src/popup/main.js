// eslint-disable-next-line import/no-extraneous-dependencies
import "mutationobserver-shim"
import Vue from "vue"
import "../plugins/bootstrap-vue"
import "../plugins/vue-notification"
import "../plugins/utils"
import App from "./App.vue"
import store from "../store"
import "bootstrap"
import "bootstrap/dist/css/bootstrap.min.css"
import "../assets/scss/custom.scss"

/* eslint-disable no-new */
new Vue({
  el: "#app",
  store,
  render: h => h(App),
})
