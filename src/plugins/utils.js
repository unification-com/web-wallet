import Vue from "vue"
import Big from "big.js"
import { UND_CONFIG } from "../constants"

Vue.mixin({
  methods: {
    isValidAmount(value, maxExp = 7, maxDp = 9) {
      if (value === "" || value == null) {
        return false
      }
      const amount = new Big(value)

      if (amount.s < 0) {
        return false
      }

      // max amount = 999999999.999999999
      if (amount.e > maxExp) {
        return false
      }
      const dps = amount.c.slice(amount.e + 1).length

      if (dps > maxDp) {
        return false
      }

      return true
    },
    isValidFee(fee) {
      if (!this.isValidAmount(fee.amount[0].amount, 7, 0)) {
        return false
      }
      if (fee.amount[0].denom !== "nund") {
        return false
      }
      return true
    },
    isValidGas(gas) {
      if (!this.isValidAmount(gas, 7, 0)) {
        return false
      }
      return true
    },
    formatAmount(amount) {
      let formattedAmt = `${Number(amount)} nund`

      try {
        const amountBig = new Big(amount)
        if (amountBig.e >= 6) {
          const und = Number(amountBig.div(UND_CONFIG.BASENUMBER))
          const undFormatted = new Intl.NumberFormat("en-GB", { maximumSignificantDigits: 18 }).format(und)
          formattedAmt = `${undFormatted} FUND`
        }
      } catch (e) {
        // empty
      }

      return formattedAmt
    },
    formatDateTime(timestamp) {
      let tsMs = 0
      if (!Number.isNaN(timestamp)) {
        tsMs = timestamp * 1000
      }
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
      const d = new Date(tsMs)

      let min = d.getMinutes()
      if (min < 10) {
        min = `0${min}`
      }
      let sec = d.getSeconds()
      if (sec < 10) {
        sec = `0${sec}`
      }

      const formatted = `${d.getDate()} ${
        months[d.getMonth()]
      } ${d.getFullYear()} ${d.getHours()}:${min}:${sec} UTC`

      return formatted
    },
    nundToUnd(amount) {
      const amountBig = new Big(amount)
      const und = Number(amountBig.div(UND_CONFIG.BASENUMBER))
      return und
    },
    UndToNund(amount) {
      const amountBig = new Big(amount)
      const nund = Number(amountBig.mul(UND_CONFIG.BASENUMBER))
      return nund
    },
    isValidAmountPlusFees(balance, amount, fees) {
      const amountBig = new Big(amount)
      const balanceBig = new Big(balance)
      const feesBig = new Big(fees)
      const recommendMinBalance = new Big(UND_CONFIG.RECOMMENDED_MIN_BALANCE)

      const amountNund = amountBig.mul(UND_CONFIG.BASENUMBER)
      const balanceNund = balanceBig.mul(UND_CONFIG.BASENUMBER)
      const amtAndFees = amountNund.add(feesBig)
      const diff = balanceNund.sub(amtAndFees)

      const result = {
        isValid: amtAndFees.lte(balanceNund),
        gotUnd: Number(balanceNund.div(UND_CONFIG.BASENUMBER)),
        gotNund: balanceNund.toString(),
        requiredUnd: Number(amtAndFees.div(UND_CONFIG.BASENUMBER)),
        requiredNund: amtAndFees.toString(),
        warn: diff.lt(recommendMinBalance),
        diff: diff.toString(),
      }
      return result
    },
    showToast(variant, title, msg) {
      this.$notify({
        group: "walletNotifications",
        title,
        text: msg,
        type: variant,
      })
    },
    wait(ms) {
      // eslint-disable-next-line
      return new Promise(function(resolve) {
        // eslint-disable-next-line
        setTimeout(function() {
          resolve()
        }, ms)
      })
    },
    clientError() {
      this.showToast("danger", "Error", "Client not connected or wallet not unlocked. Please reload")
    },
    handleUndJsError(resObj) {
      if ("error" in resObj.result) {
        // eslint-disable-next-line
        console.log("UND-JS returned an error.", "status:", resObj.status, "message:", resObj.result.error)
      } else {
        // eslint-disable-next-line
        console.log("UND-JS returned an error:", resObj.toString())
      }
    },
    isValidRestUrl(str) {
      const regexp = /^(?:(?:https?):\/\/)/
      if (regexp.test(str)) {
        return true
      }
      return false
    },
    explorerUrl(chainId) {
      // check for FUND-Mainchain-TestNet-v3 etc.
      let cId = chainId
      try {
        if (cId) {
          const n = cId.search("Mainchain-TestNet")
          if (n > -1) {
            cId = "Mainchain-TestNet"
          }
        }
      } catch (e) {
        // empty
      }

      switch (cId) {
        case "FUND-Mainchain-DevNet":
          return "http://localhost:3000"
        case "Mainchain-TestNet":
          return "https://explorer-testnet.unification.io"
        default:
          // default to MainNet
          return "https://explorer.unification.io"
      }
    },
    getEventAttr(logs, eventType, attrKey) {
      let val = ""
      try {
        for (let i = 0; i < logs.length; i += 1) {
          const { events } = logs[i]
          for (let j = 0; j < events.length; j += 1) {
            if (events[j].type === eventType) {
              const { attributes } = events[j]
              for (let k = 0; k < attributes.length; k += 1) {
                if (attributes[k].key === attrKey) {
                  val = attributes[k].value
                }
              }
            }
          }
        }
      } catch (e) {
        // empty
      }
      return val
    },
  },
})

export function deepCopy(obj, cache = []) {
  // just return if obj is immutable value
  if (obj === null || typeof obj !== "object") {
    return obj
  }

  // if obj is hit, it is in circular structure
  // eslint-disable-next-line no-restricted-globals
  const hit = find(cache, c => c.original === obj)
  if (hit) {
    return hit.copy
  }

  const copy = Array.isArray(obj) ? [] : {}
  // put the copy into cache at first
  // because we want to refer it in recursive deepCopy
  cache.push({
    original: obj,
    copy,
  })

  Object.keys(obj).forEach(key => {
    copy[key] = deepCopy(obj[key], cache)
  })

  return copy
}
