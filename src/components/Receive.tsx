import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useActiveSigner } from '@/lib/signer'

/**
 * Compact Receive surface — shows the active signer's bech32 address with
 * a copy-to-clipboard button. QR display is a follow-up M1.10c polish item.
 */
export function Receive() {
  const { address } = useActiveSigner()
  const [copied, setCopied] = useState(false)

  if (!address) return null

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('[Receive] clipboard write failed', err)
    }
  }

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Receive</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2 flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">
          Share this address to receive FUND. Anyone with the address can send to it; the
          private key never leaves your vault.
        </p>
        <div className="font-mono text-xs break-all rounded border bg-muted p-2">
          {address}
        </div>
        <Button
          variant="outline"
          size="sm"
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          onClick={onCopy}
          className="self-start"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy address</span>
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
