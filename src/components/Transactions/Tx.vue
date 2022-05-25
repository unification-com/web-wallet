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
      v-show="!txSummary.txSuccess && fullTx.txData !== undefined"
      class="badge badge-danger"
      style=" margin-right:5px;"
    >
      <b-icon-exclamation-triangle style="width:20px; height:20px" />
    </span>
    <span
      v-show="txSummary.isSent && fullTx.txData === undefined"
      class="badge badge-info"
      style=" margin-right:5px;"
    >
      <b-icon-hourglass style="width:20px; height:20px" />
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
      if (this.fullTx.txResponse === null || this.fullTx.txResponse === undefined) {
        this.formattedMsgs = [{ formatted: "...", action: "Pending", badge: "badge badge-info", key: 0 }]
        this.txSummary.height = ""
        this.txSummary.gas_wanted = ""
        this.txSummary.gas_used = ""
        this.txSummary.fee = ""
        this.txSummary.memo = ""
        this.txSummary.formattedDate = ""
      } else {
        this.txSummary.height = this.fullTx.txResponse.height
        this.txSummary.gas_wanted = this.fullTx.txResponse.gas_wanted
        this.txSummary.gas_used = this.fullTx.txResponse.gas_used
        this.txSummary.fee =
          this.fullTx.txData.auth_info.fee.amount[0].amount + this.fullTx.txData.auth_info.fee.amount[0].denom
        this.txSummary.memo = this.fullTx.txData.body.memo
        this.txSummary.formattedDate = this.formatDateTime(this.txSummary.timestamp)

        if (this.txSummary.txSuccess === false) {
          this.failReason = this.fullTx.txResponse.raw_log
        }

        this.formattedMsgs = []

        for (let i = 0; i < this.fullTx.txData.body.messages.length; i += 1) {
          const msg = this.fullTx.txData.body.messages[i]
          const formattedObj = {
            formatted: "",
            action: "",
            badge: "",
            key: i,
          }

          switch (msg["@type"]) {
            case "/cosmos.bank.v1beta1.MsgSend": {
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
              formattedObj.formatted = this.formatMsgSend(msg)
              break
            }
            case "/cosmos.staking.v1beta1.MsgDelegate": {
              if (this.txSummary.txSuccess === false) {
                formattedObj.action = "Delegate"
              } else {
                formattedObj.action = "Delegated"
              }

              formattedObj.badge = "badge badge-staking"
              formattedObj.formatted = this.formatMsgDelegate(msg)
              break
            }
            case "/cosmos.staking.v1beta1.MsgUndelegate": {
              if (this.txSummary.txSuccess === false) {
                formattedObj.action = "Undelegate"
              } else {
                formattedObj.action = "Undelegated"
              }

              formattedObj.badge = "badge badge-staking"
              formattedObj.formatted = this.formatMsgUnDelegate(msg)
              break
            }
            case "/cosmos.staking.v1beta1.MsgBeginRedelegate": {
              if (this.txSummary.txSuccess === false) {
                formattedObj.action = "Redelegate"
              } else {
                formattedObj.action = "Redelegated"
              }

              formattedObj.badge = "badge badge-staking"
              formattedObj.formatted = this.formatMsgBeginRedelegate(msg)
              break
            }
            case "/cosmos.staking.v1beta1.MsgCreateValidator": {
              if (this.txSummary.txSuccess === false) {
                formattedObj.action = "Create Validator"
              } else {
                formattedObj.action = "Created Validator"
              }
              formattedObj.badge = "badge badge-staking"
              formattedObj.formatted = this.formatMsgCreateValidator(msg)
              break
            }
            case "/cosmos.staking.v1beta1.MsgEditValidator": {
              if (this.txSummary.txSuccess === false) {
                formattedObj.action = "Edit Validator"
              } else {
                formattedObj.action = "Edited Validator"
              }
              formattedObj.badge = "badge badge-staking"
              break
            }
            case "/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission": {
              const withdrawCommAmount = this.getEventAttr(
                this.fullTx.txResponse.logs,
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
            case "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward": {
              const withdrawAmount = this.getEventAttr(
                this.fullTx.txResponse.logs,
                "withdraw_rewards",
                "amount",
              ).replace("nund", "")
              if (this.txSummary.txSuccess === false) {
                formattedObj.action = "Withdraw Delegation Reward"
              } else {
                formattedObj.action = "Withdrew Delegation Reward"
              }
              formattedObj.badge = "badge badge-staking"
              formattedObj.formatted = this.formatMsgWithdrawDelegationReward(msg, withdrawAmount)
              break
            }
            // case "cosmos-sdk/MsgModifyWithdrawAddress": {
            //   if (this.txSummary.txSuccess === false) {
            //     formattedObj.action = "Modify Withdraw Address"
            //   } else {
            //     formattedObj.action = "Modified Withdraw Address"
            //   }
            //
            //   formattedObj.badge = "badge badge-staking"
            //   formattedObj.formatted = "" // Todo
            //   break
            // }
            // case "cosmos-sdk/MsgUnjail": {
            //   formattedObj.action = "Unjail"
            //   formattedObj.formatted = "" // Todo
            //   break
            // }
            // case "enterprise/PurchaseUnd": {
            //   if (this.txSummary.txSuccess === false) {
            //     formattedObj.action = "Raise Enterprise Purchase Order"
            //   } else {
            //     formattedObj.action = "Raised Enterprise Purchase Order"
            //   }
            //
            //   formattedObj.badge = "badge badge-enterprise"
            //   formattedObj.formatted = this.formatPurchaseUnd(msg.value)
            //   break
            // }
            // case "enterprise/ProcessUndPurchaseOrder": {
            //   if (this.txSummary.txSuccess === false) {
            //     formattedObj.action = "Process Enterprise Purchase Order"
            //   } else {
            //     formattedObj.action = "Processed Enterprise Purchase Order"
            //   }
            //
            //   formattedObj.badge = "badge badge-enterprise"
            //
            //   formattedObj.formatted = "" // Todo
            //   break
            // }
            case "/mainchain.wrkchain.v1.MsgRegisterWrkChain": {
              if (this.txSummary.txSuccess === false) {
                formattedObj.action = "Register WRKChain"
              } else {
                formattedObj.action = "Registered WRKChain"
              }

              formattedObj.badge = "badge badge-wrkchain"
              formattedObj.formatted = this.formatRegisterWrkchain(msg)
              break
            }
            case "/mainchain.wrkchain.v1.MsgRecordWrkChainBlock": {
              if (this.txSummary.txSuccess === false) {
                formattedObj.action = "Record WRKChain Hash"
              } else {
                formattedObj.action = "Recorded WRKChain Hash"
              }

              formattedObj.badge = "badge badge-wrkchain"
              formattedObj.formatted = this.formatRecordWrkchainHash(msg)
              break
            }
            case "/mainchain.beacon.v1.MsgRegisterBeacon": {
              if (this.txSummary.txSuccess === false) {
                formattedObj.action = "Register BEACON"
              } else {
                formattedObj.action = "Registered BEACON"
              }

              formattedObj.badge = "badge badge-beacon"
              formattedObj.formatted = this.formatRegisterBeacon(msg)
              break
            }
            case "/mainchain.beacon.v1.MsgRecordBeaconTimestamp": {
              if (this.txSummary.txSuccess === false) {
                formattedObj.action = "Record BEACON Timestamp"
              } else {
                formattedObj.action = "Recorded BEACON Timestamp"
              }

              formattedObj.badge = "badge badge-beacon"
              formattedObj.formatted = this.formatRecordBeaconTimestamp(msg)
              break
            }
            case "/cosmos.gov.v1beta1.MsgVote":
              if (this.txSummary.txSuccess === false) {
                formattedObj.action = "Vote on Proposal"
              } else {
                formattedObj.action = "Voted on Proposal"
              }
              formattedObj.badge = "badge badge-info"
              formattedObj.formatted = this.formatVote(msg)
              break
            case "/cosmos.gov.v1beta1.MsgSubmitProposal":
              if (this.txSummary.txSuccess === false) {
                formattedObj.action = "Submit Proposal"
              } else {
                formattedObj.action = "Submitted Proposal"
              }
              formattedObj.badge = "badge badge-info"
              formattedObj.formatted = this.formatSubmitProposal(msg)
              break
            default: {
              formattedObj.formatted = ""
              formattedObj.action = msg["@type"]
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
    formatVote(msg) {
      const msgContent = []
      let option = ""
      switch (msg.option) {
        case "VOTE_OPTION_YES":
          option = "Yes"
          break
        case "VOTE_OPTION_NO":
          option = "No"
          break
        case "VOTE_OPTION_ABSTAIN":
          option = "Abstain"
          break
        case "VOTE_OPTION_NO_WITH_VETO":
          option = "No with Veto"
          break
        default:
          option = ""
          break
      }
      msgContent.push({
        content: " ",
        wrap: false,
      })
      msgContent.push({
        content: " Voted",
        wrap: false,
      })
      msgContent.push({
        content: option,
        wrap: false,
      })
      msgContent.push({
        content: " on Proposal #",
        wrap: false,
      })
      msgContent.push({
        content: msg.proposal_id,
        wrap: false,
      })
      return msgContent
    },
    formatSubmitProposal(msg) {
      const msgContent = []
      msgContent.push({
        content: " ",
        wrap: false,
      })
      msgContent.push({
        content: " Submitted proposal",
        wrap: false,
      })
      msgContent.push({
        content: ` "${msg.content.title}"`,
        wrap: false,
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
