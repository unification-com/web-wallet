import { Trans, useLingui } from '@lingui/react/macro'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { ActiveDelegations } from '@/components/ActiveDelegations'
import { Balances } from '@/components/Balances'
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
import { useCosmosRegistryStore } from '@/lib/cosmosRegistry'
import { useIsWhitelistedLite } from '@/lib/enterpriseWhitelist'
import { useIdleActivity } from '@/lib/hooks/useIdleActivity'
import { ThemeApplier } from '@/lib/hooks/useTheme'
import { useActiveSigner } from '@/lib/signer'
import { cn } from '@/lib/utils'
import { useVaultStore } from '@/lib/vault'

// Lazy-load the Streams + Enterprise tabs so the popup boot path doesn't
// pull in fundjs-react's per-module query stacks (QueryClientImpl +
// telescope-generated proto query types) when the user isn't using them.
// Only paid when the tab is opened.
const StreamsList = lazy(() =>
  import('@/components/StreamsList').then((m) => ({ default: m.StreamsList })),
)
const Enterprise = lazy(() =>
  import('@/components/Enterprise').then((m) => ({ default: m.Enterprise })),
)
const SendIbc = lazy(() =>
  import('@/components/SendIbc').then((m) => ({ default: m.SendIbc })),
)
const IbcHistory = lazy(() =>
  import('@/components/IbcHistory').then((m) => ({ default: m.IbcHistory })),
)

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

  // Hydrate the cosmos registry cache from chrome.storage on mount. The
  // refresh-on-unlock effect below kicks in once the user authenticates;
  // until then the cached data (from the previous session) is fine.
  const hydrateCosmosRegistry = useCosmosRegistryStore((s) => s.hydrate)
  useEffect(() => {
    void hydrateCosmosRegistry()
  }, [hydrateCosmosRegistry])

  // Refresh the cosmos registry whenever the vault transitions to
  // `unlocked`. Per operator brief 2026-05-27: each login = fresh chain
  // metadata. Failure is non-blocking — the wallet keeps the prior cached
  // data if the network fetch fails.
  const refreshCosmosRegistry = useCosmosRegistryStore((s) => s.refresh)
  useEffect(() => {
    if (status === 'unlocked') {
      void refreshCosmosRegistry()
    }
  }, [status, refreshCosmosRegistry])

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
        // Popup uses the FIXED viewport height + overflow-hidden so the
        // page-level scrollbar doesn't appear alongside the browser-popup
        // chrome — the unlocked shell handles its own internal scrolling.
        // Standalone / web keep `min-h-screen` so the document grows with
        // content and the browser's native page scroll takes over.
        surface === 'popup'
          ? 'w-[360px] h-screen overflow-hidden flex flex-col'
          : 'min-h-screen w-full max-w-2xl mx-auto',
      )}
    >
      <ThemeApplier />
      {view === 'setup' && <VaultSetup surface={surface} />}
      {view === 'unlock' && <UnlockScreen />}
      {view === 'unlocked' && <UnlockedShell surface={surface} />}
    </div>
  )
}

type UnlockedView =
  | 'wallet'
  | 'staking'
  | 'gov'
  | 'streams'
  | 'enterprise'
  | 'ibc'
  | 'history'
  | 'settings'

function UnlockedShell({ surface }: { surface: Surface }) {
  const endpoint = useActiveEndpoint()
  const { data, isLoading, isError, error } = useChainInfo()
  const { address } = useActiveSigner()
  const [view, setView] = useState<UnlockedView>('wallet')
  const [activeProposalId, setActiveProposalId] = useState<bigint | null>(null)

  // Enterprise tab gate — only whitelisted addresses see the tab or can
  // navigate to the Enterprise view. Uses the lightweight REST-based hook
  // so the eager bundle doesn't pull the heavy fundjs-react enterprise
  // query stack (that stays inside the lazy Enterprise chunk).
  const isEnterpriseWhitelisted = useIsWhitelistedLite(address)
  const canSeeEnterprise = isEnterpriseWhitelisted.data === true

  // If the active account switches to one that isn't whitelisted while the
  // Enterprise tab is open, kick back to Wallet so the user isn't stuck on
  // a view they can no longer access.
  useEffect(() => {
    if (view === 'enterprise' && isEnterpriseWhitelisted.data === false) {
      setView('wallet')
    }
  }, [view, isEnterpriseWhitelisted.data])

  // Resets the vault's idle-lock timer on user activity. Active only while
  // the unlocked shell is mounted (listeners added on unlock, removed on
  // lock).
  useIdleActivity(true)

  if (view === 'settings') {
    return <Settings onBack={() => setView('wallet')} surface={surface} />
  }

  const isPopup = surface === 'popup'

  return (
    <main
      className={cn(
        'flex flex-col gap-4',
        // Popup: take the full constrained height of the parent (`h-screen`
        // on App's root) and let only the active-tab content scroll. Header
        // + chain-info card + tab nav stay parked at the top.
        isPopup ? 'h-full overflow-hidden p-4' : 'p-4',
      )}
    >
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

      {/*
       * Tabs render as horizontal top-row pills at every surface. The
       * sidebar variant was tried in v1 of the M5 deliverable; designer
       * pushed back in v2: at 4 tabs a sidebar leaves a tall empty rail
       * that doesn't earn its keep. A sidebar layout is reserved for the
       * future case where the IA grows past ~6 tabs.
       *
       * `<TabNav>` wraps the strip with left/right chevron buttons that
       * surface only when there's overflow in that direction — popup
       * surface (≤360 px) doesn't fit all 5 tabs natively.
       */}
      <TabNav>
        <ViewTab active={view === 'wallet'} onClick={() => setView('wallet')}>
          <Trans>Wallet</Trans>
        </ViewTab>
        <ViewTab active={view === 'staking'} onClick={() => setView('staking')}>
          <Trans>Staking</Trans>
        </ViewTab>
        <ViewTab
          active={view === 'gov'}
          onClick={() => {
            setView('gov')
            setActiveProposalId(null)
          }}
        >
          <Trans>Governance</Trans>
        </ViewTab>
        <ViewTab active={view === 'streams'} onClick={() => setView('streams')}>
          <Trans>Streams</Trans>
        </ViewTab>
        <ViewTab active={view === 'ibc'} onClick={() => setView('ibc')}>
          <Trans>IBC</Trans>
        </ViewTab>
        {canSeeEnterprise && (
          <ViewTab
            active={view === 'enterprise'}
            onClick={() => setView('enterprise')}
          >
            <Trans>Enterprise</Trans>
          </ViewTab>
        )}
        <ViewTab active={view === 'history'} onClick={() => setView('history')}>
          <Trans>History</Trans>
        </ViewTab>
      </TabNav>

      <div
        className={cn(
          'flex flex-col gap-4',
          // Popup: tab content scrolls internally; -mx-4 + px-4 keeps the
          // scroll edge flush with the outer padding so card edges align.
          isPopup ? 'flex-1 overflow-y-auto -mx-4 px-4 -mb-4 pb-4' : '',
        )}
      >
        {view === 'wallet' && (
          <>
            <Receive />
            <Balances />
            <Send />
          </>
        )}

        {view === 'ibc' && (
          <Suspense
            fallback={
              <p className="text-xs text-muted-foreground italic">
                <Trans>Loading IBC…</Trans>
              </p>
            }
          >
            <SendIbc />
            <IbcHistory />
          </Suspense>
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

        {view === 'streams' && (
          <Suspense
            fallback={
              <p className="text-xs text-muted-foreground italic">
                <Trans>Loading streams…</Trans>
              </p>
            }
          >
            <StreamsList />
          </Suspense>
        )}

        {view === 'enterprise' && canSeeEnterprise && (
          <Suspense
            fallback={
              <p className="text-xs text-muted-foreground italic">
                <Trans>Loading enterprise…</Trans>
              </p>
            }
          >
            <Enterprise />
          </Suspense>
        )}

        {view === 'history' && <TxHistory />}
      </div>
    </main>
  )
}

function ViewTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        '-mb-px px-3 py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ' +
        (active
          ? 'border-primary text-primary font-medium'
          : 'border-transparent text-muted-foreground hover:text-foreground')
      }
    >
      {children}
    </button>
  )
}

/**
 * Horizontal tab strip with left/right chevron arrows for overflow scrolling.
 * Arrows appear only when there's actually overflow in that direction —
 * tracked via the scroll position + content/client width on scroll +
 * ResizeObserver. Each click scrolls by ~80 px (smooth).
 */
function TabNav({ children }: { children: React.ReactNode }) {
  const navRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const { t } = useLingui()

  useLayoutEffect(() => {
    const el = navRef.current
    if (!el) return
    const update = () => {
      setCanScrollLeft(el.scrollLeft > 0)
      // -1 px tolerance for sub-pixel rounding at end-of-scroll.
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [])

  const scrollBy = (dir: -1 | 1) => {
    navRef.current?.scrollBy({ left: dir * 100, behavior: 'smooth' })
  }

  return (
    <div className="relative border-b">
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          aria-label={t`Scroll tabs left`}
          className="absolute left-0 top-0 bottom-0 z-10 flex items-center px-1 bg-background/90 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3 w-3" aria-hidden />
        </button>
      )}
      <nav
        ref={navRef}
        className="flex gap-1 text-xs overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </nav>
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollBy(1)}
          aria-label={t`Scroll tabs right`}
          className="absolute right-0 top-0 bottom-0 z-10 flex items-center px-1 bg-background/90 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className="h-3 w-3" aria-hidden />
        </button>
      )}
    </div>
  )
}
