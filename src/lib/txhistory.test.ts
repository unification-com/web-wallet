import type { IndexedTx } from '@cosmjs/stargate'
import { describe, expect, it } from 'vitest'


import { mergeTxLists } from './txhistory'

// Build a minimal IndexedTx stub. Tests only touch the fields mergeTxLists
// uses (hash / height / txIndex); cast through IndexedTx is safe.
function mkTx(hash: string, height: number, txIndex = 0): IndexedTx {
  return {
    hash,
    height,
    txIndex,
    code: 0,
    events: [],
    rawLog: '',
    tx: new Uint8Array(),
    msgResponses: [],
    gasUsed: 0n,
    gasWanted: 0n,
  }
}

describe('txhistory.mergeTxLists', () => {
  it('returns an empty array when given nothing', () => {
    expect(mergeTxLists()).toEqual([])
    expect(mergeTxLists([])).toEqual([])
    expect(mergeTxLists([], [], [])).toEqual([])
  })

  it('preserves all unique hashes', () => {
    const result = mergeTxLists([mkTx('A', 10), mkTx('B', 9)], [mkTx('C', 8)])
    expect(result.map((t) => t.hash)).toEqual(['A', 'B', 'C'])
  })

  it('dedupes by hash across input lists (first occurrence wins)', () => {
    const result = mergeTxLists([mkTx('A', 10), mkTx('B', 9)], [mkTx('A', 10), mkTx('C', 8)])
    expect(result.map((t) => t.hash)).toEqual(['A', 'B', 'C'])
  })

  it('sorts newest height first', () => {
    const result = mergeTxLists([mkTx('A', 5), mkTx('B', 100), mkTx('C', 42)])
    expect(result.map((t) => t.hash)).toEqual(['B', 'C', 'A'])
  })

  it('breaks same-height ties on txIndex desc (last tx in block first)', () => {
    const result = mergeTxLists([mkTx('A', 10, 0), mkTx('B', 10, 5), mkTx('C', 10, 2)])
    expect(result.map((t) => t.hash)).toEqual(['B', 'C', 'A'])
  })

  it("doesn't mutate input lists", () => {
    const sent = [mkTx('A', 10), mkTx('B', 9)]
    const received = [mkTx('C', 8)]
    const sentSnap = sent.map((t) => t.hash)
    const receivedSnap = received.map((t) => t.hash)
    mergeTxLists(sent, received)
    expect(sent.map((t) => t.hash)).toEqual(sentSnap)
    expect(received.map((t) => t.hash)).toEqual(receivedSnap)
  })
})
