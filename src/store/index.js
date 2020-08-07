import Vue from "vue"
import Vuex from "vuex"
import client from "./modules/client"
import delegations from "./modules/delegations"
import txs from "./modules/txs"
import validators from "./modules/validators"
import wallet from "./modules/wallet"
import createLogger from "../plugins/logger"

Vue.use(Vuex)

const debug = process.env.NODE_ENV !== "production"

export default new Vuex.Store({
  modules: {
    client,
    delegations,
    txs,
    validators,
    wallet,
  },
  strict: debug,
  plugins: debug ? [createLogger()] : [],
})
