import { Trans } from '@lingui/react/macro'
import { useEffect, useState } from 'react'

import { Header } from '@/components/Header'
import { Receive } from '@/components/Receive'
import { Send } from '@/components/Send'
import { Settings } from '@/components/Settings'
import { Card, CardContent } from '@/components/ui/card'
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

  // Listen for cross-window vault changes (popup vs standalone tab). If
  // another surface created / reset the vault while THIS surface is idle
  // (no-vault or locked), re-hydrate so the UI reflects the new blob state.
  // Skipped while unlocked — re-hydrating would clobber the active session
  // and force the user back to UnlockScreen. Full unlocked-state sync is M9.
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (!('webwallet:vault:v1' in changes)) return
      if (useVaultStore.getState().status === 'unlocked') return
      void hydrate()
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
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
  const [view, setView] = useState<'wallet' | 'settings'>('wallet')

  // Resets the vault's idle-lock timer on user activity. Active only while
  // the unlocked shell is mounted (listeners added on unlock, removed on
  // lock).
  useIdleActivity(true)

  if (view === 'settings') {
    return <Settings onBack={() => setView('wallet')} surface={surface} />
  }

  return (
    <main className="p-4 flex flex-col gap-4">
      <Header surface={surface} onOpenSettings={() => setView('settings')} />

      <Card>
        <CardContent className="p-4 flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">
              <Trans>Network:</Trans>
            </span>
            <span className="font-medium">{endpoint.label}</span>
          </div>
          {isLoading && (
            <p className="text-muted-foreground">
              <Trans>Connecting…</Trans>
            </p>
          )}
          {isError && (
            <p className="text-destructive">
              <Trans>
                Failed to connect: {error instanceof Error ? error.message : String(error)}
              </Trans>
            </p>
          )}
          {data && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">
                <Trans>Chain ID</Trans>
              </dt>
              <dd className="font-mono">{data.chainId}</dd>
              <dt className="text-muted-foreground">
                <Trans>Height</Trans>
              </dt>
              <dd className="font-mono">{data.height.toLocaleString()}</dd>
            </dl>
          )}
        </CardContent>
      </Card>

      <Receive />
      <Send />
    </main>
  )
}
