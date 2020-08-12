import Big from "big.js"
import { UND_CONFIG } from "../../constants"

// initial state
const state = {
  isWalletUnlocked: false,
  json: null,
  walletFile: null,
  privateKey: null,
  balance: "0",
  balanceNund: "0",
  locked: "0",
  lockedNund: "0",
  address: null,
  staking: {
    totalRewards: "0",
    totalShares: "0",
    totalStaked: "0",
    totalUnbonding: "0",
    totalDelegations: 0,
  },
  totalBalance: "0",
  accountExists: false,
  entWhitelisted: false,
}

// getters
const getters = {}

// actions
const actions = {
  clearWallet(context) {
    context.commit("clearWallet")
  },
  setPrivateKey(context, privateKey) {
    context.commit("setPrivateKey", privateKey)
  },
  setAddress(context, address) {
    context.commit("setAddress", address)
  },
  setWalletFile(context, walletFile) {
    context.commit("setWalletFile", walletFile)
  },
  setJson(context, json) {
    context.commit("setJson", json)
  },
  setIsWalletUnlocked(context, isWalletUnlocked) {
    context.commit("setIsWalletUnlocked", isWalletUnlocked)
  },
  setBalance(context, balanceNund) {
    context.commit("setBalanceNund", balanceNund)
    const amount = new Big(balanceNund)
    const balance = Number(amount.div(UND_CONFIG.BASENUMBER))
    context.commit("setBalance", balance)
  },
  setEnterpriseLocked(context, lockedNund) {
    context.commit("setLockedNund", lockedNund)
    const amount = new Big(lockedNund)
    const locked = Number(amount.div(UND_CONFIG.BASENUMBER))
    context.commit("setLocked", locked)
  },
  setTotalDelegations(context, totalDelegations) {
    context.commit("setTotalDelegations", totalDelegations)
  },
  setTotalShares(context, totalShares) {
    context.commit("setTotalShares", Number(totalShares))
  },
  setTotalStaked(context, totalStaked) {
    context.commit("setTotalStaked", Number(totalStaked))
  },
  setTotalRewards(context, totalRewards) {
    context.commit("setTotalRewards", Number(totalRewards))
  },
  setTotalUnbonding(context, totalUnbonding) {
    context.commit("setTotalUnbonding", Number(totalUnbonding))
  },
  setTotalBalance(context, totalBalance) {
    context.commit("setTotalBalance", totalBalance)
  },
  setAccountExists(context, accountExists) {
    context.commit("setAccountExists", accountExists)
  },
  setEntWhitelisted(context, entWhitelisted) {
    context.commit("setEntWhitelisted", entWhitelisted)
  },
}

// mutations
const mutations = {
  clearWallet(state) {
    state.isWalletUnlocked = false
    state.json = null
    state.walletFile = null
    state.privateKey = null
    state.balance = "0"
    state.balanceNund = "0"
    state.locked = "0"
    state.lockedNund = "0"
    state.address = null
    state.staking = {
      totalRewards: "0",
      totalShares: "0",
      totalStaked: "0",
      totalUnbonding: "0",
      totalDelegations: 0,
    }
    state.totalBalance = "0"
    state.accountExists = false
    state.entWhitelisted = false
  },
  setPrivateKey(state, privateKey) {
    state.privateKey = privateKey
  },
  setAddress(state, address) {
    state.address = address
  },
  setWalletFile(state, walletFile) {
    state.walletFile = walletFile
  },
  setJson(state, json) {
    state.json = json
  },
  setIsWalletUnlocked(state, isWalletUnlocked) {
    state.isWalletUnlocked = isWalletUnlocked
  },
  setBalance(state, balance) {
    state.balance = balance
  },
  setBalanceNund(state, balanceNund) {
    state.balanceNund = balanceNund
  },
  setLocked(state, locked) {
    state.locked = locked
  },
  setLockedNund(state, lockedNund) {
    state.lockedNund = lockedNund
  },
  setTotalDelegations(state, totalDelegations) {
    state.staking.totalDelegations = totalDelegations
  },
  setTotalShares(state, totalShares) {
    state.staking.totalShares = totalShares
  },
  setTotalStaked(state, totalStaked) {
    state.staking.totalStaked = totalStaked
  },
  setTotalRewards(state, totalRewards) {
    state.staking.totalRewards = totalRewards
  },
  setTotalUnbonding(state, totalUnbonding) {
    state.staking.totalUnbonding = totalUnbonding
  },
  setTotalBalance(state, totalBalance) {
    state.totalBalance = totalBalance
  },
  setAccountExists(state, accountExists) {
    state.accountExists = accountExists
  },
  setEntWhitelisted(state, entWhitelisted) {
    state.entWhitelisted = entWhitelisted
  },
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
}
