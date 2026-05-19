import type { EncryptedVault, Vault } from './types'

/**
 * Encrypt a decrypted Vault with the user's password.
 *
 * Implementation lands in M1.2. Plan:
 *  - PBKDF2-SHA256 KDF tuned to ≥250 ms on a mid-tier laptop
 *  - AES-256-GCM cipher with a random 12-byte IV
 *  - All via WebCrypto (`crypto.subtle.deriveBits` + `crypto.subtle.encrypt`);
 *    no third-party crypto libs needed.
 */
export function encryptVault(_vault: Vault, _password: string): Promise<EncryptedVault> {
  throw new Error('vault.crypto.encryptVault: not implemented (M1.2)')
}

/**
 * Decrypt + zod-validate an encrypted blob. Throws on wrong password (GCM auth
 * tag failure) or corrupted ciphertext.
 *
 * Implementation lands in M1.2.
 */
export function decryptVault(_blob: EncryptedVault, _password: string): Promise<Vault> {
  throw new Error('vault.crypto.decryptVault: not implemented (M1.2)')
}
