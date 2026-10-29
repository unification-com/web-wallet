import { describe, expect, it, vi } from 'vitest'

// fundjs-react's QueryClientImpl import is the same CJS-via-link footgun as
// in `stream.test.ts` — stub the module so the test runtime can resolve the
// pure helpers without pulling `@tanstack/react-query` through fundjs's dist.
vi.mock('@unification-com/fundjs-react/mainchain/enterprise/v1/query.rpc.Query', () => ({
  QueryClientImpl: class {},
}))

const { PurchaseOrderStatus, sortPurchaseOrders, statusLabel } = await import('./enterprise')
type EnterpriseUndPurchaseOrder = import('./enterprise').EnterpriseUndPurchaseOrder

function mkPo(opts: {
  id: bigint
  raiseTime: bigint
  status?: (typeof PurchaseOrderStatus)[keyof typeof PurchaseOrderStatus]
}): EnterpriseUndPurchaseOrder {
  return {
    id: opts.id,
    purchaser: 'und1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    amount: { denom: 'nund', amount: '1000000000' },
    status: opts.status ?? PurchaseOrderStatus.STATUS_RAISED,
    raiseTime: opts.raiseTime,
  } as EnterpriseUndPurchaseOrder
}

describe('enterprise.statusLabel', () => {
  it('maps every status enum value to a stable label', () => {
    expect(statusLabel(PurchaseOrderStatus.STATUS_RAISED)).toBe('raised')
    expect(statusLabel(PurchaseOrderStatus.STATUS_ACCEPTED)).toBe('accepted')
    expect(statusLabel(PurchaseOrderStatus.STATUS_REJECTED)).toBe('rejected')
    expect(statusLabel(PurchaseOrderStatus.STATUS_COMPLETED)).toBe('completed')
    expect(statusLabel(PurchaseOrderStatus.STATUS_NIL)).toBe('unknown')
    expect(statusLabel(PurchaseOrderStatus.UNRECOGNIZED)).toBe('unknown')
  })
})

describe('enterprise.sortPurchaseOrders', () => {
  it('orders newest raise_time first', () => {
    const a = mkPo({ id: 1n, raiseTime: 100n })
    const b = mkPo({ id: 2n, raiseTime: 200n })
    const c = mkPo({ id: 3n, raiseTime: 50n })
    const sorted = sortPurchaseOrders([a, b, c])
    expect(sorted.map((p) => p.id)).toEqual([2n, 1n, 3n])
  })

  it('breaks ties on id descending', () => {
    const a = mkPo({ id: 1n, raiseTime: 100n })
    const b = mkPo({ id: 2n, raiseTime: 100n })
    const sorted = sortPurchaseOrders([a, b])
    expect(sorted.map((p) => p.id)).toEqual([2n, 1n])
  })

  it('returns a new array; does not mutate input', () => {
    const a = mkPo({ id: 1n, raiseTime: 100n })
    const input = [a]
    const sorted = sortPurchaseOrders(input)
    expect(sorted).not.toBe(input)
  })
})
