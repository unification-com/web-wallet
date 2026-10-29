import { z } from 'zod'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Current vault schema version. Bump + add a migration when the shape changes. */
export const VAULT_SCHEMA_VERSION = 1

/** Default auto-lock timeout (15 minutes). MetaMask convention. */
export const DEFAULT_AUTO_LOCK_MS = 15 * 60 * 1000

/** Built-in (non-custom) endpoint IDs. Match the keys in src/lib/chain.ts ENDPOINTS. */
export const BUILT_IN_ENDPOINT_IDS = ['mainnet', 'testnet', 'devnet'] as const
export type BuiltInEndpointId = (typeof BUILT_IN_ENDPOINT_IDS)[number]

// ---------------------------------------------------------------------------
// Zod schemas (single source of truth; types are inferred below)
// ---------------------------------------------------------------------------

/** Bech32 address with the Unification `und` prefix. Length-bounded loosely. */
const Bech32AddressSchema = z
  .string()
  .regex(/^und1[a-z0-9]{38,58}$/, 'must be a valid Unification (und1…) bech32 address')

/** Hex-encoded 32-byte private key. */
const PrivateKeyHexSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/i, 'must be a 32-byte (64 hex character) private key')

/** Account derived from a seed via HD path `m/44'/5555'/0'/0/<index>`. */
export const SeedAccountSchema = z.object({
  index: z.number().int().nonnegative(),
  label: z.string().min(1),
  address: Bech32AddressSchema,
})

/** BIP39 seed phrase + every account derived from it. */
export const SeedEntrySchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
  /** BIP39 mnemonic (12 or 24 words). Validated separately via bip39.validateMnemonic. */
  mnemonic: z.string().min(1),
  accounts: z.array(SeedAccountSchema).min(1),
  createdAt: z.number().int(),
})

/** Single-key entry — typically a v1 JSON keystore imported via the migration flow. */
export const ImportedKeyEntrySchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
  privateKey: PrivateKeyHexSchema,
  address: Bech32AddressSchema,
  /** Where this key came from — used in the UI to label "v1 import" vs "raw paste". */
  source: z.enum(['v1-json', 'raw-private-key']),
  createdAt: z.number().int(),
})

/** User-defined RPC endpoint (in addition to mainnet/testnet/devnet). */
export const CustomEndpointSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
  rpc: z.string().url(),
  rest: z.string().url().optional(),
  /** Chain ID captured at add-time after the node_info sanity check. */
  chainId: z.string().min(1).optional(),
  /**
   * Optional explorer base URL for tx-hash deep-links — e.g.
   * `https://example.com/tx/`. The tx-history view + Send success-line
   * append the upper-case hash to build the final URL.
   */
  txExplorerBase: z.string().url().optional(),
  /**
   * Optional explorer base URL for account-page deep-links — e.g.
   * `https://example.com/account/`. The address-link primitive appends the
   * bech32 verbatim. Address-link sites fall back to plain text when absent.
   */
  accountExplorerBase: z.string().url().optional(),
  /**
   * Optional explorer base URL for validator-page deep-links — e.g.
   * `https://example.com/staking/`. The address-link primitive appends the
   * `undvaloper1…` bech32 verbatim. Address-link sites fall back to plain
   * text when absent.
   */
  validatorExplorerBase: z.string().url().optional(),
  createdAt: z.number().int(),
})

/**
 * Reference to an active signer that lives inside the vault.
 *
 * External wallet signers (Keplr / Leap / Cosmostation) get their own ref union
 * in `src/lib/signer.ts` (M1.6 / M2), and the broader `ActiveSignerRef` there is
 * `VaultSignerRef | ExternalSignerRef`. The vault only persists VaultSignerRef
 * because external connections are ephemeral (lost on extension reload).
 */
export const VaultSignerRefSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('vault-seed'),
    seedId: z.string().uuid(),
    accountIndex: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal('vault-imported'),
    id: z.string().uuid(),
  }),
])

/** Active endpoint reference — either a built-in id or a custom endpoint UUID. */
const ActiveEndpointIdSchema = z.union([
  z.enum(BUILT_IN_ENDPOINT_IDS),
  z.string().uuid(),
])

/** UI theme variants — picks the colour palette + light/dark mode. */
export const ThemeModeSchema = z.enum(['system', 'light', 'dark'])
export const ThemePaletteSchema = z.enum(['cosmos', 'mainframe'])
export type ThemeMode = z.infer<typeof ThemeModeSchema>
export type ThemePalette = z.infer<typeof ThemePaletteSchema>

export const VaultPreferencesSchema = z.object({
  activeEndpointId: ActiveEndpointIdSchema.default('mainnet'),
  activeSignerRef: VaultSignerRefSchema.optional(),
  autoLockTimeoutMs: z.number().int().positive().default(DEFAULT_AUTO_LOCK_MS),
  /**
   * UI theme mode. `system` follows the OS-level prefers-color-scheme;
   * `light` / `dark` override it. Optional — older vaults deserialise
   * without the field and the consumer (`useTheme()`) treats undefined
   * as `system`.
   */
  themeMode: ThemeModeSchema.optional(),
  /**
   * UI theme palette. `cosmos` is the refined brand-blue default;
   * `mainframe` is the industrial terminal-style alternate. Optional —
   * undefined defaults to `cosmos`.
   */
  themePalette: ThemePaletteSchema.optional(),
})

/**
 * Local-only labels for streams. Keyed by `${sender}:${receiver}:${denom}`
 * — the chain's stream identity triple. Both parties can independently label
 * their view of the same on-chain stream (sender's vault stores their name,
 * receiver's vault stores theirs). Empty / missing entries fall through to
 * the bech32 default rendering. Backwards-compatible — older vaults
 * deserialise without it.
 */
export const StreamLabelsSchema = z.record(z.string().min(1).max(64))

export const VaultSchema = z.object({
  version: z.literal(VAULT_SCHEMA_VERSION),
  seeds: z.array(SeedEntrySchema).default([]),
  importedKeys: z.array(ImportedKeyEntrySchema).default([]),
  customEndpoints: z.array(CustomEndpointSchema).default([]),
  preferences: VaultPreferencesSchema,
  streamLabels: StreamLabelsSchema.optional(),
  createdAt: z.number().int(),
  lastModifiedAt: z.number().int(),
})

// ---------------------------------------------------------------------------
// Inferred types (DRY — schemas are the source of truth)
// ---------------------------------------------------------------------------

export type SeedAccount = z.infer<typeof SeedAccountSchema>
export type SeedEntry = z.infer<typeof SeedEntrySchema>
export type ImportedKeyEntry = z.infer<typeof ImportedKeyEntrySchema>
export type CustomEndpoint = z.infer<typeof CustomEndpointSchema>
export type VaultSignerRef = z.infer<typeof VaultSignerRefSchema>
export type VaultPreferences = z.infer<typeof VaultPreferencesSchema>
export type Vault = z.infer<typeof VaultSchema>

// ---------------------------------------------------------------------------
// Encrypted blob shape (what's actually written to chrome.storage)
// ---------------------------------------------------------------------------

/**
 * On-disk encrypted vault. Contains everything needed to decrypt + verify
 * (salt for KDF, iv for AES-GCM cipher, ciphertext). Auth tag is part of the
 * ciphertext in GCM mode — wrong password / tampering surfaces as a decrypt
 * failure.
 */
export const EncryptedVaultSchema = z.object({
  version: z.literal(1),
  kdf: z.literal('PBKDF2-SHA256'),
  kdfIterations: z.number().int().positive(),
  /** Base64-encoded 16-byte salt. */
  salt: z.string(),
  /** Base64-encoded 12-byte IV. */
  iv: z.string(),
  /** Base64-encoded AES-256-GCM ciphertext (includes auth tag). */
  ciphertext: z.string(),
})

export type EncryptedVault = z.infer<typeof EncryptedVaultSchema>

// ---------------------------------------------------------------------------
// Helpers — useful for vault-bootstrap defaults without spelling out the shape
// ---------------------------------------------------------------------------

/** Build a fresh empty vault. `preferences` defaults to mainnet + 15min auto-lock. */
export function emptyVault(): Vault {
  const now = Date.now()
  return {
    version: VAULT_SCHEMA_VERSION,
    seeds: [],
    importedKeys: [],
    customEndpoints: [],
    preferences: {
      activeEndpointId: 'mainnet',
      autoLockTimeoutMs: DEFAULT_AUTO_LOCK_MS,
    },
    createdAt: now,
    lastModifiedAt: now,
  }
}
