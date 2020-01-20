export const UND_CONFIG = {
  BASENUMBER: Math.pow(10, 9),
  BECH32_PREFIX: 'und',
  BECH32_VAL_PREFIX: 'undvaloper',
  DEFAULT_MEMO: 'sent from Unification Web Wallet',
  DEFAULT_TRANSFER_FEES: {
    amount: [
      {
        denom: "nund",
        amount: "5000"
      }
    ],
    gas: "190000"
  },
  DEFAULT_RAISE_PO_FEE: {
    amount: [
      {
        denom: "nund",
        amount: "2500"
      }
    ],
    gas: "90000"
  },
  DEFULT_DELEGATE_FEE: {
    amount: [
      {
        denom: "nund",
        amount: "11000"
      }
    ],
    gas: "210000"
  },
  DEFAULT_UNDELEGATE_FEE: {
    amount: [
      {
        denom: "nund",
        amount: "11000"
      }
    ],
    gas: "210000"
  },
  DEFAULT_REDELEGATE_FEE: {
    amount: [
      {
        denom: "nund",
        amount: "15000"
      }
    ],
    gas: "250000"
  },
  DEFAULT_WITHDRAW_REWARDS_FEE: {
    amount: [
      {
        denom: "nund",
        amount: "6000"
      }
    ],
    gas: "190000"
  }
}
