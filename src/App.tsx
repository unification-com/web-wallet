import { useEffect } from 'react'

import { Header } from '@/components/Header'
import { Receive } from '@/components/Receive'
import { Send } from '@/components/Send'
import { UnlockScreen } from '@/components/UnlockScreen'
import { VaultSetup } from '@/components/VaultSetup'
import { useActiveEndpoint, useChainInfo } from '@/lib/chain'
import { useIdleActivity } from '@/lib/hooks/useIdleActivity'
import { cn } from '@/lib/utils'
import { useVaultStore } from '@/lib/vault'

type Surface = 'popup' | 'standalone' | 'web'

export function App({ surface }: { surface: Surface }) {
  const status = useVaultStore((s) => s.status)
  const hasActiveSigner = useVaultStore(
    (s) => s.vault?.preferences.activeSignerRef !== undefined,
  )
  const hydrate = useVaultStore((s) => s.hydrate)

  // Detect existing vault on mount → set status to 'locked' or 'no-vault'.
  useEffect(() => {
    void hydrate()
  }, [hydrate])

  // An unlocked vault with no active signer is mid-setup (just-created or
  // re-opened after a partial setup) — route back to VaultSetup until the
  // user picks a path and the first signer becomes active.
  const view: 'setup' | 'unlock' | 'unlocked' =
    status === 'no-vault'
      ? 'setup'
      : status === 'locked'
        ? 'unlock'
        : hasActiveSigner
          ? 'unlocked'
          : 'setup'

  return (
    <div
      className={cn(
        'min-h-screen',
        surface === 'popup' ? 'w-[360px]' : 'w-full max-w-2xl mx-auto',
      )}
    >
      {view === 'setup' && <VaultSetup surface={surface} />}
      {view === 'unlock' && <UnlockScreen />}
      {view === 'unlocked' && <UnlockedShell surface={surface} />}
    </div>
  )
}

function UnlockedShell({ surface }: { surface: Surface }) {
  const endpoint = useActiveEndpoint()
  const { data, isLoading, isError, error } = useChainInfo()

  // Resets the vault's idle-lock timer on user activity. Active only while
  // the unlocked shell is mounted (listeners added on unlock, removed on
  // lock).
  useIdleActivity(true)

  return (
    <main className="p-4 flex flex-col gap-4">
      <Header surface={surface} />

      <section className="border rounded p-3 flex flex-col gap-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Network:</span>
          <span className="font-medium">{endpoint.label}</span>
        </div>
        {isLoading && <p className="text-gray-500">Connecting…</p>}
        {isError && (
          <p className="text-red-600">
            Failed to connect: {error instanceof Error ? error.message : String(error)}
          </p>
        )}
        {data && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-gray-500">Chain ID</dt>
            <dd className="font-mono">{data.chainId}</dd>
            <dt className="text-gray-500">Height</dt>
            <dd className="font-mono">{data.height.toLocaleString()}</dd>
          </dl>
        )}
      </section>

      <Receive />
      <Send />
    </main>
  )
}
