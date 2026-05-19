import { fromBase64, toBase64 } from '@cosmjs/encoding'

import { EncryptedVaultSchema, VaultSchema, type EncryptedVault, type Vault } from './types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** PBKDF2 iteration count. OWASP 2023 recommends ≥600,000 for SHA-256. */
const KDF_ITERATIONS = 600_000

/** PBKDF2 hash function. SHA-256. */
const KDF_HASH = 'SHA-256'

/** Salt length in bytes. 16 bytes = 128 bits — standard. */
const SALT_BYTES = 16

/** IV length for AES-GCM. 12 bytes = 96 bits — WebCrypto's required GCM IV size. */
const IV_BYTES = 12

/** AES key size in bits. 256 = AES-256. */
const AES_KEY_BITS = 256

// ---------------------------------------------------------------------------
// WebCrypto plumbing
// ---------------------------------------------------------------------------

/**
 * Derive a 256-bit AES key from `password` and `salt` using PBKDF2-SHA256.
 *
 * `crypto.subtle.deriveKey` returns a non-extractable CryptoKey we can hand
 * directly to encrypt / decrypt — the password never lives in JS memory as a
 * raw key.
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const passwordBytes = new TextEncoder().encode(password)
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: KDF_ITERATIONS,
      hash: KDF_HASH,
    },
    keyMaterial,
    { name: 'AES-GCM', length: AES_KEY_BITS },
    false, // not extractable
    ['encrypt', 'decrypt'],
  )
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Encrypt a Vault with the user's password.
 *
 * Each call produces a fresh random salt + IV — so encrypting the same vault
 * twice yields different ciphertexts. The auth tag is included in the
 * ciphertext (GCM mode); tampering surfaces as a decrypt failure.
 */
export async function encryptVault(
  vault: Vault,
  password: string,
): Promise<EncryptedVault> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const key = await deriveKey(password, salt)
  const plaintext = new TextEncoder().encode(JSON.stringify(vault))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  return {
    version: 1,
    kdf: 'PBKDF2-SHA256',
    kdfIterations: KDF_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  }
}

/**
 * Decrypt + validate an encrypted vault blob. Throws on:
 *  - wrong password (GCM auth tag failure → 'wrong password or corrupted vault')
 *  - tampered ciphertext (same as above — GCM doesn't distinguish)
 *  - schema drift / corrupted plaintext that JSON-parses but isn't a Vault
 */
export async function decryptVault(
  blob: EncryptedVault,
  password: string,
): Promise<Vault> {
  // Schema-validate the blob shape itself; if it's malformed, surface that
  // before paying the PBKDF2 cost.
  const parsedBlob = EncryptedVaultSchema.parse(blob)
  // typescript-eslint's projectService mode doesn't resolve @cosmjs/encoding's
  // return types reliably (tsc itself does). Cast explicitly to avoid spurious
  // no-unsafe-assignment errors without disabling the rule globally.
  const salt = fromBase64(parsedBlob.salt) as Uint8Array
  const iv = fromBase64(parsedBlob.iv) as Uint8Array
  const ciphertext = fromBase64(parsedBlob.ciphertext) as Uint8Array
  // PBKDF2 iterations from the blob (not the local constant) — supports rotating
  // the iteration count later without breaking older vaults.
  const passwordBytes = new TextEncoder().encode(password)
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: parsedBlob.kdfIterations,
      hash: KDF_HASH,
    },
    keyMaterial,
    { name: 'AES-GCM', length: AES_KEY_BITS },
    false,
    ['decrypt'],
  )
  let plaintext: ArrayBuffer
  try {
    plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  } catch {
    throw new Error('wrong password or corrupted vault')
  }
  const json = new TextDecoder().decode(plaintext)
  let parsed: unknown
  try {
    parsed = JSON.parse(json) as unknown
  } catch {
    throw new Error('vault plaintext is not valid JSON (corrupted)')
  }
  return VaultSchema.parse(parsed)
}
