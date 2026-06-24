// Public surface of the vault module. Consumers import from '@/lib/vault'.

export * from './types'
export * from './store'

// Helpers from supporting modules — re-exported for convenience where the
// store doesn't already wrap them.
export {
  generateMnemonic,
  validateMnemonic,
  deriveAccount,
  type DerivedAccount,
} from './seeds'

export { type V1KeystoreJson, type DecryptedV1Keystore } from './v1-keystore'
