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
            Network: {{ chainIdOut }}
            <b-icon-info-circle id="network-info-popover" v-show="chainId !== null"/>
            <b-popover target="network-info-popover" triggers="hover" placement="bottom">
              <template v-slot:title>Node & Network Info</template>
              <p>
                REST: <span class="text-info">{{ $refs.walletComponent.rest }}</span><br/>
                Chain ID: <span class="text-info">{{ chainId }}</span> <br/>
                Node Moniker: <span class="text-info">{{ nodeInfo.moniker }}</span>
              </p>
              <h6>{{ nodeAppVersion.name  }}</h6>
              <p>
                <span class="text-info">
                  {{ nodeAppVersion.server_name  }} v{{ nodeAppVersion.version  }}<br>
                  {{ nodeAppVersion.client_name  }} v{{ nodeAppVersion.version  }}
                </span>
              </p>
            </b-popover>
          </b-navbar-brand>
          <b-dropdown variant="primary" class="mx-1" right text="My Wallet">
            <b-dropdown-item>
              <b-button variant="success" @click="$refs.walletComponent.newWallet()"
                        v-show="!$refs.walletComponent.wallet.isWalletUnlocked">Create New Wallet
              </b-button>
            </b-dropdown-item>

            <b-dropdown-item>
              <b-button variant="primary" @click="$refs.walletComponent.showRecoverWalletModal()"
                        v-show="!$refs.walletComponent.wallet.isWalletUnlocked">Recover Wallet
              </b-button>
            </b-dropdown-item>

            <b-dropdown-item>
              <b-button variant="primary" @click="$refs.walletComponent.showUnlockWalletModal()"
                        v-show="!$refs.walletComponent.wallet.isWalletUnlocked">Unlock Wallet
              </b-button>
            </b-dropdown-item>

            <b-dropdown-item>
              <b-button variant="warning" @click="$refs.walletComponent.closeWallet()"
                        v-show="$refs.walletComponent.wallet.isWalletUnlocked">Close Wallet
              </b-button>
            </b-dropdown-item>
          </b-dropdown>


        </template>
        <b-dropdown right id="networkdropdown" ref="networkdropdown">
          <!-- Using 'button-content' slot -->
          <template v-slot:button-content>
            <em>Change Network</em>
          </template>
          <b-dropdown-item href="#"
                           @click="$refs.walletComponent.changeNetwork('https://rest.unification.io')">
            MainNet - https://rest.unification.io
          </b-dropdown-item>
          <b-dropdown-item href="#"
                           @click="$refs.walletComponent.changeNetwork('https://rest-testnet.unification.io')">
            TestNet - https://rest-testnet.unification.io
          </b-dropdown-item>

          <b-dropdown-divider/>

          <b-dropdown-form href="#" @submit.stop.prevent>
            <b-form inline>
              <b-input
              id="custom-rest"
              v-model="customRest"
              type="url"
              trim
              placeholder="Custom - http:// or https://"
             />
              <b-button variant="primary" @click="$refs.walletComponent.changeNetwork(customRest), $refs.networkdropdown.hide(true)">Connect</b-button>
            </b-form>

          </b-dropdown-form>
        </b-dropdown>
      </b-navbar-nav>
    </b-navbar>

    <b-container fluid>
      <div class="main-content">
        <Wallet ref="walletComponent" v-bind:is-web="isWeb"/>
      </div>
    </b-container>

    <b-navbar toggleable="lg" type="dark" variant="info">
      <b-navbar-brand>
        2019 - {{ yearNow }} Unification Foundation
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
  import { mapState } from 'vuex'
  // @ is an alias to /src
  import Wallet from '@/components/Wallet.vue'
  import {version} from '../../package.json';

  export default {
    name: 'home',
    components: {
      Wallet
    },
    props: {
      isWeb: Boolean
    },
    mounted() {
      this.mounted = true;
    },
    data: function () {
      return {
        mounted: false,
        wallet_version: version,
        customRest: null
      }
    },
    computed: {
      ...mapState({
        client: state => state.client.client,
        chainId: state => state.client.chainId,
        nodeInfo: state => state.client.nodeInfo,
        nodeAppVersion: state => state.client.nodeAppVersion,
      }),
      chainIdOut: function() {
        if(this.chainId !== null) {
          return this.chainId
        } else {
          return 'Not connected'
        }
      },
      yearNow: function() {
        let d = new Date()
        return d.getFullYear()
      }
    }
  }
</script>
