import { ArrowLeft, Loader2, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { VaultEntryManager } from '@/components/VaultEntryManager'
import {
  listBuiltInEndpoints,
  pingNodeInfo,
  validateEndpointUrl,
  useActiveEndpoint,
  type ChainEndpoint,
} from '@/lib/chain'
import { useVaultStore } from '@/lib/vault'

interface AddState {
  label: string
  rpc: string
  rest: string
  pinging: boolean
  pingResult: { chainId: string; height: number } | null
  error: string | null
}

const emptyAdd = (): AddState => ({
  label: '',
  rpc: '',
  rest: '',
  pinging: false,
  pingResult: null,
  error: null,
})

export function Settings({ onBack }: { onBack: () => void }) {
  const active = useActiveEndpoint()
  const customEndpoints = useVaultStore((s) => s.vault?.customEndpoints ?? [])
  const addCustomEndpoint = useVaultStore((s) => s.addCustomEndpoint)
  const removeCustomEndpoint = useVaultStore((s) => s.removeCustomEndpoint)
  const setActiveEndpoint = useVaultStore((s) => s.setActiveEndpoint)

  const [add, setAdd] = useState<AddState>(emptyAdd())

  const builtIn = listBuiltInEndpoints()

  const onPing = async () => {
    const validation = validateEndpointUrl(add.rpc)
    if (!validation.ok) {
      setAdd({ ...add, error: validation.reason ?? 'invalid URL', pingResult: null })
      return
    }
    setAdd({ ...add, pinging: true, error: null, pingResult: null })
    try {
      const result = await pingNodeInfo(add.rpc)
      setAdd({ ...add, pinging: false, pingResult: result, error: null })
    } catch (err) {
      setAdd({
        ...add,
        pinging: false,
        pingResult: null,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const onSave = async () => {
    if (!add.label.trim()) {
      setAdd({ ...add, error: 'label is required' })
      return
    }
    const validation = validateEndpointUrl(add.rpc)
    if (!validation.ok) {
      setAdd({ ...add, error: validation.reason ?? 'invalid URL' })
      return
    }
    if (add.rest) {
      const restValidation = validateEndpointUrl(add.rest)
      if (!restValidation.ok) {
        setAdd({ ...add, error: `REST URL: ${restValidation.reason ?? 'invalid'}` })
        return
      }
    }
    try {
      await addCustomEndpoint({
        label: add.label.trim(),
        rpc: add.rpc.trim(),
        ...(add.rest.trim() ? { rest: add.rest.trim() } : {}),
      })
      setAdd(emptyAdd())
    } catch (err) {
      setAdd({ ...add, error: err instanceof Error ? err.message : String(err) })
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
                onChange={(e) => setAdd({ ...add, label: e.target.value, error: null })}
                placeholder="My DevNet"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="ep-rpc">RPC URL</Label>
              <Input
                id="ep-rpc"
                value={add.rpc}
                onChange={(e) =>
                  setAdd({ ...add, rpc: e.target.value, error: null, pingResult: null })
                }
                placeholder="https://… or http://localhost:26657"
                className="font-mono text-xs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="ep-rest">REST URL (optional)</Label>
              <Input
                id="ep-rest"
                value={add.rest}
                onChange={(e) => setAdd({ ...add, rest: e.target.value, error: null })}
                placeholder="https://…"
                className="font-mono text-xs"
              />
            </div>
            {add.error && (
              <p className="text-xs text-destructive break-words">{add.error}</p>
            )}
            {add.pingResult && (
              <p className="text-xs text-green-700">
                Reached chain <span className="font-mono">{add.pingResult.chainId}</span> at
                height <span className="font-mono">{add.pingResult.height.toLocaleString()}</span>
              </p>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={add.pinging || !add.rpc}
                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                onClick={onPing}
              >
                {add.pinging ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Testing…
                  </>
                ) : (
                  'Test connection'
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!add.label || !add.rpc || add.pinging}
                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                onClick={onSave}
              >
                Save endpoint
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              HTTPS accepted always; HTTP only for localhost (DevNet). The chain ID is fetched
              over the wire when you click Test connection.
            </p>
          </div>
        </CardContent>
      </Card>

      <VaultEntryManager />
    </main>
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
