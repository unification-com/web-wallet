<template>
  <span :class="badge">{{ statusText }}</span>
</template>

<script>
export default {
  name: "ProposalStatus",
  props: {
    status: String,
  },
  data() {
    return {
      statusProp: this.status,
      statusText: "",
      action: "",
      badge: "badge badge-info",
    }
  },
  watch: {
    status(val) {
      this.statusProp = val
      this.formatStatus()
    },
  },
  mounted() {
    this.formatStatus()
  },
  methods: {
    formatStatus() {
      this.statusText = ""
      this.action = ""
      this.badge = "badge badge-info"
      switch (this.statusProp) {
        case "PROPOSAL_STATUS_UNSPECIFIED":
        default:
          this.statusText = "Unknown"
          this.action = ""
          this.badge = "badge badge-info"
          break
        case "PROPOSAL_STATUS_DEPOSIT_PERIOD":
          this.statusText = "Depositing"
          this.action = ""
          this.badge = "badge badge-info"
          break
        case "PROPOSAL_STATUS_VOTING_PERIOD":
          this.statusText = "Voting"
          this.action = ""
          this.badge = "badge badge-info"
          break
        case "PROPOSAL_STATUS_PASSED":
          this.statusText = "Passed"
          this.action = ""
          this.badge = "badge badge-success"
          break
        case "PROPOSAL_STATUS_REJECTED":
          this.statusText = "Rejected"
          this.action = ""
          this.badge = "badge badge-danger"
          break
        case "PROPOSAL_STATUS_FAILED":
          this.statusText = "Failed"
          this.action = ""
          this.badge = "badge badge-danger"
          break
      }
    },
  },
}
</script>
