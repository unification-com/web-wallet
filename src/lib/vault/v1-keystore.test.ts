import { fromHex, toHex } from '@cosmjs/encoding'
import { sha256 } from '@noble/hashes/sha2'
import { keccak_512 } from '@noble/hashes/sha3'
import { describe, expect, it } from 'vitest'

import canonicalFixture from './fixtures/v1-keystore-test.json'
import { deriveAccount } from './seeds'
import { decryptV1Keystore, type V1KeystoreJson } from './v1-keystore'

// ---------------------------------------------------------------------------
// Inline encryptV1Keystore helper — produces real v1 keystore blobs against
// known inputs so tests are deterministic + self-contained. Mirrors the
// decryption algorithm in reverse. Iteration count kept low for test speed
// (the decrypt path reads it from the blob, so any value round-trips).
// ---------------------------------------------------------------------------

const TEST_ITERATIONS = 1000

async function aesCtrEncrypt(
  plaintext: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array,
): Promise<Uint8Array> {
  const aesKey = await crypto.subtle.importKey('raw', key, 'AES-CTR', false, ['encrypt'])
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-CTR', counter: iv, length: 64 },
    aesKey,
    plaintext,
  )
  return new Uint8Array(ciphertext)
}

async function pbkdf2DeriveBits(
  password: string,
  salt: Uint8Array,
  iterations: number,
  dklenBytes: number,
): Promise<Uint8Array> {
  const passwordBytes = new TextEncoder().encode(password)
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    dklenBytes * 8,
  )
  return new Uint8Array(bits)
}

async function generateV1Keystore(
  privateKeyHex: string,
  password: string,
  options: { macMode?: 'sha3' | 'sha256' } = {},
): Promise<V1KeystoreJson> {
  const macMode = options.macMode ?? 'sha3'
  const salt = crypto.getRandomValues(new Uint8Array(32))
  const iv = crypto.getRandomValues(new Uint8Array(16))
  const dklen = 32
  const derivedKey = await pbkdf2DeriveBits(password, salt, TEST_ITERATIONS, dklen)
  const aesKey = derivedKey.slice(0, 32)
  const privkey = fromHex(privateKeyHex) as Uint8Array
  const ciphertext = await aesCtrEncrypt(privkey, aesKey, iv)
  const macInputBytes = new Uint8Array(16 + ciphertext.length)
  macInputBytes.set(derivedKey.slice(16, 32), 0)
  macInputBytes.set(ciphertext, 16)
  const mac =
    macMode === 'sha3' ? toHex(keccak_512(macInputBytes)) : toHex(sha256(macInputBytes))
  return {
    version: 1,
    id: 'test-uuid-00000000-0000-0000-0000-000000000000',
    crypto: {
      ciphertext: toHex(ciphertext),
      cipherparams: { iv: toHex(iv) },
      cipher: 'aes-256-ctr',
      kdf: 'pbkdf2',
      kdfparams: {
        dklen,
        salt: toHex(salt),
        c: TEST_ITERATIONS,
        prf: 'hmac-sha256',
      },
      mac,
    },
  }
}

// ---------------------------------------------------------------------------
// Test vectors
// ---------------------------------------------------------------------------

// 32-byte private key chosen arbitrarily. The address derived from it via
// secp256k1 + bech32 is verified inside the round-trip test (no need to
// hardcode the expected address; deterministic from privkey).
const TEST_PRIVATE_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
const PASSWORD = 'correct-horse-battery-staple'
const WRONG_PASSWORD = 'tr0ub4dor&3'

describe('vault.v1-keystore.decryptV1Keystore', () => {
  it('round-trips a sha3 (modern) MAC keystore', async () => {
    const json = await generateV1Keystore(TEST_PRIVATE_KEY, PASSWORD, { macMode: 'sha3' })
    const result = await decryptV1Keystore(json, PASSWORD)
    expect(result.privateKey).toBe(TEST_PRIVATE_KEY)
    expect(result.address).toMatch(/^und1[a-z0-9]{38,58}$/)
  })

  it('round-trips a sha256 (legacy pre-testnet) MAC keystore', async () => {
    const json = await generateV1Keystore(TEST_PRIVATE_KEY, PASSWORD, { macMode: 'sha256' })
    const result = await decryptV1Keystore(json, PASSWORD)
    expect(result.privateKey).toBe(TEST_PRIVATE_KEY)
  })

  it('derives the same address as deriveAccount would, for an equivalent privkey', async () => {
    // Confirms the v1 path and the seed path produce identical addresses for
    // matching private keys (i.e. they both go through addressFromPrivateKey).
    const { addressFromPrivateKey } = await import('./seeds')
    const json = await generateV1Keystore(TEST_PRIVATE_KEY, PASSWORD)
    const decrypted = await decryptV1Keystore(json, PASSWORD)
    const direct = await addressFromPrivateKey(TEST_PRIVATE_KEY)
    expect(decrypted.address).toBe(direct.address)
  })

  it('rejects the wrong password (MAC check fails)', async () => {
    const json = await generateV1Keystore(TEST_PRIVATE_KEY, PASSWORD)
    await expect(decryptV1Keystore(json, WRONG_PASSWORD)).rejects.toThrow(
      /MAC check failed|wrong password|corrupted/,
    )
  })

  it('rejects tampered ciphertext (MAC computed over derivedKey + ciphertext)', async () => {
    const json = await generateV1Keystore(TEST_PRIVATE_KEY, PASSWORD)
    // Flip one byte in the middle of the ciphertext via hex manipulation.
    const ctBytes = fromHex(json.crypto.ciphertext) as Uint8Array
    ctBytes[Math.floor(ctBytes.length / 2)] ^= 0xff
    const tampered: V1KeystoreJson = {
      ...json,
      crypto: { ...json.crypto, ciphertext: toHex(ctBytes) },
    }
    await expect(decryptV1Keystore(tampered, PASSWORD)).rejects.toThrow(
      /MAC check failed/,
    )
  })

  it('rejects unsupported KDF', async () => {
    const json = await generateV1Keystore(TEST_PRIVATE_KEY, PASSWORD)
    const bad: V1KeystoreJson = { ...json, crypto: { ...json.crypto, kdf: 'scrypt' } }
    await expect(decryptV1Keystore(bad, PASSWORD)).rejects.toThrow(/unsupported v1 keystore KDF/)
  })

  it('rejects unsupported PRF', async () => {
    const json = await generateV1Keystore(TEST_PRIVATE_KEY, PASSWORD)
    const bad: V1KeystoreJson = {
      ...json,
      crypto: { ...json.crypto, kdfparams: { ...json.crypto.kdfparams, prf: 'hmac-sha512' } },
    }
    await expect(decryptV1Keystore(bad, PASSWORD)).rejects.toThrow(/unsupported v1 keystore PRF/)
  })

  it('rejects unsupported cipher', async () => {
    const json = await generateV1Keystore(TEST_PRIVATE_KEY, PASSWORD)
    const bad: V1KeystoreJson = {
      ...json,
      crypto: { ...json.crypto, cipher: 'aes-128-ctr' },
    }
    await expect(decryptV1Keystore(bad, PASSWORD)).rejects.toThrow(/unsupported v1 keystore cipher/)
  })
})

// ---------------------------------------------------------------------------
// Canonical fixture — a real keystore generated by the v0.21.0 web-wallet
// (und-js-v2 under the hood) against a known mnemonic + password. Locks in
// the Keccak-512 MAC contract against any future regression: the only way
// this test passes is if our decrypt produces the byte-exact private key
// that BIP39+SLIP-10 index-0 derivation produces from the known mnemonic.
// ---------------------------------------------------------------------------

describe('vault.v1-keystore canonical fixture', () => {
  const FIXTURE_MNEMONIC =
    'license gun broom raise firm elbow detail oxygen still sort feature tumble gentle position language brief feed jealous absurd animal movie spider uncover card'
  const FIXTURE_PASSWORD = 'password'

  it('decrypts and derives the same address as the mnemonic at index 0', async () => {
    const decrypted = await decryptV1Keystore(
      canonicalFixture as V1KeystoreJson,
      FIXTURE_PASSWORD,
    )
    const derived = await deriveAccount(FIXTURE_MNEMONIC, 0)
    expect(decrypted.address).toBe(derived.address)
  }, 30_000) // c=262144 PBKDF2 takes ~1s; padding for slow CI runners.
})
