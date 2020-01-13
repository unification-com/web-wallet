<template>
  <div class="app-wrapper">

    <b-navbar toggleable="lg" type="dark" variant="info" sticky>
      <b-navbar-brand>
        <img src="@/assets/images/logo_top.png"/> Mainchain Web Wallet v{{ wallet_version }}
      </b-navbar-brand>

      <!-- Right aligned nav items -->
      <b-navbar-nav class="ml-auto">
        <template v-if="mounted">
          <b-navbar-brand>
            Network: {{ $refs.walletComponent.chainId }}
          </b-navbar-brand>
          <b-button variant="success" @click="$refs.walletComponent.newWallet()"
                    v-show="!$refs.walletComponent.wallet.isWalletUnlocked">Create New Wallet
          </b-button>

          <b-button variant="primary" @click="$refs.walletComponent.showUnlockWalletModal()"
                    v-show="!$refs.walletComponent.wallet.isWalletUnlocked">Unlock Wallet
          </b-button>

          <b-button variant="warning" @click="$refs.walletComponent.clearData()"
                    v-show="$refs.walletComponent.wallet.isWalletUnlocked">Close Wallet
          </b-button>
        </template>
        <b-nav-item-dropdown right>
          <!-- Using 'button-content' slot -->
          <template v-slot:button-content>
            <em>Change Network</em>
          </template>
          <b-dropdown-item href="#"
                           @click="$refs.walletComponent.changeNetwork('https://rest-testnet.unification.io')">
            TestNet - https://rest-testnet.unification.io
          </b-dropdown-item>
          <b-dropdown-item href="#" @click="$refs.walletComponent.changeNetwork('http://localhost:1318')">
            DevNet - http://localhost:1318
          </b-dropdown-item>
        </b-nav-item-dropdown>
      </b-navbar-nav>
    </b-navbar>

    <b-container fluid>
      <div class="main-content">
        <Wallet ref="walletComponent"/>
      </div>
    </b-container>

    <b-navbar toggleable="lg" type="dark" variant="info">
      <b-navbar-brand>
        2020 Unification Foundation.
      </b-navbar-brand>
      <b-navbar-nav class="ml-auto">
        <div class="socials">
          <a href="https://twitter.com/unificationUND" class="social social_twitter" target="_blank"></a>
          <a href="https://unification.com" class="social social_oracles" target="_blank"></a>
          <a href="https://t.me/unificationfoundation" class="social social_telegram" target="_blank"></a>
          <a href="https://github.com/unification-com/web-wallet" class="social social_github" target="_blank"></a>
        </div>
      </b-navbar-nav>
    </b-navbar>
  </div>
</template>

<script>
  // @ is an alias to /src
  import Wallet from '@/components/Wallet.vue'
  import {version} from '../../package.json';

  export default {
    name: 'home',
    components: {
      Wallet
    },
    mounted() {
      this.mounted = true;
    },
    data: function () {
      return {
        mounted: false,
        wallet_version: version
      }
    }
  }
</script>
