import { msg } from '@lingui/core/macro'

import { i18n } from '@/lib/i18n'

import { EncryptedVaultSchema, type EncryptedVault } from './types'

/**
 * Versioned storage key. Bump alongside a schema migration if the on-disk
 * shape ever changes incompatibly.
 */
const STORAGE_KEY = 'webwallet:vault:v1'

// ---------------------------------------------------------------------------
// Backend abstraction (DRY — every public op routes through one of two backends
// chosen at call time, so the if/else "which backend?" logic lives in exactly
// one place).
// ---------------------------------------------------------------------------

interface Backend {
  get(): Promise<string | null>
  set(value: string): Promise<void>
  remove(): Promise<void>
}

const chromeBackend: Backend = {
  async get() {
    const result = await chrome.storage.local.get(STORAGE_KEY)
    return (result[STORAGE_KEY] as string | undefined) ?? null
  },
  async set(value) {
    await chrome.storage.local.set({ [STORAGE_KEY]: value })
  },
  async remove() {
    await chrome.storage.local.remove(STORAGE_KEY)
  },
}

const localStorageBackend: Backend = {
  get() {
    return Promise.resolve(localStorage.getItem(STORAGE_KEY))
  },
  set(value) {
    localStorage.setItem(STORAGE_KEY, value)
    return Promise.resolve()
  },
  remove() {
    localStorage.removeItem(STORAGE_KEY)
    return Promise.resolve()
  },
}

/**
 * Pick the backend at call time. Re-evaluates per call so that environment
 * changes between calls (e.g. service-worker startup making chrome.storage
 * available) are picked up automatically.
 *
 * Chrome storage is preferred when both are available — survives service-worker
 * restart, syncs with other extension contexts, larger quota.
 */
function backend(): Backend {
  if (typeof chrome !== 'undefined' && chrome.storage?.local !== undefined) {
    return chromeBackend
  }
  if (typeof localStorage !== 'undefined') {
    return localStorageBackend
  }
  throw new Error(
    'no storage backend available (neither chrome.storage nor localStorage)',
  )
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Persist the encrypted vault blob. */
export async function saveEncryptedVault(blob: EncryptedVault): Promise<void> {
  await backend().set(JSON.stringify(blob))
}

/**
 * Load the encrypted vault blob. Returns `null` if nothing has been saved yet
 * (first-time install). Throws on corrupted storage (invalid JSON, or JSON
 * that doesn't match the `EncryptedVault` shape).
 */
export async function loadEncryptedVault(): Promise<EncryptedVault | null> {
  const raw = await backend().get()
  if (raw === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(i18n._(msg`stored vault is not valid JSON (corrupted storage)`))
  }
  return EncryptedVaultSchema.parse(parsed)
}

/** Wipe the stored vault. Used by the "reset wallet" UX. */
export async function clearEncryptedVault(): Promise<void> {
  await backend().remove()
}
