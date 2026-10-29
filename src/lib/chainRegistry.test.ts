import { describe, expect, it } from 'vitest'

import { gasPricesFromChainJson } from './chainRegistry'
import { FALLBACK_GAS_PRICES } from './gasEstimate'

describe('chainRegistry.gasPricesFromChainJson', () => {
  it('reads all four tiers from a well-formed chain.json', () => {
    expect(
      gasPricesFromChainJson({
        fees: {
          fee_tokens: [
            {
              denom: 'nund',
              fixed_min_gas_price: 25,
              low_gas_price: 100,
              average_gas_price: 200,
              high_gas_price: 300,
            },
          ],
        },
      }),
    ).toEqual({ fixedMin: 25, low: 100, average: 200, high: 300 })
  })

  it('falls back per field when a value is missing', () => {
    const result = gasPricesFromChainJson({
      fees: {
        fee_tokens: [{ denom: 'nund', fixed_min_gas_price: 25, average_gas_price: 250 }],
      },
    })
    expect(result.fixedMin).toBe(25)
    expect(result.average).toBe(250)
    expect(result.low).toBe(FALLBACK_GAS_PRICES.low)
    expect(result.high).toBe(FALLBACK_GAS_PRICES.high)
  })

  it('falls back wholesale when fees branch is missing entirely', () => {
    expect(gasPricesFromChainJson({})).toEqual({ ...FALLBACK_GAS_PRICES })
  })

  it('ignores non-nund fee tokens', () => {
    expect(
      gasPricesFromChainJson({
        fees: {
          fee_tokens: [
            // Hypothetical secondary fee denom — wallet only cares about nund.
            { denom: 'uatom', fixed_min_gas_price: 999, low_gas_price: 999 },
          ],
        },
      }),
    ).toEqual({ ...FALLBACK_GAS_PRICES })
  })

  it('picks the nund entry even when other denoms are listed first', () => {
    expect(
      gasPricesFromChainJson({
        fees: {
          fee_tokens: [
            { denom: 'uatom', fixed_min_gas_price: 999 },
            {
              denom: 'nund',
              fixed_min_gas_price: 25,
              low_gas_price: 110,
              average_gas_price: 220,
              high_gas_price: 330,
            },
          ],
        },
      }),
    ).toEqual({ fixedMin: 25, low: 110, average: 220, high: 330 })
  })
})
