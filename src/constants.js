export const UND_CONFIG = {
  BASENUMBER: 10 ** 9, // Math.pow(10, 9),
  BECH32_PREFIX: "und",
  BECH32_VAL_PREFIX: "undvaloper",
  DEFAULT_MEMO: "sent from Unification Web Wallet",
  RECOMMENDED_MIN_BALANCE: 600000,
  DEFAULT_TRANSFER_FEES: {
    amount: [
      {
        denom: "nund",
        amount: "200000",
      },
    ],
    gas: "190000",
  },
  DEFAULT_RAISE_PO_FEE: {
    amount: [
      {
        denom: "nund",
        amount: "100000",
      },
    ],
    gas: "90000",
  },
  DEFULT_DELEGATE_FEE: {
    amount: [
      {
        denom: "nund",
        amount: "450000",
      },
    ],
    gas: "210000",
  },
  DEFAULT_UNDELEGATE_FEE: {
    amount: [
      {
        denom: "nund",
        amount: "450000",
      },
    ],
    gas: "210000",
  },
  DEFAULT_REDELEGATE_FEE: {
    amount: [
      {
        denom: "nund",
        amount: "600000",
      },
    ],
    gas: "250000",
  },
  DEFAULT_WITHDRAW_REWARDS_FEE: {
    amount: [
      {
        denom: "nund",
        amount: "250000",
      },
    ],
    gas: "190000",
  },
}
