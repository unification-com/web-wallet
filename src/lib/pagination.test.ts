import { describe, expect, it, vi } from 'vitest'

import { collectPages } from './pagination'

const key = (n: number) => new Uint8Array([n])

describe('pagination.collectPages', () => {
  it('follows nextKey until it is empty and concatenates every page', async () => {
    const pages = new Map<string, { items: number[]; nextKey: Uint8Array }>([
      ['first', { items: [1, 2], nextKey: key(1) }],
      ['1', { items: [3, 4], nextKey: key(2) }],
      ['2', { items: [5], nextKey: new Uint8Array() }],
    ])
    const fetchPage = vi.fn((k?: Uint8Array) => {
      const page = pages.get(k ? String(k[0]) : 'first') ?? { items: [], nextKey: new Uint8Array() }
      return Promise.resolve({ items: page.items, pagination: { nextKey: page.nextKey } })
    })
    expect(await collectPages(fetchPage)).toEqual([1, 2, 3, 4, 5])
    expect(fetchPage).toHaveBeenCalledTimes(3)
    expect(fetchPage.mock.calls[0]?.[0]).toBeUndefined()
  })

  it('stops after one call when there is no pagination response', async () => {
    const fetchPage = vi.fn(() => Promise.resolve({ items: ['a'], pagination: undefined }))
    expect(await collectPages(fetchPage)).toEqual(['a'])
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })
})
