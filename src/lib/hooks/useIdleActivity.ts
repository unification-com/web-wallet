import { useEffect } from 'react'

import { useVaultStore } from '@/lib/vault'

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const
const THROTTLE_MS = 30_000

/**
 * Wires DOM user-activity events to the vault store's idle-timeout reset.
 * Without this, the auto-lock timer only resets when the user fires a
 * mutating store action — so they'd get locked out mid-Send while typing.
 *
 * Throttled to once per 30 s so we're not spamming Zustand updates on every
 * mouse move; resolution-wise this is generous (the auto-lock default is
 * 15 min, so a 30-s sampling window is negligible).
 */
export function useIdleActivity(active: boolean): void {
  const resetIdleTimer = useVaultStore((s) => s.resetIdleTimer)

  useEffect(() => {
    if (!active) return
    let lastFired = 0
    const onActivity = () => {
      const now = Date.now()
      if (now - lastFired < THROTTLE_MS) return
      lastFired = now
      resetIdleTimer()
    }
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true })
    }
    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity)
      }
    }
  }, [active, resetIdleTimer])
}
