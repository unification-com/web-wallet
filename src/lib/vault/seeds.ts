/**
 * BIP39 mnemonic + BIP44 HD-derivation helpers.
 *
 * Unification BIP44 coin type is 5555. Standard derivation path:
 *     m/44'/5555'/0'/0/<accountIndex>
 *
 * Full implementation lands in M1.4.
 */

export interface DerivedAccount {
  privateKey: string // hex (32 bytes)
  publicKey: string // hex (compressed secp256k1)
  address: string // bech32 with `und` prefix
}

/** Generate a fresh BIP39 mnemonic. Strength 128 → 12 words, 256 → 24 words. */
export function generateMnemonic(_strength: 128 | 256): string {
  throw new Error('vault.seeds.generateMnemonic: not implemented (M1.4)')
}

/** Validate a BIP39 mnemonic (wordlist + checksum). Returns true if valid. */
export function validateMnemonic(_phrase: string): boolean {
  throw new Error('vault.seeds.validateMnemonic: not implemented (M1.4)')
}

/**
 * Derive the Nth account from a mnemonic via `m/44'/5555'/0'/0/N`. Returns
 * private key (hex), public key (hex), and `und1…` bech32 address.
 */
export function deriveAccount(_mnemonic: string, _accountIndex: number): Promise<DerivedAccount> {
  throw new Error('vault.seeds.deriveAccount: not implemented (M1.4)')
}
