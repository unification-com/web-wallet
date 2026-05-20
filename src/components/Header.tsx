import { AccountSwitcher } from '@/components/AccountSwitcher'
import { EndpointSwitcher } from '@/components/EndpointSwitcher'
import { useVaultStore } from '@/lib/vault'

export function Header({ surface }: { surface: 'popup' | 'standalone' | 'web' }) {
  const lock = useVaultStore((s) => s.lock)

  return (
    <header className="flex items-center justify-between gap-2">
      <div className="flex flex-col">
        <h1 className="text-base font-semibold">Unification Wallet</h1>
        <span className="text-[10px] text-gray-400">{surface}</span>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <EndpointSwitcher />
        <AccountSwitcher />
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
