/**
 * Legacy v1 `.json` keystore decryption — one-way migration into v2's vault.
 *
 * v1 used the "web3 secret storage" format:
 *   - KDF: PBKDF2-HMAC-SHA256, c=262144, dklen=32
 *   - Cipher: AES-256-CTR
 *   - MAC: Keccak-512(derivedKey[16..32] || ciphertext), with SHA-256 legacy
 *     fallback for pre-testnet keystores
 *
 * Reference impl: `und-js-v2/src/crypto/index.js:121-199`. und-js-v2 calls
 * `sha3(bufferValue.toString("hex"))` which under the hood is CryptoJS 4.1.1
 * `SHA3(hexEncoded)` — that decodes the hex string BACK to the raw bytes and
 * hashes them, so the hex round-trip is a no-op. CryptoJS 4.1.1's `SHA3` is
 * Keccak-512 (default `outputLength: 512`, pre-NIST `0x01` padding), NOT
 * NIST SHA3-256. Legacy path is `SHA256(hexEncoded)` — same raw-bytes input.
 *
 * v1 keystores ONLY contain a single private key — never a mnemonic. So they
 * map to v2's ImportedKeyEntry, not a SeedEntry.
 */

import { fromHex, toHex } from '@cosmjs/encoding'
import { sha256 } from '@noble/hashes/sha2'
import { keccak_512 } from '@noble/hashes/sha3'

import { addressFromPrivateKey } from './seeds'

export interface DecryptedV1Keystore {
  privateKey: string // hex (32 bytes)
  address: string // bech32 with `und` prefix
}

/** v1 keystore JSON shape (web3 secret storage v1). */
export interface V1KeystoreJson {
  version: 1
  id: string
  crypto: {
    ciphertext: string
    cipherparams: { iv: string }
    cipher: string // 'aes-256-ctr'
    kdf: string // 'pbkdf2'
    kdfparams: {
      dklen: number
      salt: string
      c: number
      prf: string // 'hmac-sha256'
    }
    mac: string // SHA3-256(hex(derivedKey[16..32] || ciphertext)), with SHA-256 legacy fallback
  }
}

// ---------------------------------------------------------------------------
// WebCrypto helpers
// ---------------------------------------------------------------------------

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

async function aesCtrDecrypt(
  ciphertext: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array,
): Promise<Uint8Array> {
  const aesKey = await crypto.subtle.importKey('raw', key, 'AES-CTR', false, ['decrypt'])
  const plaintext = await crypto.subtle.decrypt(
    // length=64 is the standard AES-CTR counter-bits width (matches
    // Node.js's `aes-256-ctr` default — the algorithm und-js-v2 used).
    { name: 'AES-CTR', counter: iv, length: 64 },
    aesKey,
    ciphertext,
  )
  return new Uint8Array(plaintext)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Decrypt a v1 `.json` keystore. Throws on unsupported KDF/cipher, MAC
 * mismatch (wrong password / corrupted file), or invalid params.
 */
export async function decryptV1Keystore(
  json: V1KeystoreJson,
  password: string,
): Promise<DecryptedV1Keystore> {
  const c = json.crypto
  if (c.kdf !== 'pbkdf2') {
    throw new Error(`unsupported v1 keystore KDF: ${c.kdf}`)
  }
  if (c.kdfparams.prf !== 'hmac-sha256') {
    throw new Error(`unsupported v1 keystore PRF: ${c.kdfparams.prf}`)
  }
  if (c.cipher !== 'aes-256-ctr') {
    throw new Error(`unsupported v1 keystore cipher: ${c.cipher}`)
  }

  const salt = fromHex(c.kdfparams.salt) as Uint8Array
  const iv = fromHex(c.cipherparams.iv) as Uint8Array
  const ciphertext = fromHex(c.ciphertext) as Uint8Array
  const derivedKey = await pbkdf2DeriveBits(
    password,
    salt,
    c.kdfparams.c,
    c.kdfparams.dklen,
  )

  // MAC input is the raw byte concatenation `derivedKey[16..32] || ciphertext`.
  // und-js-v2's `sha3(bufferValue.toString("hex"))` decodes the hex string back
  // to the original bytes via CryptoJS `hexEncoding.parse`, so we hash the raw
  // bytes directly. Primary hash = Keccak-512 (CryptoJS 4.1.1 SHA3 default).
  const macInputBytes = new Uint8Array(16 + ciphertext.length)
  macInputBytes.set(derivedKey.slice(16, 32), 0)
  macInputBytes.set(ciphertext, 16)

  const expectedMac = c.mac.toLowerCase()
  let macOk = toHex(keccak_512(macInputBytes)) === expectedMac
  if (!macOk) {
    // Pre-testnet keystores used SHA-256 of the same raw bytes for the MAC.
    macOk = toHex(sha256(macInputBytes)) === expectedMac
  }
  if (!macOk) {
    throw new Error('v1 keystore MAC check failed — wrong password or corrupted file')
  }

  const aesKey = derivedKey.slice(0, 32)
  const privkey = await aesCtrDecrypt(ciphertext, aesKey, iv)
  const privateKey = toHex(privkey)
  const { address } = await addressFromPrivateKey(privateKey)
  return { privateKey, address }
}
