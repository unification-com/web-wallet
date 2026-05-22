import { forwardRef, type HTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * `inset` swaps the card fill for `bg-surface-sunk` and drops the
   * elevated shadow — used for read-only inset content (mnemonic grids,
   * receipt rows, code blocks). Default cards still use `bg-card` with
   * the theme's `shadow-elevated`.
   */
  inset?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, inset = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded border text-card-foreground',
        inset
          ? 'bg-surface-sunk border-border'
          : 'bg-card border-border [&:not(.theme-mainframe_*)]:shadow-[var(--shadow-elevated)]',
        className,
      )}
      {...props}
    />
  ),
)
Card.displayName = 'Card'

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-1.5 p-4', className)} {...props} />
  ),
)
CardHeader.displayName = 'CardHeader'

export const CardTitle = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'text-base font-semibold leading-tight tracking-tight',
        // Mainframe: titles become tracked + uppercase mono. Cosmos: untouched.
        '[.theme-mainframe_&]:font-mono [.theme-mainframe_&]:uppercase [.theme-mainframe_&]:tracking-[0.06em]',
        className,
      )}
      {...props}
    />
  ),
)
CardTitle.displayName = 'CardTitle'

export const CardDescription = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('text-xs text-muted-foreground', className)} {...props} />
  ),
)
CardDescription.displayName = 'CardDescription'

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-4 pt-0', className)} {...props} />
  ),
)
CardContent.displayName = 'CardContent'

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-4 pt-0', className)} {...props} />
  ),
)
CardFooter.displayName = 'CardFooter'
