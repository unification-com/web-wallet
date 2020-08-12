<template>
  <div>
    <span
      v-show="!txSummary.isSent && txSummary.txSuccess"
      class="badge badge-success"
      style=" margin-right:5px;"
    >
      <b-icon-download style="width:20px; height:20px" />
    </span>
    <span
      v-show="txSummary.isSent && txSummary.txSuccess"
      class="badge badge-info"
      style=" margin-right:5px;"
    >
      <b-icon-upload style="width:20px; height:20px" />
    </span>
    <span
      v-show="!txSummary.txSuccess && fullTx.txData !== null"
      class="badge badge-danger"
      style=" margin-right:5px;"
    >
      <b-icon-exclamation-triangle style="width:20px; height:20px" />
    </span>

    <span v-show="fullTx.txData === null" class="badge badge-info" style=" margin-right:5px;">
      <b-icon-info-circle style="width:20px; height:20px" />
    </span>
    <span>{{ txSummary.txhash.substring(0, 12) }}... {{ formattedMsgs.length }} {{ msgMessage }}</span> on
    <span class="text-info">{{ txSummary.formattedDate }}</span>
    <span
      v-show="fullTx.txData !== null"
      v-b-toggle="'more-tx-' + txSummary.txhash"
      class="badge badge-secondary"
      style="margin-left:5px;"
    >
      <b-icon-three-dots />
    </span>

    <br />
    <div>
      <b-list-group-item v-for="msg in formattedMsgs" :key="tx.txSummary.txhash + '-' + msg.key">
        <span v-show="txSummary.txSuccess === false"> <b-badge variant="danger">FAILED</b-badge> to </span>
        <span :class="msg.badge">{{ msg.action }}</span>
        <span v-for="msgItem in msg.formatted" :key="msgItem.content">
          <template v-if="msgItem.wrap">
            <span class="text-info">{{ msgItem.content }}</span>
          </template>
          <template v-else>
            {{ msgItem.content }}
          </template>
        </span>
      </b-list-group-item>
    </div>

    <b-collapse :id="'more-tx-' + txSummary.txhash" class="mt-2">
      <b-card>
        Tx Hash:
        <a :href="explorerUrlPrefix + '/transactions/' + txSummary.txhash" target="_blank">
          {{ txSummary.txhash }}
          <b-icon-box-arrow-up-right />
        </a>
        <br />
        Block:
        <a :href="explorerUrlPrefix + '/blocks/' + txSummary.height" target="_blank">
          {{ txSummary.height }}
          <b-icon-box-arrow-up-right />
        </a>
        <br />
        <span v-show="txSummary.memo">Memo: {{ txSummary.memo }}<br /></span>
        Number of Messages: {{ formattedMsgs.length }}<br />
        <span v-show="txSummary.isSent">
          Gas Wanted: {{ txSummary.gas_wanted }}<br />
          Gas Used: {{ txSummary.gas_used }}<br />
          Fee: {{ txSummary.fee }}<br />
        </span>

        <div v-show="txSummary.txSuccess === false">
          <span class="text-danger">Fail Reason: {{ failReason }}</span>
        </div>
      </b-card>
    </b-collapse>
  </div>
</template>

<script>
import { mapGetters, mapState } from "vuex"

export default {
  name: "Tx",
  props: {
    tx: Object,
  },
  data() {
    return {
      fullTx: this.tx,
      txSummary: this.tx.txSummary,
      formattedMsgs: [],
      action: "",
      badge: "badge badge-info",
      failReason: "",
    }
  },
  computed: {
    ...mapGetters("validators", ["getValidatorMoniker"]),
    ...mapState({
      chainId: state => state.client.chainId,
    }),
    explorerUrlPrefix() {
      return this.explorerUrl(this.chainId)
    },
    msgMessage() {
      let suffix = ""
      if (this.formattedMsgs.length > 1) {
        suffix = "s"
      }
      return `Message${suffix}`
    },
  },
  watch: {
    tx(val) {
      this.fullTx = val
      this.formatMsg()
    },
  },
  mounted() {
    this.formatMsg()
  },
  methods: {
    formatMsg() {
      if (this.fullTx.txData === null) {
        this.formattedMsgs = [{ formatted: "...", action: "Pending", badge: "badge badge-info", key: 0 }]
        this.txSummary.height = ""
        this.txSummary.gas_wanted = ""
        this.txSummary.gas_used = ""
        this.txSummary.fee = ""
        this.txSummary.memo = ""
        this.txSummary.formattedDate = ""
      } else {
        this.txSummary.height = this.fullTx.txData.height
        this.txSummary.gas_wanted = this.fullTx.txData.gas_wanted
        this.txSummary.gas_used = this.fullTx.txData.gas_used
        this.txSummary.fee =
          this.fullTx.txData.tx.value.fee.amount[0].amount + this.fullTx.txData.tx.value.fee.amount[0].denom
        this.txSummary.memo = this.fullTx.txData.tx.value.memo
        this.txSummary.formattedDate = this.formatDateTime(this.txSummary.timestamp)

        if (this.txSummary.txSuccess === false) {
          this.failReason = this.fullTx.txData.raw_log
        }

        this.formattedMsgs = []

        for (let i = 0; i < this.fullTx.txData.tx.value.msg.length; i += 1) {
          const msg = this.fullTx.txData.tx.value.msg[i]
          const formattedObj = {
            formatted: "",
            action: "",
            badge: "",
            key: i,
          }

          switch (msg.type) {
            case "cosmos-sdk/MsgSend": {
              if (this.txSummary.isSent) {
                if (this.txSummary.txSuccess === false) {
                  formattedObj.action = "Send"
                } else {
                  formattedObj.action = "Sent"
                }
              } else {
                formattedObj.action = "Received"
              }

              formattedObj.badge = "badge badge-transfer"
              formattedObj.formatted = this.formatMsgSend(msg.value)
              break
            }
            case "cosmos-sdk/MsgDelegate": {
              if (this.txSummary.txSuccess === false) {
                formattedObj.action = "Delegate"
              } else {
                formattedObj.action = "Delegated"
              }

              formattedObj.badge = "badge badge-staking"
              formattedObj.formatted = this.formatMsgDelegate(msg.value)
              break
            }
            case "cosmos-sdk/MsgUndelegate": {
              if (this.txSummary.txSuccess === false) {
                formattedObj.action = "Undelegate"
              } else {
                formattedObj.action = "Undelegated"
              }

              formattedObj.badge = "badge badge-staking"
              formattedObj.formatted = this.formatMsgUnDelegate(msg.value)
              break
            }
            case "cosmos-sdk/MsgBeginRedelegate": {
              if (this.txSummary.txSuccess === false) {
                formattedObj.action = "Redelegate"
              } else {
                formattedObj.action = "Redelegated"
              }

              formattedObj.badge = "badge badge-staking"
              formattedObj.formatted = this.formatMsgBeginRedelegate(msg.value)
              break
            }
            case "cosmos-sdk/MsgCreateValidator": {
              if (this.txSummary.txSuccess === false) {
                formattedObj.action = "Create Validator"
              } else {
                formattedObj.action = "Created Validator"
              }
              formattedObj.badge = "badge badge-staking"
              formattedObj.formatted = this.formatMsgCreateValidator(msg.value)
              break
            }
            case "cosmos-sdk/MsgEditValidator": {
              if (this.txSummary.txSuccess === false) {
                formattedObj.action = "Edit Validator"
              } else {
                formattedObj.action = "Edited Validator"
              }
              formattedObj.badge = "badge badge-staking"
              break
            }
            case "cosmos-sdk/MsgWithdrawValidatorCommission": {
              const withdrawCommAmount = this.getEventAttr(
                this.fullTx.txData.logs,
                "withdraw_commission",
                "amount",
              ).replace("nund", "")
              if (this.txSummary.txSuccess === false) {
                formattedObj.action = "Withdraw Validator Commision"
              } else {
                formattedObj.action = "Withdrew Validator Commision"
              }

              formattedObj.badge = "badge badge-staking"

              formattedObj.formatted = this.formatMsgWithdrawValidatorCommission(msg, withdrawCommAmount)
              break
            }
            case "cosmos-sdk/MsgWithdrawDelegationReward": {
              const withdrawAmount = this.getEventAttr(
                this.fullTx.txData.logs,
                "withdraw_rewards",
                "amount",
              ).replace("nund", "")
              if (this.txSummary.txSuccess === false) {
                formattedObj.action = "Withdraw Delegation Reward"
              } else {
                formattedObj.action = "Withdrew Delegation Reward"
              }
              formattedObj.badge = "badge badge-staking"
              formattedObj.formatted = this.formatMsgWithdrawDelegationReward(msg.value, withdrawAmount)
              break
            }
            case "cosmos-sdk/MsgModifyWithdrawAddress": {
              if (this.txSummary.txSuccess === false) {
                formattedObj.action = "Modify Withdraw Address"
              } else {
                formattedObj.action = "Modified Withdraw Address"
              }

              formattedObj.badge = "badge badge-staking"
              formattedObj.formatted = "" // Todo
              break
            }
            case "cosmos-sdk/MsgUnjail": {
              formattedObj.action = "Unjail"
              formattedObj.formatted = "" // Todo
              break
            }
            case "enterprise/PurchaseUnd": {
              if (this.txSummary.txSuccess === false) {
                formattedObj.action = "Raise Enterprise Purchase Order"
              } else {
                formattedObj.action = "Raised Enterprise Purchase Order"
              }

              formattedObj.badge = "badge badge-enterprise"
              formattedObj.formatted = this.formatPurchaseUnd(msg.value)
              break
            }
            case "enterprise/ProcessUndPurchaseOrder": {
              if (this.txSummary.txSuccess === false) {
                formattedObj.action = "Process Enterprise Purchase Order"
              } else {
                formattedObj.action = "Processed Enterprise Purchase Order"
              }

              formattedObj.badge = "badge badge-enterprise"

              formattedObj.formatted = "" // Todo
              break
            }
            case "wrkchain/RegisterWrkChain": {
              if (this.txSummary.txSuccess === false) {
                formattedObj.action = "Register WRKChain"
              } else {
                formattedObj.action = "Registered WRKChain"
              }

              formattedObj.badge = "badge badge-wrkchain"
              formattedObj.formatted = this.formatRegisterWrkchain(msg.value)
              break
            }
            case "wrkchain/RecordWrkChainBlock": {
              if (this.txSummary.txSuccess === false) {
                formattedObj.action = "Record WRKChain Hash"
              } else {
                formattedObj.action = "Recorded WRKChain Hash"
              }

              formattedObj.badge = "badge badge-wrkchain"
              formattedObj.formatted = this.formatRecordWrkchainHash(msg.value)
              break
            }
            case "beacon/RegisterBeacon": {
              if (this.txSummary.txSuccess === false) {
                formattedObj.action = "Register BEACON"
              } else {
                formattedObj.action = "Registered BEACON"
              }

              formattedObj.badge = "badge badge-beacon"
              formattedObj.formatted = this.formatRegisterBeacon(msg.value)
              break
            }
            case "beacon/RecordBeaconTimestamp": {
              if (this.txSummary.txSuccess === false) {
                formattedObj.action = "Record BEACON Timestamp"
              } else {
                formattedObj.action = "Recorded BEACON Timestamp"
              }

              formattedObj.badge = "badge badge-beacon"
              formattedObj.formatted = this.formatRecordBeaconTimestamp(msg.value)
              break
            }
            default: {
              formattedObj.formatted = ""
              formattedObj.action = msg.type
              formattedObj.badge = "badge badge-info"
              break
            }
          }
          this.formattedMsgs.push(formattedObj)
        }
      }
    },
    formatMsgSend(msg) {
      const msgContent = []
      const formattedAmt = this.formatAmount(msg.amount[0].amount)
      if (this.txSummary.isSent) {
        msgContent.push({
          content: " ",
          wrap: false,
        })
        msgContent.push({
          content: formattedAmt,
          wrap: true,
        })
        msgContent.push({
          content: " to ",
          wrap: false,
        })
        msgContent.push({
          content: msg.to_address,
          wrap: true,
        })
      } else {
        msgContent.push({
          content: formattedAmt,
          wrap: true,
        })
        msgContent.push({
          content: " from ",
          wrap: false,
        })
        msgContent.push({
          content: msg.from_address,
          wrap: true,
        })
      }
      return msgContent
    },
    formatPurchaseUnd(msg) {
      const msgContent = []
      const formattedAmt = this.formatAmount(msg.amount.amount)
      msgContent.push({
        content: " for ",
        wrap: false,
      })
      msgContent.push({
        content: formattedAmt,
        wrap: true,
      })
      return msgContent
    },
    formatMsgDelegate(msg) {
      const msgContent = []
      const formattedAmt = this.formatAmount(msg.amount.amount)
      const moniker = this.getValidatorMoniker(msg.validator_address)
      msgContent.push({
        content: " ",
        wrap: false,
      })
      msgContent.push({
        content: formattedAmt,
        wrap: true,
      })
      msgContent.push({
        content: " to ",
        wrap: false,
      })
      msgContent.push({
        content: moniker,
        wrap: true,
      })
      return msgContent
    },
    formatMsgUnDelegate(msg) {
      const msgContent = []
      const formattedAmt = this.formatAmount(msg.amount.amount)
      const moniker = this.getValidatorMoniker(msg.validator_address)
      msgContent.push({
        content: " ",
        wrap: false,
      })
      msgContent.push({
        content: formattedAmt,
        wrap: true,
      })
      msgContent.push({
        content: " from ",
        wrap: false,
      })
      msgContent.push({
        content: moniker,
        wrap: true,
      })
      return msgContent
    },
    formatMsgWithdrawDelegationReward(msg, withdrawAmount) {
      const msgContent = []
      const moniker = this.getValidatorMoniker(msg.validator_address)
      if (withdrawAmount !== null) {
        msgContent.push({
          content: " of ",
          wrap: false,
        })
        msgContent.push({
          content: this.formatAmount(withdrawAmount),
          wrap: true,
        })
      }
      msgContent.push({
        content: " from ",
        wrap: false,
      })
      msgContent.push({
        content: moniker,
        wrap: true,
      })
      return msgContent
    },
    formatMsgWithdrawValidatorCommission(msg, withdrawAmount) {
      const msgContent = []
      const moniker = this.getValidatorMoniker(msg.value.validator_address)
      if (withdrawAmount !== null) {
        msgContent.push({
          content: " of ",
          wrap: false,
        })
        msgContent.push({
          content: this.formatAmount(withdrawAmount),
          wrap: true,
        })
      }
      msgContent.push({
        content: " from ",
        wrap: false,
      })
      msgContent.push({
        content: moniker,
        wrap: true,
      })
      return msgContent
    },
    formatMsgBeginRedelegate(msg) {
      const msgContent = []
      const formattedAmt = this.formatAmount(msg.amount.amount)
      const monikerSrc = this.getValidatorMoniker(msg.validator_src_address)
      const monikerDst = this.getValidatorMoniker(msg.validator_dst_address)
      msgContent.push({
        content: " ",
        wrap: false,
      })
      msgContent.push({
        content: formattedAmt,
        wrap: true,
      })
      msgContent.push({
        content: " from ",
        wrap: false,
      })
      msgContent.push({
        content: monikerSrc,
        wrap: true,
      })
      msgContent.push({
        content: " to ",
        wrap: false,
      })
      msgContent.push({
        content: monikerDst,
        wrap: true,
      })
      return msgContent
    },
    formatMsgCreateValidator(msg) {
      const msgContent = []
      const formattedAmt = this.formatAmount(msg.value.amount)
      msgContent.push({
        content: " ",
        wrap: false,
      })
      msgContent.push({
        content: msg.description.moniker,
        wrap: true,
      })
      msgContent.push({
        content: " with address ",
        wrap: false,
      })
      msgContent.push({
        content: msg.validator_address,
        wrap: true,
      })
      msgContent.push({
        content: " self delegated ",
        wrap: false,
      })
      msgContent.push({
        content: formattedAmt,
        wrap: true,
      })
      return msgContent
    },
    formatRegisterWrkchain(msg) {
      const msgContent = []
      msgContent.push({
        content: " ",
        wrap: false,
      })
      msgContent.push({
        content: msg.name,
        wrap: true,
      })
      msgContent.push({
        content: " with Moniker ",
        wrap: false,
      })
      msgContent.push({
        content: msg.moniker,
        wrap: true,
      })
      return msgContent
    },
    formatRegisterBeacon(msg) {
      const msgContent = []
      msgContent.push({
        content: " ",
        wrap: false,
      })
      msgContent.push({
        content: msg.name,
        wrap: true,
      })
      msgContent.push({
        content: " with Moniker ",
        wrap: false,
      })
      msgContent.push({
        content: msg.moniker,
        wrap: true,
      })
      return msgContent
    },
    formatRecordWrkchainHash(msg) {
      // Todo: get WRKChain moniker instead of outputting ID
      const msgContent = []
      msgContent.push({
        content: " ",
        wrap: false,
      })
      msgContent.push({
        content: msg.blockhash,
        wrap: true,
      })
      msgContent.push({
        content: " for height ",
        wrap: false,
      })
      msgContent.push({
        content: msg.height,
        wrap: true,
      })
      msgContent.push({
        content: " on WRKChain ",
        wrap: false,
      })
      msgContent.push({
        content: msg.wrkchain_id,
        wrap: true,
      })
      return msgContent
    },
    formatRecordBeaconTimestamp(msg) {
      // Todo: get BEACON moniker instead of outputting ID
      const msgContent = []
      const formattedTime = this.formatDateTime(msg.submit_time)
      msgContent.push({
        content: " Hash value ",
        wrap: false,
      })
      msgContent.push({
        content: msg.hash,
        wrap: true,
      })
      msgContent.push({
        content: " Timestamped at ",
        wrap: false,
      })
      msgContent.push({
        content: formattedTime,
        wrap: true,
      })
      msgContent.push({
        content: " for BEACON ",
        wrap: false,
      })
      msgContent.push({
        content: msg.beacon_id,
        wrap: true,
      })
      return msgContent
    },
  },
}
</script>
