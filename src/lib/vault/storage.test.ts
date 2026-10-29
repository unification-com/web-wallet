// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearEncryptedVault,
  loadEncryptedVault,
  saveEncryptedVault,
} from './storage'
import { type EncryptedVault } from './types'

function makeBlob(): EncryptedVault {
  return {
    version: 1,
    kdf: 'PBKDF2-SHA256',
    kdfIterations: 600_000,
    salt: 'AAAAAAAAAAAAAAAAAAAAAA==',
    iv: 'AAAAAAAAAAAAAAAA',
    ciphertext: 'AAAA',
  }
}

describe('vault.storage (localStorage fallback)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null when no vault has been saved', async () => {
    expect(await loadEncryptedVault()).toBeNull()
  })

  it('round-trips a blob save → load', async () => {
    const blob = makeBlob()
    await saveEncryptedVault(blob)
    expect(await loadEncryptedVault()).toEqual(blob)
  })

  it('clearEncryptedVault wipes the stored blob', async () => {
    await saveEncryptedVault(makeBlob())
    await clearEncryptedVault()
    expect(await loadEncryptedVault()).toBeNull()
  })

  it('overwrites the previous blob on subsequent save', async () => {
    const a = makeBlob()
    await saveEncryptedVault(a)
    const b: EncryptedVault = { ...a, ciphertext: 'BBBB' }
    await saveEncryptedVault(b)
    expect(await loadEncryptedVault()).toEqual(b)
  })

  it('rejects corrupted JSON in storage', async () => {
    localStorage.setItem('webwallet:vault:v1', '{ not json')
    await expect(loadEncryptedVault()).rejects.toThrow(
      /not valid JSON|corrupted/,
    )
  })

  it('rejects valid JSON with the wrong shape', async () => {
    localStorage.setItem('webwallet:vault:v1', JSON.stringify({ random: 'data' }))
    await expect(loadEncryptedVault()).rejects.toThrow()
  })
})

describe('vault.storage (chrome.storage.local — preferred when available)', () => {
  // Simulate the extension environment by stubbing the chrome global. After
  // each test, restore so the localStorage suite above isn't affected.
  const store = new Map<string, string>()
  const mockChrome = {
    storage: {
      local: {
        get(key: string) {
          const v = store.get(key)
          return Promise.resolve(v !== undefined ? { [key]: v } : {})
        },
        set(obj: Record<string, string>) {
          for (const [k, v] of Object.entries(obj)) store.set(k, v)
          return Promise.resolve()
        },
        remove(key: string) {
          store.delete(key)
          return Promise.resolve()
        },
      },
    },
  }

  beforeEach(() => {
    store.clear()
    // Clear localStorage too so leftover entries from the previous describe
    // block don't bleed into the "chrome preferred over localStorage" assertion.
    localStorage.clear()
    vi.stubGlobal('chrome', mockChrome)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('prefers chrome.storage.local over localStorage when both available', async () => {
    const blob = makeBlob()
    await saveEncryptedVault(blob)
    // Should have landed in the mock chrome store, NOT in localStorage.
    expect(store.get('webwallet:vault:v1')).toBe(JSON.stringify(blob))
    expect(localStorage.getItem('webwallet:vault:v1')).toBeNull()
  })

  it('round-trips a blob via chrome.storage.local', async () => {
    const blob = makeBlob()
    await saveEncryptedVault(blob)
    expect(await loadEncryptedVault()).toEqual(blob)
  })

  it('clearEncryptedVault wipes via chrome.storage.local', async () => {
    await saveEncryptedVault(makeBlob())
    await clearEncryptedVault()
    expect(await loadEncryptedVault()).toBeNull()
  })
})
