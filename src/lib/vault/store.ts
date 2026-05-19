import { create } from 'zustand'

import { decryptVault, encryptVault } from './crypto'
import { deriveAccount } from './seeds'
import {
  clearEncryptedVault,
  loadEncryptedVault,
  saveEncryptedVault,
} from './storage'
import {
  type CustomEndpoint,
  type ImportedKeyEntry,
  type SeedAccount,
  type SeedEntry,
  type Vault,
  type VaultSignerRef,
  BUILT_IN_ENDPOINT_IDS,
  DEFAULT_AUTO_LOCK_MS,
  emptyVault,
} from './types'
import { decryptV1Keystore, type V1KeystoreJson } from './v1-keystore'

// ---------------------------------------------------------------------------
// Module-level mutable state — kept off the React-facing store interface so it
// doesn't leak into devtools / persistence / serialisation.
// ---------------------------------------------------------------------------

/** Current auto-lock timer handle, if any. Cleared on lock + reset on activity. */
let idleTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Cached password during the unlocked session. Wiped on lock.
 *
 * Sensitive — never exposed via the store's public state. Held in module
 * closure so mutating actions can re-encrypt the vault without prompting.
 */
let cachedPassword: string | null = null

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

export type VaultStatus = 'no-vault' | 'locked' | 'unlocked'

interface VaultState {
  status: VaultStatus
  vault: Vault | null
  lastUnlockedAt: number | null

  // Initialisation
  /** Check storage for an existing encrypted blob → set status to 'locked' or 'no-vault'. */
  hydrate: () => Promise<void>

  // Vault lifecycle
  createVault: (password: string) => Promise<void>
  unlock: (password: string) => Promise<void>
  lock: () => void
  resetVault: () => Promise<void>

  // Seeds
  addSeed: (mnemonic: string, label?: string) => Promise<SeedEntry>
  addAccountToSeed: (seedId: string, label?: string) => Promise<SeedAccount>
  removeSeed: (seedId: string) => Promise<void>
  renameSeed: (seedId: string, label: string) => Promise<void>
  renameSeedAccount: (
    seedId: string,
    accountIndex: number,
    label: string,
  ) => Promise<void>

  // Imported keys
  importV1Keystore: (
    json: V1KeystoreJson,
    password: string,
    label?: string,
  ) => Promise<ImportedKeyEntry>
  removeImportedKey: (id: string) => Promise<void>
  renameImportedKey: (id: string, label: string) => Promise<void>

  // Active signer
  setActiveSigner: (ref: VaultSignerRef | undefined) => Promise<void>

  // Network endpoints
  addCustomEndpoint: (
    endpoint: Omit<CustomEndpoint, 'id' | 'createdAt'>,
  ) => Promise<CustomEndpoint>
  removeCustomEndpoint: (id: string) => Promise<void>
  /**
   * Switch the active endpoint to a built-in id (`mainnet` | `testnet` |
   * `devnet`) or a custom-endpoint UUID. Typed as plain `string` because the
   * literal-or-UUID union widens to `string` anyway; the runtime check inside
   * the action validates membership.
   */
  setActiveEndpoint: (id: string) => Promise<void>

  // Preferences
  setAutoLockTimeoutMs: (ms: number) => Promise<void>

  // Idle timer (called on user activity)
  resetIdleTimer: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uuid(): string {
  return crypto.randomUUID()
}

function requireUnlocked(vault: Vault | null, password: string | null): {
  vault: Vault
  password: string
} {
  if (!vault || !password) {
    throw new Error('vault is locked')
  }
  return { vault, password }
}

function clearIdleTimer() {
  if (idleTimer !== null) {
    clearTimeout(idleTimer)
    idleTimer = null
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useVaultStore = create<VaultState>((set, get) => {
  /**
   * DRY core — every mutating action calls this to:
   *   1. Compute the next vault (updates lastModifiedAt)
   *   2. Re-encrypt with the cached password
   *   3. Save to storage
   *   4. Update the in-memory store state
   *
   * Returns the next vault for the caller's convenience.
   */
  async function persistMutation(mutate: (vault: Vault) => Vault): Promise<Vault> {
    const { vault, password } = requireUnlocked(get().vault, cachedPassword)
    const next: Vault = { ...mutate(vault), lastModifiedAt: Date.now() }
    const blob = await encryptVault(next, password)
    await saveEncryptedVault(blob)
    set({ vault: next })
    startOrResetIdleTimer()
    return next
  }

  function startOrResetIdleTimer() {
    clearIdleTimer()
    const timeoutMs = get().vault?.preferences.autoLockTimeoutMs ?? DEFAULT_AUTO_LOCK_MS
    idleTimer = setTimeout(() => {
      get().lock()
    }, timeoutMs)
  }

  return {
    status: 'no-vault',
    vault: null,
    lastUnlockedAt: null,

    async hydrate() {
      const blob = await loadEncryptedVault()
      set({ status: blob === null ? 'no-vault' : 'locked' })
    },

    async createVault(password) {
      if (password.length < 8) throw new Error('password must be at least 8 characters')
      if (get().status === 'unlocked') throw new Error('vault is already unlocked')
      const vault = emptyVault()
      const blob = await encryptVault(vault, password)
      await saveEncryptedVault(blob)
      cachedPassword = password
      set({ status: 'unlocked', vault, lastUnlockedAt: Date.now() })
      startOrResetIdleTimer()
    },

    async unlock(password) {
      const blob = await loadEncryptedVault()
      if (blob === null) throw new Error('no vault to unlock')
      let vault: Vault
      try {
        vault = await decryptVault(blob, password)
      } catch {
        throw new Error('wrong password')
      }
      cachedPassword = password
      set({ status: 'unlocked', vault, lastUnlockedAt: Date.now() })
      startOrResetIdleTimer()
    },

    lock() {
      clearIdleTimer()
      cachedPassword = null
      set({ status: 'locked', vault: null, lastUnlockedAt: null })
    },

    async resetVault() {
      clearIdleTimer()
      cachedPassword = null
      await clearEncryptedVault()
      set({ status: 'no-vault', vault: null, lastUnlockedAt: null })
    },

    async addSeed(mnemonic, label) {
      // First account derived as part of seed creation — seeds always have ≥1 account.
      const account0 = await deriveAccount(mnemonic, 0)
      const seedId = uuid()
      const now = Date.now()
      const seed: SeedEntry = {
        id: seedId,
        label: label ?? `Seed ${get().vault!.seeds.length + 1}`,
        mnemonic,
        accounts: [
          {
            index: 0,
            label: 'Account 1',
            address: account0.address,
          },
        ],
        createdAt: now,
      }
      await persistMutation((v) => ({ ...v, seeds: [...v.seeds, seed] }))
      return seed
    },

    async addAccountToSeed(seedId, label) {
      const vault = get().vault!
      const seed = vault.seeds.find((s) => s.id === seedId)
      if (!seed) throw new Error(`seed ${seedId} not found`)
      const nextIndex =
        seed.accounts.length === 0
          ? 0
          : Math.max(...seed.accounts.map((a) => a.index)) + 1
      const derived = await deriveAccount(seed.mnemonic, nextIndex)
      const account: SeedAccount = {
        index: nextIndex,
        label: label ?? `Account ${nextIndex + 1}`,
        address: derived.address,
      }
      await persistMutation((v) => ({
        ...v,
        seeds: v.seeds.map((s) =>
          s.id === seedId ? { ...s, accounts: [...s.accounts, account] } : s,
        ),
      }))
      return account
    },

    async removeSeed(seedId) {
      await persistMutation((v) => ({
        ...v,
        seeds: v.seeds.filter((s) => s.id !== seedId),
        // If active signer pointed at this seed, clear it.
        preferences:
          v.preferences.activeSignerRef?.kind === 'vault-seed' &&
          v.preferences.activeSignerRef.seedId === seedId
            ? { ...v.preferences, activeSignerRef: undefined }
            : v.preferences,
      }))
    },

    async renameSeed(seedId, label) {
      await persistMutation((v) => ({
        ...v,
        seeds: v.seeds.map((s) => (s.id === seedId ? { ...s, label } : s)),
      }))
    },

    async renameSeedAccount(seedId, accountIndex, label) {
      await persistMutation((v) => ({
        ...v,
        seeds: v.seeds.map((s) =>
          s.id === seedId
            ? {
                ...s,
                accounts: s.accounts.map((a) =>
                  a.index === accountIndex ? { ...a, label } : a,
                ),
              }
            : s,
        ),
      }))
    },

    async importV1Keystore(json, password, label) {
      const decrypted = await decryptV1Keystore(json, password)
      const entry: ImportedKeyEntry = {
        id: uuid(),
        label:
          label ?? `Imported ${get().vault!.importedKeys.length + 1} (v1 JSON)`,
        privateKey: decrypted.privateKey,
        address: decrypted.address,
        source: 'v1-json',
        createdAt: Date.now(),
      }
      await persistMutation((v) => ({
        ...v,
        importedKeys: [...v.importedKeys, entry],
      }))
      return entry
    },

    async removeImportedKey(id) {
      await persistMutation((v) => ({
        ...v,
        importedKeys: v.importedKeys.filter((k) => k.id !== id),
        preferences:
          v.preferences.activeSignerRef?.kind === 'vault-imported' &&
          v.preferences.activeSignerRef.id === id
            ? { ...v.preferences, activeSignerRef: undefined }
            : v.preferences,
      }))
    },

    async renameImportedKey(id, label) {
      await persistMutation((v) => ({
        ...v,
        importedKeys: v.importedKeys.map((k) => (k.id === id ? { ...k, label } : k)),
      }))
    },

    async setActiveSigner(ref) {
      await persistMutation((v) => ({
        ...v,
        preferences: { ...v.preferences, activeSignerRef: ref },
      }))
    },

    async addCustomEndpoint(endpoint) {
      const entry: CustomEndpoint = {
        ...endpoint,
        id: uuid(),
        createdAt: Date.now(),
      }
      await persistMutation((v) => ({
        ...v,
        customEndpoints: [...v.customEndpoints, entry],
      }))
      return entry
    },

    async removeCustomEndpoint(id) {
      await persistMutation((v) => ({
        ...v,
        customEndpoints: v.customEndpoints.filter((e) => e.id !== id),
        // If active endpoint pointed at this custom one, fall back to mainnet.
        preferences:
          v.preferences.activeEndpointId === id
            ? { ...v.preferences, activeEndpointId: 'mainnet' }
            : v.preferences,
      }))
    },

    async setActiveEndpoint(id) {
      const vault = get().vault!
      const isBuiltIn = (BUILT_IN_ENDPOINT_IDS as readonly string[]).includes(id)
      const isCustom = vault.customEndpoints.some((e) => e.id === id)
      if (!isBuiltIn && !isCustom) throw new Error(`endpoint ${id} not found`)
      await persistMutation((v) => ({
        ...v,
        preferences: { ...v.preferences, activeEndpointId: id },
      }))
    },

    async setAutoLockTimeoutMs(ms) {
      if (!Number.isInteger(ms) || ms <= 0) {
        throw new Error('auto-lock timeout must be a positive integer (ms)')
      }
      await persistMutation((v) => ({
        ...v,
        preferences: { ...v.preferences, autoLockTimeoutMs: ms },
      }))
    },

    resetIdleTimer() {
      if (get().status === 'unlocked') startOrResetIdleTimer()
    },
  }
})
