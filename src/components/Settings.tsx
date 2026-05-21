import { AlertTriangle, ArrowLeft, Check, Loader2, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { VaultEntryManager } from '@/components/VaultEntryManager'
import {
  listBuiltInEndpoints,
  pingNodeInfo,
  pingRestNodeInfo,
  validateEndpointUrl,
  useActiveEndpoint,
  type ChainEndpoint,
} from '@/lib/chain'
import { useVaultStore } from '@/lib/vault'

interface PerEndpointPing {
  status: 'idle' | 'pinging' | 'ok' | 'error'
  chainId?: string
  height?: number
  error?: string
}

interface AddState {
  label: string
  rpc: string
  rest: string
  rpcPing: PerEndpointPing
  restPing: PerEndpointPing
  saveError: string | null
}

const idlePing: PerEndpointPing = { status: 'idle' }

const emptyAdd = (): AddState => ({
  label: '',
  rpc: '',
  rest: '',
  rpcPing: idlePing,
  restPing: idlePing,
  saveError: null,
})

export function Settings({
  onBack,
  surface,
}: {
  onBack: () => void
  surface: 'popup' | 'standalone' | 'web'
}) {
  const active = useActiveEndpoint()
  const customEndpoints = useVaultStore((s) => s.vault?.customEndpoints ?? [])
  const addCustomEndpoint = useVaultStore((s) => s.addCustomEndpoint)
  const removeCustomEndpoint = useVaultStore((s) => s.removeCustomEndpoint)
  const setActiveEndpoint = useVaultStore((s) => s.setActiveEndpoint)

  const [add, setAdd] = useState<AddState>(emptyAdd())

  const builtIn = listBuiltInEndpoints()

  const chainIdMismatch =
    add.rpcPing.status === 'ok' &&
    add.restPing.status === 'ok' &&
    add.rpcPing.chainId !== add.restPing.chainId

  const canSave =
    add.label.trim().length > 0 &&
    add.rpcPing.status === 'ok' &&
    (add.rest.trim().length === 0 || add.restPing.status === 'ok') &&
    !chainIdMismatch

  const pingRpc = async (url: string) => {
    if (!url.trim()) {
      setAdd((s) => ({ ...s, rpcPing: idlePing }))
      return
    }
    const validation = validateEndpointUrl(url)
    if (!validation.ok) {
      setAdd((s) => ({
        ...s,
        rpcPing: { status: 'error', error: validation.reason ?? 'invalid URL' },
      }))
      return
    }
    setAdd((s) => ({ ...s, rpcPing: { status: 'pinging' } }))
    try {
      const result = await pingNodeInfo(url)
      setAdd((s) => ({
        ...s,
        rpcPing: { status: 'ok', chainId: result.chainId, height: result.height },
      }))
    } catch (err) {
      setAdd((s) => ({
        ...s,
        rpcPing: { status: 'error', error: err instanceof Error ? err.message : String(err) },
      }))
    }
  }

  const pingRest = async (url: string) => {
    if (!url.trim()) {
      setAdd((s) => ({ ...s, restPing: idlePing }))
      return
    }
    const validation = validateEndpointUrl(url)
    if (!validation.ok) {
      setAdd((s) => ({
        ...s,
        restPing: { status: 'error', error: validation.reason ?? 'invalid URL' },
      }))
      return
    }
    setAdd((s) => ({ ...s, restPing: { status: 'pinging' } }))
    try {
      const result = await pingRestNodeInfo(url)
      setAdd((s) => ({
        ...s,
        restPing: { status: 'ok', chainId: result.chainId, height: result.height },
      }))
    } catch (err) {
      setAdd((s) => ({
        ...s,
        restPing: { status: 'error', error: err instanceof Error ? err.message : String(err) },
      }))
    }
  }

  const onSave = async () => {
    if (!canSave) return
    try {
      await addCustomEndpoint({
        label: add.label.trim(),
        rpc: add.rpc.trim(),
        ...(add.rest.trim() ? { rest: add.rest.trim() } : {}),
      })
      setAdd(emptyAdd())
    } catch (err) {
      setAdd((s) => ({ ...s, saveError: err instanceof Error ? err.message : String(err) }))
    }
  }

  const onRemove = async (id: string) => {
    try {
      await removeCustomEndpoint(id)
    } catch (err) {
      console.error('[Settings] removeCustomEndpoint failed', err)
    }
  }

  const onActivate = async (id: string) => {
    try {
      await setActiveEndpoint(id)
    } catch (err) {
      console.error('[Settings] setActiveEndpoint failed', err)
    }
  }

  return (
    <main className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <h1 className="text-base font-semibold">Settings</h1>
      </div>

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Network endpoints</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2 flex flex-col gap-3 text-xs">
          <EndpointList
            label="Built-in"
            endpoints={builtIn}
            activeId={active.id}
            onActivate={onActivate}
          />
          {customEndpoints.length > 0 && (
            <EndpointList
              label="Custom"
              endpoints={customEndpoints.map((e) => ({
                id: e.id,
                label: e.label,
                rpc: e.rpc,
                rest: e.rest ?? '',
                source: 'custom' as const,
              }))}
              activeId={active.id}
              onActivate={onActivate}
              onRemove={onRemove}
            />
          )}

          <div className="border-t pt-3 flex flex-col gap-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Add custom endpoint
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="ep-label">Label</Label>
              <Input
                id="ep-label"
                value={add.label}
                onChange={(e) =>
                  setAdd((s) => ({ ...s, label: e.target.value, saveError: null }))
                }
                placeholder="My DevNet"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="ep-rpc">RPC URL</Label>
              <Input
                id="ep-rpc"
                value={add.rpc}
                onChange={(e) =>
                  setAdd((s) => ({
                    ...s,
                    rpc: e.target.value,
                    rpcPing: idlePing,
                    saveError: null,
                  }))
                }
                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                onBlur={(e) => pingRpc(e.target.value)}
                placeholder="https://… or http://localhost:26657"
                className="font-mono text-xs"
              />
              <PingHint ping={add.rpcPing} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="ep-rest">REST URL (optional)</Label>
              <Input
                id="ep-rest"
                value={add.rest}
                onChange={(e) =>
                  setAdd((s) => ({
                    ...s,
                    rest: e.target.value,
                    restPing: idlePing,
                    saveError: null,
                  }))
                }
                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                onBlur={(e) => pingRest(e.target.value)}
                placeholder="https://…"
                className="font-mono text-xs"
              />
              <PingHint ping={add.restPing} />
            </div>
            {chainIdMismatch && (
              <p className="text-xs text-destructive flex items-start gap-1">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-none" />
                <span>
                  Chain ID mismatch: RPC reports{' '}
                  <span className="font-mono">{add.rpcPing.chainId}</span>, REST reports{' '}
                  <span className="font-mono">{add.restPing.chainId}</span>. These are
                  different networks — fix one before saving.
                </span>
              </p>
            )}
            {add.saveError && (
              <p className="text-xs text-destructive break-words">{add.saveError}</p>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={!canSave}
                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                onClick={onSave}
              >
                Save endpoint
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              HTTPS accepted always; HTTP only for localhost (DevNet). Chain ID is verified
              automatically when each URL loses focus; Save is enabled once both URLs (if
              REST given) report the same chain ID.
            </p>
          </div>
        </CardContent>
      </Card>

      <VaultEntryManager surface={surface} />
    </main>
  )
}

function PingHint({ ping }: { ping: PerEndpointPing }) {
  if (ping.status === 'idle') return null
  if (ping.status === 'pinging') {
    return (
      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Verifying…
      </span>
    )
  }
  if (ping.status === 'ok') {
    return (
      <span className="text-[11px] text-green-700 flex items-center gap-1">
        <Check className="h-3 w-3" />
        Chain <span className="font-mono">{ping.chainId}</span>
        {typeof ping.height === 'number' && ping.height > 0 && (
          <span className="text-muted-foreground">· height {ping.height.toLocaleString()}</span>
        )}
      </span>
    )
  }
  return (
    <span className="text-[11px] text-destructive break-words">
      {ping.error ?? 'failed to reach endpoint'}
    </span>
  )
}

function EndpointList({
  label,
  endpoints,
  activeId,
  onActivate,
  onRemove,
}: {
  label: string
  endpoints: ChainEndpoint[]
  activeId: string
  onActivate: (id: string) => Promise<void>
  onRemove?: (id: string) => Promise<void>
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <ul className="flex flex-col gap-1">
        {endpoints.map((e) => {
          const isActive = e.id === activeId
          return (
            <li key={e.id} className="flex items-center gap-2">
              <button
                type="button"
                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                onClick={() => onActivate(e.id)}
                className={
                  'flex-1 flex items-center justify-between gap-2 rounded border p-2 text-left text-xs hover:bg-accent ' +
                  (isActive ? 'border-primary bg-primary/5' : 'border-border')
                }
              >
                <span className="flex flex-col">
                  <span className="font-medium">{e.label}</span>
                  <span className="font-mono text-[10px] text-muted-foreground truncate">
                    {e.rpc}
                  </span>
                </span>
                {isActive && (
                  <span className="text-primary text-[10px] font-medium">ACTIVE</span>
                )}
              </button>
              {onRemove && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  title="Remove endpoint"
                  // eslint-disable-next-line @typescript-eslint/no-misused-promises
                  onClick={() => onRemove(e.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
