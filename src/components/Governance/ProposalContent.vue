<template>
  <div>
    <template v-if="contentType === 'text'">
      <div>
        {{ contentData.description }}
      </div>
    </template>
    <template v-if="contentType === 'community_spend'">
      <div>
        <p>{{ contentData.description }}</p>
        <p>
          Recipient:
          <a :href="explorerUrlPrefix + '/address/' + contentData.recipient" target="_blank">
            {{ contentData.recipient }}
            <b-icon-box-arrow-up-right />
          </a>
        </p>
        <p>Amount: {{ nundToUnd(contentData.amount[0].amount) }} FUND</p>
      </div>
    </template>
    <template v-if="contentType === 'param_change'">
      <div>
        {{ contentData.description }}
        <ul id="param-changes-list">
          <li v-for="item in contentData.changes" :key="`${item.subspace}_${item.key}`">
            {{ item.subspace }} {{ item.key }} {{ item.value }}
          </li>
        </ul>
      </div>
    </template>
    <template v-if="contentType === 'software_upgrade'">
      <div>
        {{ contentData.description }}
        <p><strong>Plan</strong></p>
        <ul id="software-upgrade-list">
          <li>
            <strong>{{ contentData.plan.name }}</strong>
          </li>
          <li>{{ contentData.plan.info }}</li>
          <li v-show="contentData.plan.height !== '0'">Height: {{ contentData.plan.height }}</li>
          <li v-show="contentData.plan.height === '0'">Time: {{ formatDateTime(contentData.plan.time) }}</li>
          <li v-show="contentData.plan.upgraded_client_state">
            {{ contentData.plan.upgraded_client_state }}
          </li>
        </ul>
      </div>
    </template>
    <template v-if="contentType === 'cancel_software_upgrade'">
      <div>
        {{ contentData.description }}
      </div>
    </template>
  </div>
</template>

<script>
export default {
  name: "ProposalContent",
  props: {
    content: Object,
  },
  data() {
    return {
      contentData: this.content,
      contentType: null,
    }
  },
  watch: {
    content(val) {
      this.contentData = val
    },
  },
  computed: {
    explorerUrlPrefix() {
      return this.explorerUrl(this.chainId)
    },
  },
  mounted() {
    this.setContentType()
  },
  methods: {
    setContentType() {
      console.log(this.content)
      switch (this.content["@type"]) {
        case "/cosmos.gov.v1beta1.TextProposal":
          this.contentType = "text"
          break
        case "/cosmos.distribution.v1beta1.CommunityPoolSpendProposal":
          this.contentType = "community_spend"
          break
        case "/cosmos.params.v1beta1.ParameterChangeProposal":
          this.contentType = "param_change"
          break
        case "/cosmos.upgrade.v1beta1.SoftwareUpgradeProposal":
          this.contentType = "software_upgrade"
          break
        case "/cosmos.upgrade.v1beta1.CancelSoftwareUpgradeProposal":
          this.contentType = "cancel_software_upgrade"
          break
        default:
          this.contentType = "unknown"
          break
      }
    },
  },
}
</script>
