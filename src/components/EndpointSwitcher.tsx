import { useLingui } from '@lingui/react/macro'
import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import {
  customToChainEndpoint,
  listBuiltInEndpoints,
  useActiveEndpoint,
  type ChainEndpoint,
} from '@/lib/chain'
import { cn } from '@/lib/utils'
import { useVaultStore } from '@/lib/vault'

/**
 * Clickable Header endpoint chip + dropdown. Switches between built-in
 * (MainNet/TestNet/DevNet) and any vault-stored custom endpoints. Adding new
 * custom endpoints lives in the full Settings panel (M1.10c).
 *
 * Token-aware re-skin: the chip + popover honour `--color-card`,
 * `--color-popover`, `--color-border`, etc. so the dropdown reads the
 * same dark surface as the rest of the app instead of a hardcoded white.
 */
export function EndpointSwitcher() {
  const active = useActiveEndpoint()
  const customEndpoints = useVaultStore((s) => s.vault?.customEndpoints ?? [])
  const setActiveEndpoint = useVaultStore((s) => s.setActiveEndpoint)
  const { t } = useLingui()

  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Close on outside click + Escape — keeps the popup-tight UI from getting
  // wedged open after navigation.
  useEffect(() => {
    if (!open) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const all: ChainEndpoint[] = [
    ...listBuiltInEndpoints(),
    ...customEndpoints.map(customToChainEndpoint),
  ]

  const pick = async (id: string) => {
    try {
      await setActiveEndpoint(id)
    } catch (err) {
      // setActiveEndpoint throws if id no longer exists — shouldn't happen
      // here but surface to console rather than silent failure.
      console.error('[EndpointSwitcher] setActiveEndpoint failed', err)
    } finally {
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={`${active.label} (${active.source}) — ${t`click to switch`}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-1 px-2 h-7 rounded text-xs',
          'border border-border bg-card text-foreground hover:bg-secondary transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        )}
      >
        {/* network status dot — small green pulse so the chip carries health at a glance */}
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full bg-success shrink-0"
        />
        <span className="font-medium">{active.label}</span>
        <ChevronDown
          aria-hidden
          className={cn(
            'h-3 w-3 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className={cn(
            'absolute right-0 mt-1.5 min-w-[220px] max-w-[300px] z-50',
            'rounded border border-border bg-popover text-popover-foreground',
            'shadow-[var(--shadow-elevated)] [.theme-mainframe_&]:shadow-none',
            'p-1 text-xs',
          )}
        >
          {all.map((e) => {
            const isActive = e.id === active.id
            return (
              <li key={e.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  // eslint-disable-next-line @typescript-eslint/no-misused-promises
                  onClick={() => pick(e.id)}
                  className={cn(
                    'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded text-left transition-colors',
                    isActive
                      ? 'bg-primary/12 text-primary'
                      : 'text-foreground hover:bg-secondary',
                  )}
                >
                  <span className="flex flex-col min-w-0">
                    <span className={cn('truncate', isActive && 'font-semibold')}>
                      {e.label}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground truncate">
                      {e.rpc}
                    </span>
                  </span>
                  {isActive && <Check aria-hidden className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
