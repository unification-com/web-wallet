import type { Event } from '@cosmjs/stargate'
import { describe, expect, it } from 'vitest'

import {
  findEvent,
  flowRateAttr,
  formatCoinAttr,
  formatDurationAttr,
  formatTimeAttr,
  getAttr,
  itemFromAttr,
  presentMsg,
} from './presenters'

function mkEvent(type: string, attrs: Record<string, string>): Event {
  return {
    type,
    attributes: Object.entries(attrs).map(([key, value]) => ({ key, value })),
  }
}

describe('presenters.findEvent', () => {
  it('returns null when no event of the type exists', () => {
    expect(findEvent([], 'register_beacon', 0)).toBeNull()
    expect(findEvent([mkEvent('coin_received', {})], 'register_beacon', 0)).toBeNull()
  })

  it('returns the first matching event by type when no msg_index tagging', () => {
    const events = [
      mkEvent('coin_received', { recipient: 'und1a' }),
      mkEvent('register_beacon', { beacon_id: '1', beacon_owner: 'und1a' }),
      mkEvent('register_beacon', { beacon_id: '2', beacon_owner: 'und1a' }),
    ]
    const result = findEvent(events, 'register_beacon', 0)
    expect(getAttr(result, 'beacon_id')).toBe('1')
  })

  it('disambiguates by msg_index when present (SDK v0.50+ tagging)', () => {
    const events = [
      mkEvent('record_beacon_timestamp', { beacon_id: '1', msg_index: '0' }),
      mkEvent('record_beacon_timestamp', { beacon_id: '2', msg_index: '1' }),
      mkEvent('record_beacon_timestamp', { beacon_id: '3', msg_index: '2' }),
    ]
    expect(getAttr(findEvent(events, 'record_beacon_timestamp', 0), 'beacon_id')).toBe('1')
    expect(getAttr(findEvent(events, 'record_beacon_timestamp', 1), 'beacon_id')).toBe('2')
    expect(getAttr(findEvent(events, 'record_beacon_timestamp', 2), 'beacon_id')).toBe('3')
  })

  it('falls back to first-by-type when msg_index is on SOME events but not the target', () => {
    // Mixed-tagging case: some events carry msg_index, some don't. The first
    // pass finds nothing tagged at the right index, so the second pass picks
    // the first match by type.
    const events = [
      mkEvent('claim_stream', { sender: 'und1a', msg_index: '5' }),
      mkEvent('claim_stream', { sender: 'und1b' /* no msg_index */ }),
    ]
    expect(getAttr(findEvent(events, 'claim_stream', 0), 'sender')).toBe('und1a')
  })
})

describe('presenters.getAttr', () => {
  it('returns null for null event', () => {
    expect(getAttr(null, 'foo')).toBeNull()
  })

  it('returns null for missing key', () => {
    expect(getAttr(mkEvent('e', { other: 'value' }), 'foo')).toBeNull()
  })

  it('returns the value for present key', () => {
    expect(getAttr(mkEvent('e', { beacon_id: '42' }), 'beacon_id')).toBe('42')
  })

  it('returns the first matching attribute when duplicates exist', () => {
    // Defensive — the chain doesn't emit duplicate attribute keys in
    // practice but Array.find semantics give us the first.
    expect(getAttr(mkEvent('e', { foo: 'one' }), 'foo')).toBe('one')
  })
})

describe('presenters.itemFromAttr', () => {
  const event = mkEvent('register_beacon', {
    beacon_id: '42',
    beacon_moniker: '',
    beacon_name: 'My Beacon',
  })

  it('returns null when the attribute is absent', () => {
    expect(itemFromAttr('ID', event, 'nonexistent')).toBeNull()
  })

  it('returns null when the attribute value is empty', () => {
    expect(itemFromAttr('Moniker', event, 'beacon_moniker')).toBeNull()
  })

  it('returns null when the event itself is null', () => {
    expect(itemFromAttr('ID', null, 'beacon_id')).toBeNull()
  })

  it('builds an item when value is present', () => {
    expect(itemFromAttr('ID', event, 'beacon_id')).toEqual({ label: 'ID', value: '42' })
  })

  it('passes through the mono flag when requested', () => {
    expect(itemFromAttr('ID', event, 'beacon_id', { mono: true })).toEqual({
      label: 'ID',
      value: '42',
      mono: true,
    })
  })

  it('omits the mono flag when not requested (rather than setting false)', () => {
    const item = itemFromAttr('Name', event, 'beacon_name')
    expect(item).not.toBeNull()
    expect('mono' in (item as object)).toBe(false)
  })

  it('applies the format function to the value', () => {
    expect(itemFromAttr('ID', event, 'beacon_id', { format: (v) => `#${v}` })).toEqual({ label: 'ID', value: '#42' })
  })
})

describe('presenters attribute formatters', () => {
  it('formats a nund coin attribute as grouped FUND', () => {
    expect(formatCoinAttr('100000000000nund')).toBe('100 FUND')
    expect(formatCoinAttr('1234567890123nund')).toBe('1,234.567890123 FUND')
  })

  it('leaves other denoms in base units and unparseable values as they are', () => {
    expect(formatCoinAttr('500ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2')).toBe(
      '500 ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2',
    )
    expect(formatCoinAttr('not a coin')).toBe('not a coin')
  })

  it('formats a FUND flow rate in its most readable period', () => {
    expect(flowRateAttr('nund')('1157')).toBe('2.998944 FUND / month')
    expect(flowRateAttr('nund')('1000000000')).toBe('1 FUND / sec')
    // Pre-multi-denom streams carry no denom attribute: they're FUND.
    expect(flowRateAttr(null)('1000000000')).toBe('1 FUND / sec')
  })

  it('formats another denom per second in base units', () => {
    expect(flowRateAttr('uatom')('25')).toBe('25 uatom / sec')
  })

  it('formats a seconds attribute as words', () => {
    expect(formatDurationAttr('604800')).toBe('7 days')
    expect(formatDurationAttr('soon')).toBe('soon')
  })

  it('formats a time attribute as a date and time, leaving junk as it is', () => {
    expect(formatTimeAttr('2026-11-09 12:34:56.789 +0000 UTC')).toMatch(/Nov \d{1,2}, 2026/)
    expect(formatTimeAttr('1730542496')).toMatch(/Nov \d{1,2}, 2024/)
    expect(formatTimeAttr('whenever')).toBe('whenever')
  })
})

describe('presenters stream rows', () => {
  it('shows a top-up in FUND, words and a date, without the raw denom row', () => {
    const events = [
      mkEvent('stream_deposit', {
        sender: 'und1sender',
        receiver: 'und1receiver',
        denom: 'nund',
        amount_deposited: '100000000000nund',
        deposit_duration: '604800',
        deposit_zero_time: '2026-11-09 12:34:56.789 +0000 UTC',
        remaining_deposit: '150000000000nund',
      }),
    ]
    const result = presentMsg(
      { typeUrl: '/mainchain.stream.v1.MsgTopUpDeposit', value: new Uint8Array() },
      { address: 'und1sender', events, msgIndex: 0 },
    )
    const byLabel = Object.fromEntries(result.items.map((i) => [i.label, i.value]))
    expect(byLabel.Added).toBe('100 FUND')
    expect(byLabel['Extends by']).toBe('7 days')
    expect(byLabel['Now drains at']).toMatch(/Nov \d{1,2}, 2026/)
    expect(byLabel).not.toHaveProperty('Denom')
  })
})
