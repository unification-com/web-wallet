import { useLingui } from '@lingui/react/macro'
import { ExternalLink, Lock, Settings as SettingsIcon } from 'lucide-react'

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
  const { t } = useLingui()
  const isPopup = surface === 'popup'

  const openInTab = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      void chrome.tabs.create({ url: chrome.runtime.getURL('standalone.html') })
      window.close()
    }
  }

  return (
    <header className="flex items-center justify-between gap-1">
      <div className="flex flex-col min-w-0">
        <h1 className="text-base font-semibold truncate">
          {isPopup ? t`Wallet` : t`Unification Wallet`}
        </h1>
        {!isPopup && (
          <span className="text-[10px] text-muted-foreground">{surface}</span>
        )}
      </div>

      <div className="flex items-center gap-1 text-xs">
        <EndpointSwitcher />
        <AccountSwitcher compact={isPopup} />
        {isPopup && (
          <Button
            variant="ghost"
            size="icon"
            onClick={openInTab}
            className="h-7 w-7"
            title={t`Open in tab`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenSettings}
          className="h-7 w-7"
          title={t`Settings`}
        >
          <SettingsIcon className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={lock}
          className="h-7 w-7"
          title={t`Lock wallet`}
        >
          <Lock className="h-3.5 w-3.5" />
        </Button>
      </div>
    </header>
  )
}
