export const UND_CONFIG = {
  BASENUMBER: 10 ** 9, // Math.pow(10, 9),
  BECH32_PREFIX: "und",
  BECH32_VAL_PREFIX: "undvaloper",
  DEFAULT_MEMO: "sent from Unification Web Wallet",
  RECOMMENDED_MIN_BALANCE: 60000000,
  DEFAULT_TRANSFER_FEES: {
    denom: "nund",
    amount: "20000000",
    gas: "200000",
  },
  DEFAULT_RAISE_PO_FEE: {
    denom: "nund",
    amount: "10000000",
    gas: "100000",
  },
  DEFULT_DELEGATE_FEE: {
    denom: "nund",
    amount: "45000000",
    gas: "250000",
  },
  DEFAULT_UNDELEGATE_FEE: {
    denom: "nund",
    amount: "45000000",
    gas: "250000",
  },
  DEFAULT_REDELEGATE_FEE: {
    denom: "nund",
    amount: "60000000",
    gas: "280000",
  },
  DEFAULT_WITHDRAW_REWARDS_FEE: {
    denom: "nund",
    amount: "25000000",
    gas: "200000",
  },
  DEFAULT_PROPOSAL_VOTE_FEE: {
    denom: "nund",
    amount: "25000000",
    gas: "200000",
  },
}
