/**
 * BIP39 mnemonic + BIP44 HD-derivation helpers.
 *
 * Unification BIP44 coin type is 5555. Standard derivation path:
 *     m/44'/5555'/0'/0/<accountIndex>
 *
 * Verified against cosmjs `DirectSecp256k1HdWallet.fromMnemonic` (canonical
 * implementation) in `seeds.test.ts` — see the cross-check test for proof
 * that this module produces the same addresses cosmjs does.
 */

import { rawSecp256k1PubkeyToRawAddress } from '@cosmjs/amino'
import { Secp256k1, Slip10, Slip10Curve, stringToPath } from '@cosmjs/crypto'
import { toBech32, toHex } from '@cosmjs/encoding'
import * as bip39 from 'bip39'

/** Unification BIP44 coin type (registered SLIP-44 entry). */
const UNIFICATION_COIN_TYPE = 5555

/** Bech32 prefix for Unification accounts. */
const UNIFICATION_BECH32_PREFIX = 'und'

export interface DerivedAccount {
  privateKey: string // hex (32 bytes / 64 chars)
  publicKey: string // hex (compressed secp256k1, 33 bytes / 66 chars)
  address: string // bech32 with `und` prefix
}

/**
 * Generate a fresh BIP39 mnemonic. Strength 128 → 12 words, 256 → 24 words.
 * Uses bip39's internal CSPRNG (which wraps WebCrypto in browser contexts).
 */
export function generateMnemonic(strength: 128 | 256): string {
  return bip39.generateMnemonic(strength)
}

/**
 * Validate a BIP39 mnemonic — checks the wordlist + the embedded checksum.
 * Returns false for any malformed input (wrong word count, unknown word,
 * bad checksum) without throwing.
 */
export function validateMnemonic(phrase: string): boolean {
  return bip39.validateMnemonic(phrase)
}

/**
 * Derive the Nth account from a mnemonic via `m/44'/5555'/0'/0/N`.
 * Returns private key (hex), compressed public key (hex), and bech32 address.
 *
 * Throws on invalid mnemonic (failed checksum) or invalid index.
 */
export async function deriveAccount(
  mnemonic: string,
  accountIndex: number,
): Promise<DerivedAccount> {
  if (!validateMnemonic(mnemonic)) {
    throw new Error('invalid BIP39 mnemonic (failed checksum or unknown word)')
  }
  if (!Number.isInteger(accountIndex) || accountIndex < 0) {
    throw new Error('accountIndex must be a non-negative integer')
  }
  // bip39's return type isn't resolved by typescript-eslint's projectService
  // (tsc itself sees `Promise<Buffer>` correctly; lint sees `any` and the chain
  // poisons every downstream call — privkey + pubkey + the hex/bech32 outputs).
  // Casts at the bip39 boundary didn't satisfy the rule because the input is
  // `any`. Suppress for the whole derivation block — tests + tsc verify the
  // types are correct, and the inputs are all locally-scoped (no `any` leaks
  // out of this function past `address` / `privateKey` / `publicKey` strings).
  /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/await-thenable */
  const seed: Uint8Array = await bip39.mnemonicToSeed(mnemonic)
  const path = stringToPath(
    `m/44'/${UNIFICATION_COIN_TYPE.toString()}'/0'/0/${accountIndex.toString()}`,
  )
  const { privkey } = Slip10.derivePath(Slip10Curve.Secp256k1, seed, path)
  const keypair = await Secp256k1.makeKeypair(privkey)
  const compressedPubkey = Secp256k1.compressPubkey(keypair.pubkey)
  const rawAddress = rawSecp256k1PubkeyToRawAddress(compressedPubkey)
  return {
    privateKey: toHex(privkey),
    publicKey: toHex(compressedPubkey),
    address: toBech32(UNIFICATION_BECH32_PREFIX, rawAddress),
  }
  /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/await-thenable */
}
