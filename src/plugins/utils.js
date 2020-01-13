import Vue from 'vue'
import Big from "big.js";
import {UND_CONFIG} from '@/constants.js'

Vue.mixin({
  methods: {
    formatAmount: function (amount) {
      let formattedAmt = Number(amount) + 'nund'

      try {
        let amountBig = new Big(amount)
        if (amountBig.e >= 6) {
          let und = Number(amountBig.div(UND_CONFIG.BASENUMBER))
          formattedAmt = und + 'UND'
        }
      } catch(e) {}

      return formattedAmt
    },
    formatDateTime(timestamp) {
      if(!isNaN(timestamp)) {
        timestamp = timestamp*1000
      }
      let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      let d = new Date(timestamp)

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
    nundToUnd: function(amount) {
      let amountBig = new Big(amount)
      let und = Number(amountBig.div(UND_CONFIG.BASENUMBER))
      return und
    },
    UndToNund: function(amount) {
      let amountBig = new Big(amount)
      let nund = Number(amountBig.mul(UND_CONFIG.BASENUMBER))
      return nund
    },
    showToast: function(variant, msg) {
      this.$bvToast.toast(msg, {
        title: 'Error',
        variant: variant,
        solid: true,
        autoHideDelay: 10000,
        appendToast: true
      })
    }
  }
})
