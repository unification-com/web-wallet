<template>
  <div>
    <b-modal id="bv-modal-show-private-key" size="lg">
      <template v-slot:modal-title>
        <h3>Your private key</h3>
      </template>

      <div>
        <span class="private_key">{{ "0x" + client.privKey.toString("hex") }}</span>
      </div>

      <template v-slot:modal-footer>
        <b-button variant="primary" @click="$bvModal.hide('bv-modal-show-private-key')">Close</b-button>
      </template>
    </b-modal>

    <b-button variant="primary" @click="$bvModal.show('bv-modal-show-private-key')"
      >Show private key</b-button
    >
  </div>
</template>

<script>
import { mapState } from "vuex"

export default {
  name: "Recovery",
  computed: {
    ...mapState({
      client: state => state.client.client,
      chainId: state => state.client.chainId,
      isClientConnected: state => state.client.isConnected,
      wallet: state => state.wallet,
      txs: state => state.txs,
      validators: state => state.validators,
      delegations: state => state.delegations,
    }),
  },
}
</script>

<style scoped></style>
