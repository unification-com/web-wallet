import { useEffect, useRef, useState } from 'react'

import {
  customToChainEndpoint,
  listBuiltInEndpoints,
  useActiveEndpoint,
  type ChainEndpoint,
} from '@/lib/chain'
import { useVaultStore } from '@/lib/vault'

/**
 * Clickable Header endpoint chip + dropdown. Switches between built-in
 * (MainNet/TestNet/DevNet) and any vault-stored custom endpoints. Adding new
 * custom endpoints lives in the full Settings panel (M1.10c).
 */
export function EndpointSwitcher() {
  const active = useActiveEndpoint()
  const customEndpoints = useVaultStore((s) => s.vault?.customEndpoints ?? [])
  const setActiveEndpoint = useVaultStore((s) => s.setActiveEndpoint)

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
        title={`${active.label} (${active.source}) — click to switch`}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs"
      >
        <span>{active.label}</span>
        <span aria-hidden className={open ? 'rotate-180 transition-transform' : 'transition-transform'}>
          ▾
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 mt-1 min-w-[180px] max-w-[260px] border bg-white rounded shadow-lg text-xs z-10"
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
                  className={
                    'w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-gray-50 ' +
                    (isActive ? 'font-medium text-blue-700' : 'text-gray-700')
                  }
                >
                  <span className="flex flex-col">
                    <span>{e.label}</span>
                    <span className="text-[10px] text-gray-400 font-mono truncate">{e.rpc}</span>
                  </span>
                  {isActive && <span aria-hidden>✓</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
