import { msg } from '@lingui/core/macro'
import { create } from 'zustand'

import { i18n } from '../i18n'

import { decryptVault, encryptVault } from './crypto'
import { addressFromPrivateKey, deriveAccount } from './seeds'
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
  type ThemeMode,
  type ThemePalette,
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
  /**
   * Import a raw hex-encoded private key (64 hex chars / 32 bytes). The
   * address is derived via `addressFromPrivateKey`. Throws if the input
   * doesn't parse to a valid secp256k1 key.
   */
  importPrivateKey: (privateKeyHex: string, label?: string) => Promise<ImportedKeyEntry>
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
  setThemeMode: (mode: ThemeMode) => Promise<void>
  setThemePalette: (palette: ThemePalette) => Promise<void>

  /**
   * Set (or clear, when `label` is empty / undefined) a local-only label
   * for a stream identified by the `(sender, receiver, denom)` triple. The
   * label is stored in the encrypted vault and surfaces in the Streams tab
   * row in place of the bech32 address for the counterparty.
   */
  setStreamLabel: (
    sender: string,
    receiver: string,
    denom: string,
    label: string,
  ) => Promise<void>

  // Idle timer (called on user activity)
  resetIdleTimer: () => void

  /**
   * Compare a user-supplied password against the in-memory cached one.
   * Used to gate sensitive operations like revealing a seed phrase, where
   * we want a fresh password re-entry rather than implicit access via the
   * already-unlocked session. Returns false if the vault is locked.
   */
  verifyPassword: (input: string) => boolean
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
    throw new Error(i18n._(msg`vault is locked`))
  }
  return { vault, password }
}

function clearIdleTimer() {
  if (idleTimer !== null) {
    clearTimeout(idleTimer)
    idleTimer = null
  }
}

/**
 * Pick the next unused integer suffix for a label of the form `${prefix} N`.
 * Pure helper used by `addSeed` / `addAccountToSeed` / `importV1Keystore` so
 * default labels don't collide after a delete-then-add cycle (array-length
 * heuristic would re-issue the deleted entry's number).
 */
export function nextLabelWithPrefix(prefix: string, existing: readonly string[]): string {
  const taken = new Set(existing)
  let n = 1
  while (taken.has(`${prefix} ${n.toString()}`)) n++
  return `${prefix} ${n.toString()}`
}

/**
 * Returns every address currently held by the vault — across seeds (every
 * derived account) and imported keys. Used by the import flows to detect
 * duplicates before adding (warn the user rather than silently insert).
 */
export function collectVaultAddresses(vault: Vault): Set<string> {
  const all = new Set<string>()
  for (const seed of vault.seeds) {
    for (const account of seed.accounts) all.add(account.address)
  }
  for (const k of vault.importedKeys) all.add(k.address)
  return all
}

/**
 * Locate a vault entry by its bech32 address. Returns the entry kind
 * (seed-derived account vs imported key) + its labels so the caller can
 * surface a precise "already exists as Seed X / Account Y" message.
 * Returns null when the address isn't in the vault.
 */
export interface ExistingAddressMatch {
  kind: 'seed' | 'imported'
  /** Top-level container label (seed label / imported entry label). */
  containerLabel: string
  /** For seed accounts only: the per-account label (e.g. "Account 1"). */
  accountLabel?: string
}

export function findAddressInVault(
  vault: Vault,
  address: string,
): ExistingAddressMatch | null {
  for (const seed of vault.seeds) {
    const account = seed.accounts.find((a) => a.address === address)
    if (account) {
      return { kind: 'seed', containerLabel: seed.label, accountLabel: account.label }
    }
  }
  const imported = vault.importedKeys.find((k) => k.address === address)
  if (imported) return { kind: 'imported', containerLabel: imported.label }
  return null
}

/**
 * Pick a fallback signer when the active one is being removed. Prefers the
 * first remaining seed's account 0; falls back to the first imported key;
 * returns undefined when the vault has no other entries (in which case the
 * UI lands back on VaultSetup, which is the correct empty-vault state).
 *
 * `excludingSeedId` / `excludingImportedKeyId` let the caller pre-exclude
 * the entry being deleted (the deletion is queued in the same mutate fn).
 */
export function pickFallbackSigner(
  vault: Vault,
  excluding: { seedId?: string; importedKeyId?: string } = {},
): VaultSignerRef | undefined {
  const seed = vault.seeds.find((s) => s.id !== excluding.seedId)
  if (seed && seed.accounts.length > 0) {
    return { kind: 'vault-seed', seedId: seed.id, accountIndex: seed.accounts[0].index }
  }
  const imported = vault.importedKeys.find((k) => k.id !== excluding.importedKeyId)
  if (imported) return { kind: 'vault-imported', id: imported.id }
  return undefined
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
      // Don't clobber an unlocked session. The chrome.storage.onChanged
      // listener can fire from our OWN write during createVault — at the
      // moment the listener queues hydrate, status is still 'no-vault', so
      // the listener calls hydrate. Hydrate's storage read suspends while
      // createVault's sync continuation flips status to 'unlocked'. By the
      // time hydrate's read resolves, the user IS unlocked — we mustn't
      // overwrite that with 'locked' just because the blob now exists.
      if (get().status === 'unlocked') return
      set({ status: blob === null ? 'no-vault' : 'locked' })
    },

    async createVault(password) {
      if (password.length < 8) throw new Error(i18n._(msg`password must be at least 8 characters`))
      if (get().status === 'unlocked') throw new Error(i18n._(msg`vault is already unlocked`))
      const vault = emptyVault()
      const blob = await encryptVault(vault, password)
      await saveEncryptedVault(blob)
      cachedPassword = password
      set({ status: 'unlocked', vault, lastUnlockedAt: Date.now() })
      startOrResetIdleTimer()
    },

    async unlock(password) {
      const blob = await loadEncryptedVault()
      if (blob === null) throw new Error(i18n._(msg`no vault to unlock`))
      let vault: Vault
      try {
        vault = await decryptVault(blob, password)
      } catch {
        throw new Error(i18n._(msg`wrong password`))
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
      const vault = get().vault!
      // Hard-block duplicate addresses. UI also disables Save when the
      // live-derived address matches an existing entry; this throw is
      // the defence-in-depth backstop for race conditions / API misuse.
      const match = findAddressInVault(vault, account0.address)
      if (match) {
        throw new Error(
          i18n._(
            msg`This seed's first account (${account0.address}) already exists in your vault as ${match.containerLabel}${match.accountLabel ? ` / ${match.accountLabel}` : ''}. Delete it first if you want to re-import.`,
          ),
        )
      }
      const seedId = uuid()
      const now = Date.now()
      const existingSeedLabels = vault.seeds.map((s) => s.label)
      const seed: SeedEntry = {
        id: seedId,
        label: label ?? nextLabelWithPrefix('Seed', existingSeedLabels),
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
      if (!seed) throw new Error(i18n._(msg`seed ${seedId} not found`))
      const nextIndex =
        seed.accounts.length === 0
          ? 0
          : Math.max(...seed.accounts.map((a) => a.index)) + 1
      const derived = await deriveAccount(seed.mnemonic, nextIndex)
      const existingAccountLabels = seed.accounts.map((a) => a.label)
      const account: SeedAccount = {
        index: nextIndex,
        label: label ?? nextLabelWithPrefix('Account', existingAccountLabels),
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
      await persistMutation((v) => {
        const activePointsAtRemoved =
          v.preferences.activeSignerRef?.kind === 'vault-seed' &&
          v.preferences.activeSignerRef.seedId === seedId
        const nextActive = activePointsAtRemoved
          ? pickFallbackSigner(v, { seedId })
          : v.preferences.activeSignerRef
        return {
          ...v,
          seeds: v.seeds.filter((s) => s.id !== seedId),
          // Conditional spread: `activeSignerRef` is optional in the schema
          // and `exactOptionalPropertyTypes: true` forbids an explicit
          // `undefined`. When there's no fallback, omit the key.
          preferences: {
            ...v.preferences,
            ...(nextActive ? { activeSignerRef: nextActive } : {}),
            ...(activePointsAtRemoved && !nextActive ? { activeSignerRef: undefined } : {}),
          },
        }
      })
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
      const vault = get().vault!
      const match = findAddressInVault(vault, decrypted.address)
      if (match) {
        throw new Error(
          i18n._(
            msg`This v1 keystore's address (${decrypted.address}) already exists in your vault as ${match.containerLabel}${match.accountLabel ? ` / ${match.accountLabel}` : ''}. Delete it first if you want to re-import.`,
          ),
        )
      }
      const existingLabels = vault.importedKeys.map((k) => k.label)
      const entry: ImportedKeyEntry = {
        id: uuid(),
        label: label ?? nextLabelWithPrefix('Imported', existingLabels),
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

    async importPrivateKey(privateKeyHex, label) {
      // Normalise to lower-case hex without 0x prefix; schema requires
      // exactly 64 hex chars (32 bytes secp256k1 private key).
      const normalised = privateKeyHex.trim().toLowerCase().replace(/^0x/, '')
      if (!/^[0-9a-f]{64}$/.test(normalised)) {
        throw new Error(
          i18n._(msg`private key must be 64 hex characters (32 bytes); 0x prefix optional`),
        )
      }
      const { address } = await addressFromPrivateKey(normalised)
      const vault = get().vault!
      const match = findAddressInVault(vault, address)
      if (match) {
        throw new Error(
          i18n._(
            msg`This private key's address (${address}) already exists in your vault as ${match.containerLabel}${match.accountLabel ? ` / ${match.accountLabel}` : ''}. Delete it first if you want to re-import.`,
          ),
        )
      }
      const existingLabels = vault.importedKeys.map((k) => k.label)
      const entry: ImportedKeyEntry = {
        id: uuid(),
        label: label ?? nextLabelWithPrefix('Imported', existingLabels),
        privateKey: normalised,
        address,
        source: 'raw-private-key',
        createdAt: Date.now(),
      }
      await persistMutation((v) => ({
        ...v,
        importedKeys: [...v.importedKeys, entry],
      }))
      return entry
    },

    async removeImportedKey(id) {
      await persistMutation((v) => {
        const activePointsAtRemoved =
          v.preferences.activeSignerRef?.kind === 'vault-imported' &&
          v.preferences.activeSignerRef.id === id
        const nextActive = activePointsAtRemoved
          ? pickFallbackSigner(v, { importedKeyId: id })
          : v.preferences.activeSignerRef
        return {
          ...v,
          importedKeys: v.importedKeys.filter((k) => k.id !== id),
          preferences: {
            ...v.preferences,
            ...(nextActive ? { activeSignerRef: nextActive } : {}),
            ...(activePointsAtRemoved && !nextActive ? { activeSignerRef: undefined } : {}),
          },
        }
      })
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
      if (!isBuiltIn && !isCustom) throw new Error(i18n._(msg`endpoint ${id} not found`))
      await persistMutation((v) => ({
        ...v,
        preferences: { ...v.preferences, activeEndpointId: id },
      }))
    },

    async setAutoLockTimeoutMs(ms) {
      if (!Number.isInteger(ms) || ms <= 0) {
        throw new Error(i18n._(msg`auto-lock timeout must be a positive integer (ms)`))
      }
      await persistMutation((v) => ({
        ...v,
        preferences: { ...v.preferences, autoLockTimeoutMs: ms },
      }))
    },

    async setThemeMode(mode) {
      await persistMutation((v) => ({
        ...v,
        preferences: { ...v.preferences, themeMode: mode },
      }))
    },

    async setThemePalette(palette) {
      await persistMutation((v) => ({
        ...v,
        preferences: { ...v.preferences, themePalette: palette },
      }))
    },

    async setStreamLabel(sender, receiver, denom, label) {
      const key = `${sender}:${receiver}:${denom}`
      const trimmed = label.trim()
      await persistMutation((v) => {
        const next = { ...(v.streamLabels ?? {}) }
        if (trimmed === '') {
          delete next[key]
        } else {
          next[key] = trimmed
        }
        return { ...v, streamLabels: next }
      })
    },

    resetIdleTimer() {
      if (get().status === 'unlocked') startOrResetIdleTimer()
    },

    verifyPassword(input) {
      return cachedPassword !== null && cachedPassword === input
    },
  }
})
