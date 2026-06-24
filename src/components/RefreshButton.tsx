import { useLingui } from '@lingui/react/macro'
import { useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'

interface RefreshButtonProps {
  /**
   * Query keys to invalidate. Each entry is the prefix passed to
   * TanStack's `invalidateQueries({ queryKey })` — only the prefix needs
   * matching, so e.g. `['staking']` invalidates every staking query
   * regardless of endpoint / address suffix.
   */
  queryKeys: readonly (readonly string[])[]
  /** Optional title attribute override (defaults to "Refresh"). */
  title?: string
}

/**
 * Shared refresh affordance for live on-chain query surfaces (tx history,
 * staking, governance). Invalidates the listed query keys via TanStack
 * Query; spins the icon for a short window after click so the user gets
 * visible feedback even when the underlying query was already in-flight.
 */
export function RefreshButton({ queryKeys, title }: RefreshButtonProps) {
  const queryClient = useQueryClient()
  const { t } = useLingui()
  const [spinning, setSpinning] = useState(false)

  const onClick = async () => {
    setSpinning(true)
    try {
      await Promise.all(
        queryKeys.map((key) => queryClient.invalidateQueries({ queryKey: [...key] })),
      )
    } finally {
      // Always at least a 400ms spin so the user perceives the action
      // even when the refetch resolves instantly from cache.
      setTimeout(() => setSpinning(false), 400)
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6"
      onClick={() => void onClick()}
      disabled={spinning}
      title={title ?? t`Refresh`}
    >
      <RefreshCw className={`h-3 w-3 ${spinning ? 'animate-spin' : ''}`} />
    </Button>
  )
}
