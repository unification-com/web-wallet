import { Settings as SettingsIcon } from 'lucide-react'

import { AccountSwitcher } from '@/components/AccountSwitcher'
import { EndpointSwitcher } from '@/components/EndpointSwitcher'
import { Button } from '@/components/ui/button'
import { useVaultStore } from '@/lib/vault'

export function Header({
  surface,
  onOpenSettings,
}: {
  surface: 'popup' | 'standalone' | 'web'
  onOpenSettings: () => void
}) {
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
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenSettings}
          className="h-7 w-7"
          title="Settings"
        >
          <SettingsIcon className="h-3.5 w-3.5" />
        </Button>
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
