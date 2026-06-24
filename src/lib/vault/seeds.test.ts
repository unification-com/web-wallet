import { stringToPath } from '@cosmjs/crypto'
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'
import { describe, expect, it } from 'vitest'

import { deriveAccount, generateMnemonic, validateMnemonic } from './seeds'

// Famous BIP39 test mnemonic — well-known + widely used in test fixtures.
const TEST_MNEMONIC_12 =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const TEST_MNEMONIC_24 =
  'legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth title'

describe('vault.seeds.generateMnemonic', () => {
  it('produces a 12-word phrase at 128-bit strength', () => {
    const m = generateMnemonic(128)
    expect(m.split(' ')).toHaveLength(12)
    expect(validateMnemonic(m)).toBe(true)
  })

  it('produces a 24-word phrase at 256-bit strength', () => {
    const m = generateMnemonic(256)
    expect(m.split(' ')).toHaveLength(24)
    expect(validateMnemonic(m)).toBe(true)
  })

  it('produces unique phrases on each call', () => {
    expect(generateMnemonic(128)).not.toBe(generateMnemonic(128))
  })
})

describe('vault.seeds.validateMnemonic', () => {
  it('accepts the known 12-word test vector', () => {
    expect(validateMnemonic(TEST_MNEMONIC_12)).toBe(true)
  })

  it('accepts the known 24-word test vector', () => {
    expect(validateMnemonic(TEST_MNEMONIC_24)).toBe(true)
  })

  it('rejects a mnemonic with the wrong word count', () => {
    expect(validateMnemonic('abandon abandon about')).toBe(false)
  })

  it('rejects a mnemonic with an unknown word', () => {
    expect(
      validateMnemonic(
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon zzzzzzzz',
      ),
    ).toBe(false)
  })

  it('rejects a mnemonic that fails the checksum (last word wrong)', () => {
    expect(
      validateMnemonic(
        // valid words but the checksum word is "about" — flip to a different valid word
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon',
      ),
    ).toBe(false)
  })
})

describe('vault.seeds.deriveAccount', () => {
  it('derives a `und1…` bech32 address with the correct format', async () => {
    const account = await deriveAccount(TEST_MNEMONIC_12, 0)
    expect(account.address).toMatch(/^und1[a-z0-9]{38,58}$/)
    expect(account.privateKey).toMatch(/^[0-9a-f]{64}$/)
    expect(account.publicKey).toMatch(/^[0-9a-f]{66}$/) // compressed
  })

  it('is deterministic for the same mnemonic + index', async () => {
    const a = await deriveAccount(TEST_MNEMONIC_12, 0)
    const b = await deriveAccount(TEST_MNEMONIC_12, 0)
    expect(a).toEqual(b)
  })

  it('produces different addresses for different indices', async () => {
    const a0 = await deriveAccount(TEST_MNEMONIC_12, 0)
    const a1 = await deriveAccount(TEST_MNEMONIC_12, 1)
    const a2 = await deriveAccount(TEST_MNEMONIC_12, 2)
    expect(a0.address).not.toBe(a1.address)
    expect(a1.address).not.toBe(a2.address)
    expect(a0.address).not.toBe(a2.address)
  })

  it('produces different addresses for different mnemonics', async () => {
    const a = await deriveAccount(TEST_MNEMONIC_12, 0)
    const b = await deriveAccount(TEST_MNEMONIC_24, 0)
    expect(a.address).not.toBe(b.address)
  })

  // Cross-check against cosmjs's canonical implementation. If our manual
  // SLIP-10 derivation matches `DirectSecp256k1HdWallet.fromMnemonic`'s
  // output, we know we're producing the right addresses.
  it('address matches cosmjs DirectSecp256k1HdWallet output (canonical impl)', async () => {
    const ours = await deriveAccount(TEST_MNEMONIC_12, 0)
    const cosmjsWallet = await DirectSecp256k1HdWallet.fromMnemonic(TEST_MNEMONIC_12, {
      hdPaths: [stringToPath(`m/44'/5555'/0'/0/0`)],
      prefix: 'und',
    })
    const [cosmjsAccount] = await cosmjsWallet.getAccounts()
    expect(cosmjsAccount).toBeDefined()
    expect(ours.address).toBe(cosmjsAccount.address)
  })

  it('cross-checks correctly at index 5 too', async () => {
    const ours = await deriveAccount(TEST_MNEMONIC_12, 5)
    const cosmjsWallet = await DirectSecp256k1HdWallet.fromMnemonic(TEST_MNEMONIC_12, {
      hdPaths: [stringToPath(`m/44'/5555'/0'/0/5`)],
      prefix: 'und',
    })
    const [cosmjsAccount] = await cosmjsWallet.getAccounts()
    expect(ours.address).toBe(cosmjsAccount.address)
  })

  it('rejects an invalid mnemonic', async () => {
    await expect(deriveAccount('not a real mnemonic', 0)).rejects.toThrow(
      /invalid BIP39/,
    )
  })

  it('rejects a negative index', async () => {
    await expect(deriveAccount(TEST_MNEMONIC_12, -1)).rejects.toThrow(
      /non-negative integer/,
    )
  })

  it('rejects a non-integer index', async () => {
    await expect(deriveAccount(TEST_MNEMONIC_12, 1.5)).rejects.toThrow(
      /non-negative integer/,
    )
  })
})
