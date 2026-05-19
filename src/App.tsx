import { useState } from 'react'
import { GlobalDecoderRegistry } from '@unification-com/fundjs-react'
import { ENDPOINTS, useChainInfo, type ChainEndpoint } from '@/lib/chain'
import { cn } from '@/lib/utils'

type Surface = 'popup' | 'standalone' | 'web'

// Smoke indicator: number of Msg / query / event types fundjs-react has registered.
// Useful as a "the bindings are loaded" canary; replaced with real chain-aware UI in M1+.
const REGISTERED_TYPE_COUNT = GlobalDecoderRegistry.existingTypeUrls.length

export function App({ surface }: { surface: Surface }) {
  const [endpointId, setEndpointId] = useState<ChainEndpoint['id']>('mainnet')
  const endpoint = ENDPOINTS[endpointId]
  const { data, isLoading, isError, error } = useChainInfo(endpoint)

  return (
    <main
      className={cn(
        'p-4 flex flex-col gap-4',
        surface === 'popup' ? 'w-[360px]' : 'w-full max-w-2xl mx-auto',
      )}
    >
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Unification Web Wallet</h1>
        <span className="text-xs text-gray-500">{surface}</span>
      </header>

      <section className="border rounded p-3 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="endpoint">Network:</label>
          <select
            id="endpoint"
            value={endpointId}
            onChange={(e) => setEndpointId(e.target.value as ChainEndpoint['id'])}
            className="border rounded px-2 py-1"
          >
            {Object.values(ENDPOINTS).map((e) => (
              <option key={e.id} value={e.id}>{e.label}</option>
            ))}
          </select>
        </div>

        {isLoading && <p className="text-sm text-gray-500">Connecting to {endpoint.label}…</p>}
        {isError && (
          <p className="text-sm text-red-600">
            Failed to connect: {error instanceof Error ? error.message : String(error)}
          </p>
        )}
        {data && (
          <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-gray-500">Chain ID</dt>
            <dd className="font-mono">{data.chainId}</dd>
            <dt className="text-gray-500">Height</dt>
            <dd className="font-mono">{data.height.toLocaleString()}</dd>
            <dt className="text-gray-500">RPC</dt>
            <dd className="font-mono truncate" title={data.rpc}>{data.rpc}</dd>
          </dl>
        )}
      </section>

      <p className="text-xs text-gray-400">
        v2 scaffold — M0. fundjs-react registry: {REGISTERED_TYPE_COUNT} types. Vault, signing, and Tx flows arrive in M1+.
      </p>
    </main>
  )
}
