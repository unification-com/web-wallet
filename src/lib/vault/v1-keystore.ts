/**
 * Legacy v1 `.json` keystore decryption — one-way migration into v2's vault.
 *
 * v1 produced the "web3 secret storage" format:
 *   - KDF: PBKDF2-HMAC-SHA256, c=262144, dklen=32
 *   - Cipher: AES-256-CTR
 *   - MAC: SHA3-256 (with SHA-256 legacy fallback for pre-testnet keystores)
 *
 * Reference impl: `und-js-v2/src/crypto/index.js:121-199` in
 * `CORE/und-js-v2/` (the abandoned predecessor). We re-implement here via
 * WebCrypto + @noble/hashes (for SHA3) rather than depending on the package.
 *
 * v1 keystores ONLY contain a single private key — never a mnemonic. So they
 * map to v2's ImportedKeyEntry, not a SeedEntry.
 *
 * Full implementation lands in M1.5.
 */

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
    mac: string // SHA3-256(derivedKey[16..32] || ciphertext), with SHA-256 legacy fallback
  }
}

/**
 * Decrypt a v1 keystore JSON. Throws on wrong password (MAC check fails),
 * unsupported KDF, or corrupted file.
 */
export function decryptV1Keystore(
  _json: V1KeystoreJson,
  _password: string,
): Promise<DecryptedV1Keystore> {
  throw new Error('vault.v1-keystore.decryptV1Keystore: not implemented (M1.5)')
}
