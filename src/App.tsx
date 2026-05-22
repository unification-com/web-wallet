import { Trans } from '@lingui/react/macro'
import { useEffect, useState } from 'react'

import { ActiveDelegations } from '@/components/ActiveDelegations'
import { Header } from '@/components/Header'
import { InFlightQueues } from '@/components/InFlightQueues'
import { ProposalDetail } from '@/components/ProposalDetail'
import { ProposalList } from '@/components/ProposalList'
import { Receive } from '@/components/Receive'
import { Send } from '@/components/Send'
import { Settings } from '@/components/Settings'
import { TxHistory } from '@/components/TxHistory'
import { Card, CardContent } from '@/components/ui/card'
import { UnlockScreen } from '@/components/UnlockScreen'
import { Validators } from '@/components/Validators'
import { VaultSetup } from '@/components/VaultSetup'
import { useActiveEndpoint, useChainInfo } from '@/lib/chain'
import { useIdleActivity } from '@/lib/hooks/useIdleActivity'
import { ThemeApplier } from '@/lib/hooks/useTheme'
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
      <ThemeApplier />
      {view === 'setup' && <VaultSetup surface={surface} />}
      {view === 'unlock' && <UnlockScreen />}
      {view === 'unlocked' && <UnlockedShell surface={surface} />}
    </div>
  )
}

type UnlockedView = 'wallet' | 'staking' | 'gov' | 'history' | 'settings'

function UnlockedShell({ surface }: { surface: Surface }) {
  const endpoint = useActiveEndpoint()
  const { data, isLoading, isError, error } = useChainInfo()
  const [view, setView] = useState<UnlockedView>('wallet')
  const [activeProposalId, setActiveProposalId] = useState<bigint | null>(null)

  // Resets the vault's idle-lock timer on user activity. Active only while
  // the unlocked shell is mounted (listeners added on unlock, removed on
  // lock).
  useIdleActivity(true)

  if (view === 'settings') {
    return <Settings onBack={() => setView('wallet')} surface={surface} />
  }

  // On standalone / web (non-popup) at ≥640px viewport, tabs convert to a
  // left-hand sidebar nav per the M5 deliverable design system. Popup
  // surface always uses horizontal top tabs (no horizontal room for a
  // sidebar at 360px wide).
  const sidebarMode = surface !== 'popup'

  const chainInfoCard = (
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
  )

  const navItems = (
    <>
      <ViewTab
        active={view === 'wallet'}
        onClick={() => setView('wallet')}
        sidebar={sidebarMode}
      >
        <Trans>Wallet</Trans>
      </ViewTab>
      <ViewTab
        active={view === 'staking'}
        onClick={() => setView('staking')}
        sidebar={sidebarMode}
      >
        <Trans>Staking</Trans>
      </ViewTab>
      <ViewTab
        active={view === 'gov'}
        onClick={() => {
          setView('gov')
          setActiveProposalId(null)
        }}
        sidebar={sidebarMode}
      >
        <Trans>Governance</Trans>
      </ViewTab>
      <ViewTab active={view === 'history'} onClick={() => setView('history')} sidebar={sidebarMode}>
        <Trans>History</Trans>
      </ViewTab>
    </>
  )

  const mainContent = (
    <>
      {view === 'wallet' && (
        <>
          <Receive />
          <Send />
        </>
      )}

      {view === 'staking' && (
        <>
          <InFlightQueues />
          <ActiveDelegations />
          <Validators />
        </>
      )}

      {view === 'gov' &&
        (activeProposalId !== null ? (
          <ProposalDetail
            proposalId={activeProposalId}
            onBack={() => setActiveProposalId(null)}
          />
        ) : (
          <ProposalList onSelect={(id) => setActiveProposalId(id)} />
        ))}

      {view === 'history' && <TxHistory />}
    </>
  )

  if (sidebarMode) {
    return (
      <main className="p-4 flex flex-col gap-4">
        <Header surface={surface} onOpenSettings={() => setView('settings')} />
        <div className="flex flex-col sm:flex-row gap-4">
          <nav className="sm:w-44 shrink-0 flex sm:flex-col gap-1 text-xs sm:border-r sm:pr-3 sm:border-b-0 border-b pb-2 sm:pb-0 overflow-x-auto">
            {navItems}
          </nav>
          <div className="flex flex-col gap-4 flex-1 min-w-0">
            {chainInfoCard}
            {mainContent}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="p-4 flex flex-col gap-4">
      <Header surface={surface} onOpenSettings={() => setView('settings')} />
      {chainInfoCard}
      <nav className="flex gap-1 text-xs border-b">{navItems}</nav>
      {mainContent}
    </main>
  )
}

function ViewTab({
  active,
  onClick,
  children,
  sidebar = false,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  /** When true: sidebar style (left border accent, full-width row). When false: horizontal top-tab style. */
  sidebar?: boolean
}) {
  if (sidebar) {
    // Sidebar layout: full-width row, left-border accent when active.
    // Falls back to horizontal-tab shape on small viewports via the parent
    // nav's `flex-col sm:flex-row` (so the very-narrow web breakpoint still
    // shows tabs along the top).
    return (
      <button
        type="button"
        onClick={onClick}
        className={
          'text-left px-3 py-2 rounded transition-colors ' +
          (active
            ? 'bg-primary/10 text-primary font-medium'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground')
        }
      >
        {children}
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        '-mb-px px-3 py-1.5 border-b-2 transition-colors ' +
        (active
          ? 'border-primary text-primary font-medium'
          : 'border-transparent text-muted-foreground hover:text-foreground')
      }
    >
      {children}
    </button>
  )
}
