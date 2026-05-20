import { useActiveEndpoint } from '@/lib/chain'
import { useActiveSigner } from '@/lib/signer'
import { useVaultStore } from '@/lib/vault'

function truncate(addr: string, head = 8, tail = 6): string {
  return addr.length <= head + tail + 3 ? addr : `${addr.slice(0, head)}…${addr.slice(-tail)}`
}

export function Header({ surface }: { surface: 'popup' | 'standalone' | 'web' }) {
  const lock = useVaultStore((s) => s.lock)
  const endpoint = useActiveEndpoint()
  const { address } = useActiveSigner()

  return (
    <header className="flex items-center justify-between gap-2">
      <div className="flex flex-col">
        <h1 className="text-base font-semibold">Unification Wallet</h1>
        <span className="text-[10px] text-gray-400">{surface}</span>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span
          className="px-2 py-0.5 rounded bg-gray-100 text-gray-700"
          title={`${endpoint.label} (${endpoint.source})`}
        >
          {endpoint.label}
        </span>
        {address && (
          <span className="px-2 py-0.5 rounded bg-blue-50 font-mono text-blue-800" title={address}>
            {truncate(address)}
          </span>
        )}
        <button
          type="button"
          onClick={lock}
          className="text-gray-500 hover:text-gray-900 underline"
        >
          Lock
        </button>
      </div>
    </header>
  )
}
