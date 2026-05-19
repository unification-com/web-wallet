<template>
  <div>
    <canvas :id="`votes-chart-${proposalId}`" height="70"></canvas>
  </div>
</template>

<script>
import Chart from "chart.js"

export default {
  name: "VotesChart",
  props: {
    yes: String,
    no: String,
    abstain: String,
    veto: String,
    proposal_id: Number,
  },
  data() {
    return {
      proposalId: this.proposal_id,
      chartData: {
        type: "horizontalBar",
        data: {
          labels: ["Yes", "No", "Abstain", "No With Veto"],
          datasets: [],
        },
        options: {
          legend: {
            display: false,
          },
          responsive: true,
          lineTension: 1,
        },
      },
    }
  },
  mounted() {
    const d = {
      // label: "% Votes",
      data: [this.yes, this.no, this.abstain, this.veto],
      backgroundColor: ["#42a85f", "#e54d42", "#2d6ba6", "#f48a06"],
      borderColor: ["#31974e", "#d43c31", "#1c5a95", "#e37905"],
      borderWidth: 3,
      barThickness: 20,
      maxBarThickness: 20,
    }
    this.chartData.data.datasets.push(d)
    this.proposalId = this.proposal_id
    const ctx = document.getElementById(`votes-chart-${this.proposal_id}`)
    // eslint-disable-next-line no-new
    new Chart(ctx, this.chartData)
  },
}
</script>
