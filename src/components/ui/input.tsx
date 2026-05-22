import { forwardRef, type InputHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        // Sunk surface so inputs read as "into the card", not "another card".
        // border-input → focused state recolours border via ring.
        'flex h-9 w-full rounded border border-input bg-surface-sunk px-3 py-1 text-sm transition-colors',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
        'placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50',
        // Mainframe: mono input text. Amount + address fields will inherit
        // this automatically; engineering can opt-in with className="font-mono"
        // on Cosmos to match.
        '[.theme-mainframe_&]:font-mono',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'
