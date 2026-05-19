import type { EncryptedVault } from './types'

/**
 * Persist the encrypted vault blob. Uses `chrome.storage.local` when running
 * inside the extension; falls back to `localStorage` for the web bundle.
 *
 * Implementation lands in M1.3.
 */
export function saveEncryptedVault(_blob: EncryptedVault): Promise<void> {
  throw new Error('vault.storage.saveEncryptedVault: not implemented (M1.3)')
}

/**
 * Load the encrypted vault blob. Returns `null` if no vault has been created
 * yet (first-time install scenario).
 *
 * Implementation lands in M1.3.
 */
export function loadEncryptedVault(): Promise<EncryptedVault | null> {
  throw new Error('vault.storage.loadEncryptedVault: not implemented (M1.3)')
}

/** Wipe the encrypted vault from storage. Used by the "reset wallet" UX. */
export function clearEncryptedVault(): Promise<void> {
  throw new Error('vault.storage.clearEncryptedVault: not implemented (M1.3)')
}
