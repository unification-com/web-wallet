<template>
  <div class="app-wrapper">
    <Notification />
    <b-navbar toggleable="lg" type="dark" variant="info" sticky>
      <b-navbar-brand>
        <img src="@/assets/images/logo_top.png" /> Mainchain Web Wallet v{{ wallet_version }}
      </b-navbar-brand>

      <!-- Right aligned nav items -->
      <b-navbar-nav class="ml-auto">
        <template v-if="mounted">
          <b-navbar-brand>
            Network: {{ chainIdOut }}
            <b-icon-info-circle v-show="chainId !== null" id="network-info-popover" />
            <b-popover target="network-info-popover" triggers="hover" placement="bottom">
              <template v-slot:title>
                Node & Network Info
              </template>
              <p>
                REST: <span class="text-info">{{ $refs.walletComponent.rest }}</span> <br />
                Chain ID: <span class="text-info">{{ chainId }}</span> <br />
                Node Moniker: <span class="text-info">{{ nodeInfo.moniker }}</span>
              </p>
              <h6>{{ nodeAppVersion.name }}</h6>
              <p>
                <span class="text-info">
                  {{ nodeAppVersion.server_name }} v{{ nodeAppVersion.version }}<br />
                  {{ nodeAppVersion.client_name }} v{{ nodeAppVersion.version }}
                </span>
              </p>
            </b-popover>
          </b-navbar-brand>
          <b-navbar-brand>
            <img
              v-show="ledgerConnected"
              src="@/assets/images/usb.png"
              alt="Ledger device Connected"
              height="29"
              title="Ledger device connected!"
            />
          </b-navbar-brand>
          <b-dropdown variant="primary" class="mx-1" right text="My Wallet">
            <b-dropdown-item>
              <b-button
                v-show="!$refs.walletComponent.wallet.isWalletUnlocked"
                variant="success"
                @click="$refs.walletComponent.newWallet()"
              >
                Create New Wallet
              </b-button>
            </b-dropdown-item>

            <b-dropdown-item>
              <b-button
                v-show="!$refs.walletComponent.wallet.isWalletUnlocked"
                variant="primary"
                @click="$refs.walletComponent.showRecoverWalletModal()"
              >
                Recover Wallet
              </b-button>
            </b-dropdown-item>

            <b-dropdown-item>
              <b-button
                v-show="!$refs.walletComponent.wallet.isWalletUnlocked"
                variant="primary"
                @click="$refs.walletComponent.showUnlockWalletModal()"
              >
                Unlock Wallet
              </b-button>
            </b-dropdown-item>

            <b-dropdown-item>
              <b-button
                v-show="!$refs.walletComponent.wallet.isWalletUnlocked"
                variant="primary"
                @click="
                  $refs.walletComponent.showConnectLedgerModal(), $refs.walletComponent.selectLedgerWallet()
                "
              >
                Connect Ledger Device
              </b-button>
            </b-dropdown-item>

            <b-dropdown-item>
              <b-button
                v-show="$refs.walletComponent.wallet.isWalletUnlocked"
                variant="primary"
                @click="$refs.walletComponent.closeWallet()"
              >
                Close Wallet
              </b-button>
            </b-dropdown-item>
          </b-dropdown>
        </template>
        <b-dropdown id="networkdropdown" ref="networkdropdown" right>
          <!-- Using 'button-content' slot -->
          <template v-slot:button-content>
            <em>Change Network</em>
          </template>
          <b-dropdown-item
            href="#"
            @click="$refs.walletComponent.changeNetwork('https://rest.unification.io')"
          >
            MainNet - https://rest.unification.io
          </b-dropdown-item>
          <b-dropdown-item
            href="#"
            @click="$refs.walletComponent.changeNetwork('https://rest-testnet.unification.io')"
          >
            TestNet - https://rest-testnet.unification.io
          </b-dropdown-item>

          <b-dropdown-divider />

          <b-dropdown-form href="#" @submit.stop.prevent>
            <b-form inline>
              <b-input
                id="custom-rest"
                v-model="customRest"
                type="url"
                trim
                placeholder="Custom - http:// or https://"
              />
              <b-button
                variant="primary"
                @click="$refs.walletComponent.changeNetwork(customRest), $refs.networkdropdown.hide(true)"
              >
                Connect
              </b-button>
            </b-form>
          </b-dropdown-form>
        </b-dropdown>
      </b-navbar-nav>
    </b-navbar>

    <b-container fluid>
      <div class="main-content">
        <Wallet ref="walletComponent" :is-web="isWeb" />
      </div>
    </b-container>

    <b-navbar toggleable="lg" type="dark" variant="info">
      <b-navbar-brand> 2019 - {{ yearNow }} Unification Foundation </b-navbar-brand>
      <b-navbar-nav class="ml-auto">
        <div class="socials">
          <a href="https://twitter.com/unificationUND" class="social social_twitter" target="_blank"></a>
          <a href="https://unification.com" class="social social_oracles" target="_blank"></a>
          <a href="https://t.me/unificationfoundation" class="social social_telegram" target="_blank"></a>
          <a
            href="https://github.com/unification-com/web-wallet"
            class="social social_github"
            target="_blank"
          ></a>
        </div>
      </b-navbar-nav>
    </b-navbar>
  </div>
</template>

<script>
import { mapState } from "vuex"
// @ is an alias to /src
import Notification from "./Notification.vue"
import Wallet from "./Wallet.vue"
import { version } from "../../package.json"

export default {
  name: "Home",
  components: {
    Notification,
    Wallet,
  },
  props: {
    isWeb: Boolean,
  },
  data() {
    return {
      mounted: false,
      wallet_version: version,
      customRest: null,
    }
  },
  computed: {
    ...mapState({
      client: state => state.client.client,
      chainId: state => state.client.chainId,
      nodeInfo: state => state.client.nodeInfo,
      nodeAppVersion: state => state.client.nodeAppVersion,
    }),
    chainIdOut() {
      if (this.chainId !== null) {
        return this.chainId
      }
      return "Not connected"
    },
    ledgerConnected() {
      if (this.client !== null) {
        return this.client.isLedgerMode
      }
      return false
    },
    yearNow() {
      const d = new Date()
      return d.getFullYear()
    },
  },
  mounted() {
    this.mounted = true
  },
}
</script>
