import { describe, expect, it } from 'vitest'

import { buildVaultSigner } from './signer'
import { addressFromPrivateKey, deriveAccount } from './vault/seeds'
import {
  emptyVault,
  type ImportedKeyEntry,
  type SeedEntry,
  type Vault,
} from './vault/types'

const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

const TEST_PRIVATE_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

async function makeVaultWithSeed(): Promise<{ vault: Vault; seed: SeedEntry }> {
  const account0 = await deriveAccount(TEST_MNEMONIC, 0)
  const account1 = await deriveAccount(TEST_MNEMONIC, 1)
  const seed: SeedEntry = {
    id: '11111111-1111-4111-8111-111111111111',
    label: 'Seed 1',
    mnemonic: TEST_MNEMONIC,
    accounts: [
      { index: 0, label: 'Account 1', address: account0.address },
      { index: 1, label: 'Account 2', address: account1.address },
    ],
    createdAt: 1_700_000_000_000,
  }
  return { vault: { ...emptyVault(), seeds: [seed] }, seed }
}

async function makeVaultWithImported(): Promise<{
  vault: Vault
  entry: ImportedKeyEntry
}> {
  const { address } = await addressFromPrivateKey(TEST_PRIVATE_KEY)
  const entry: ImportedKeyEntry = {
    id: '22222222-2222-4222-8222-222222222222',
    label: 'v1 wallet',
    privateKey: TEST_PRIVATE_KEY,
    address,
    source: 'v1-json',
    createdAt: 1_700_000_001_000,
  }
  return { vault: { ...emptyVault(), importedKeys: [entry] }, entry }
}

describe('signer.buildVaultSigner', () => {
  describe('vault-seed', () => {
    it('builds a signer for an existing seed account at index 0', async () => {
      const { vault, seed } = await makeVaultWithSeed()
      const { signer, address } = await buildVaultSigner(vault, {
        kind: 'vault-seed',
        seedId: seed.id,
        accountIndex: 0,
      })
      expect(address).toBe(seed.accounts[0].address)
      const accounts = await signer.getAccounts()
      expect(accounts[0]?.address).toBe(seed.accounts[0].address)
    })

    it('builds a signer for a seed account at index 1', async () => {
      const { vault, seed } = await makeVaultWithSeed()
      const { signer, address } = await buildVaultSigner(vault, {
        kind: 'vault-seed',
        seedId: seed.id,
        accountIndex: 1,
      })
      expect(address).toBe(seed.accounts[1].address)
      const accounts = await signer.getAccounts()
      expect(accounts[0]?.address).toBe(seed.accounts[1].address)
    })

    it('signer at different indices produces different addresses', async () => {
      const { vault, seed } = await makeVaultWithSeed()
      const a = await buildVaultSigner(vault, {
        kind: 'vault-seed',
        seedId: seed.id,
        accountIndex: 0,
      })
      const b = await buildVaultSigner(vault, {
        kind: 'vault-seed',
        seedId: seed.id,
        accountIndex: 1,
      })
      expect(a.address).not.toBe(b.address)
    })

    it('throws when the seed does not exist', async () => {
      const { vault } = await makeVaultWithSeed()
      await expect(
        buildVaultSigner(vault, {
          kind: 'vault-seed',
          seedId: '99999999-9999-4999-8999-999999999999',
          accountIndex: 0,
        }),
      ).rejects.toThrow(/seed .* not found/)
    })

    it('throws when the account index is not registered on the seed', async () => {
      const { vault, seed } = await makeVaultWithSeed()
      await expect(
        buildVaultSigner(vault, {
          kind: 'vault-seed',
          seedId: seed.id,
          accountIndex: 99,
        }),
      ).rejects.toThrow(/account index 99 not found/)
    })
  })

  describe('vault-imported', () => {
    it('builds a signer for an imported key', async () => {
      const { vault, entry } = await makeVaultWithImported()
      const { signer, address } = await buildVaultSigner(vault, {
        kind: 'vault-imported',
        id: entry.id,
      })
      expect(address).toBe(entry.address)
      const accounts = await signer.getAccounts()
      expect(accounts[0]?.address).toBe(entry.address)
    })

    it('throws when the imported key does not exist', async () => {
      const { vault } = await makeVaultWithImported()
      await expect(
        buildVaultSigner(vault, {
          kind: 'vault-imported',
          id: '99999999-9999-4999-8999-999999999999',
        }),
      ).rejects.toThrow(/imported key .* not found/)
    })
  })

  it('signer address from a seed-derived path matches addressFromPrivateKey for the same private key', async () => {
    const { vault, seed } = await makeVaultWithSeed()
    const seedSigner = await buildVaultSigner(vault, {
      kind: 'vault-seed',
      seedId: seed.id,
      accountIndex: 0,
    })
    // Derive the privkey from the seed directly via deriveAccount, then build
    // an addressFromPrivateKey — should match the signer's address. Proves
    // both code paths converge on the same address for the same key material.
    const derived = await deriveAccount(seed.mnemonic, 0)
    const { address: directAddress } = await addressFromPrivateKey(derived.privateKey)
    expect(seedSigner.address).toBe(directAddress)
  })
})
