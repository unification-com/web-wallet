import { fromBase64, toBase64 } from '@cosmjs/encoding'
import { describe, expect, it } from 'vitest'

import { decryptVault, encryptVault } from './crypto'
import { EncryptedVaultSchema, emptyVault, type Vault } from './types'

// Each crypto round-trip costs ~500ms (600k PBKDF2 iterations × 2 derivations).
// Keep the test count modest.

const PASSWORD = 'correct-horse-battery-staple'
const WRONG_PASSWORD = 'tr0ub4dor&3'

function makeRichVault(): Vault {
  const v = emptyVault()
  return {
    ...v,
    seeds: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        label: 'Seed 1',
        mnemonic: 'word '.repeat(11).trim() + ' word', // 12-word placeholder
        accounts: [
          {
            index: 0,
            label: 'Account 1',
            address: 'und1' + 'q'.repeat(38),
          },
        ],
        createdAt: 1_700_000_000_000,
      },
    ],
    importedKeys: [
      {
        id: '22222222-2222-4222-8222-222222222222',
        label: 'v1 wallet',
        privateKey: 'a'.repeat(64),
        address: 'und1' + 'w'.repeat(38),
        source: 'v1-json' as const,
        createdAt: 1_700_000_001_000,
      },
    ],
    preferences: {
      ...v.preferences,
      activeEndpointId: 'testnet',
      activeSignerRef: {
        kind: 'vault-seed' as const,
        seedId: '11111111-1111-4111-8111-111111111111',
        accountIndex: 0,
      },
    },
  }
}

describe('vault.crypto', () => {
  it('encryptVault → decryptVault round-trips an empty vault exactly', async () => {
    const original = emptyVault()
    const blob = await encryptVault(original, PASSWORD)
    const recovered = await decryptVault(blob, PASSWORD)
    expect(recovered).toEqual(original)
  })

  it('encryptVault → decryptVault round-trips a populated vault exactly', async () => {
    const original = makeRichVault()
    const blob = await encryptVault(original, PASSWORD)
    const recovered = await decryptVault(blob, PASSWORD)
    expect(recovered).toEqual(original)
  })

  it('produces a blob matching EncryptedVaultSchema', async () => {
    const blob = await encryptVault(emptyVault(), PASSWORD)
    expect(() => EncryptedVaultSchema.parse(blob)).not.toThrow()
    expect(blob.version).toBe(1)
    expect(blob.kdf).toBe('PBKDF2-SHA256')
    expect(blob.kdfIterations).toBeGreaterThanOrEqual(100_000)
  })

  it('two encryptions of the same vault produce different ciphertexts (random IV + salt)', async () => {
    const vault = emptyVault()
    const a = await encryptVault(vault, PASSWORD)
    const b = await encryptVault(vault, PASSWORD)
    expect(a.ciphertext).not.toBe(b.ciphertext)
    expect(a.iv).not.toBe(b.iv)
    expect(a.salt).not.toBe(b.salt)
  })

  it('decryptVault rejects the wrong password', async () => {
    const blob = await encryptVault(emptyVault(), PASSWORD)
    await expect(decryptVault(blob, WRONG_PASSWORD)).rejects.toThrow(
      /wrong password|corrupted/,
    )
  })

  it('decryptVault rejects tampered ciphertext (GCM auth tag detects it)', async () => {
    const blob = await encryptVault(emptyVault(), PASSWORD)
    // Decode → flip a byte well inside the data → re-encode. Avoids landing on
    // base64 padding chars + guarantees a valid base64 string with a real byte
    // change that the GCM auth tag will reject.
    const bytes = fromBase64(blob.ciphertext) as Uint8Array
    bytes[Math.floor(bytes.length / 2)] ^= 0xff
    const tampered = { ...blob, ciphertext: toBase64(bytes) }
    await expect(decryptVault(tampered, PASSWORD)).rejects.toThrow(
      /wrong password|corrupted/,
    )
  })
})
