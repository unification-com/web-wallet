import Vue from 'vue'
import Big from "big.js";
import {UND_CONFIG} from '@/constants.js'

Vue.mixin({
  methods: {
    isValidAmount: function(value, maxExp = 7, maxDp = 8) {
      if(value === '' || value == null) {
        return false
      }
      let amount = new Big(value)

      if(amount.s < 0) {
        return false
      }

      // max amount = 999999999.99999999
      if(amount.e > maxExp) {
        return false
      }
      let dps = amount.c.slice(amount.e+1).length

      if(dps > maxDp) {
        return false
      }

      return true
    },
    isValidFee: function(fee) {
      if(!this.isValidAmount(fee.amount[0].amount, 7, 0)) {
        return false
      }
      if(fee.amount[0].denom !== 'nund') {
        return false
      }
      return true
    },
    isValidGas: function(gas) {
      if(!this.isValidAmount(gas, 7, 0)) {
        return false
      }
      return true
    },
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
    showToast: function(variant, title, msg) {
      this.$bvToast.toast(msg, {
        title: title,
        variant: variant,
        solid: true,
        autoHideDelay: 10000,
        appendToast: true
      })
    },
    wait: function(ms) {
      return new Promise(function(resolve) {
        setTimeout(function() {
          resolve()
        }, ms)
      })
    },
    clientError: function () {
      this.showToast('danger', 'Error', 'Client not connected or wallet not unlocked. Please reload')
    }
  }
})

export function deepCopy (obj, cache = []) {
  // just return if obj is immutable value
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  // if obj is hit, it is in circular structure
  const hit = find(cache, c => c.original === obj)
  if (hit) {
    return hit.copy
  }

  const copy = Array.isArray(obj) ? [] : {}
  // put the copy into cache at first
  // because we want to refer it in recursive deepCopy
  cache.push({
    original: obj,
    copy
  })

  Object.keys(obj).forEach(key => {
    copy[key] = deepCopy(obj[key], cache)
  })

  return copy
}
