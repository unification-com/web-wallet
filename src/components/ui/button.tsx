/* eslint-disable react-refresh/only-export-components -- shadcn pattern: buttonVariants
   co-located with Button for ergonomic re-use on non-button elements (e.g. Link). */
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type ButtonHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

// Mainframe-only label treatment is applied via `:where(.theme-mainframe &)`
// in the base classes — no per-variant branching needed. See DESIGN.md
// "Component variants changed → Button" for the rationale.
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded',
    'text-sm font-medium ring-offset-background transition-[background,color,box-shadow] duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    // Mainframe theme: uppercase + mono + tracked. Body remains intact.
    '[.theme-mainframe_&]:font-mono [.theme-mainframe_&]:uppercase [.theme-mainframe_&]:tracking-[0.10em] [.theme-mainframe_&]:font-semibold',
  ].join(' '),
  {
    variants: {
      variant: {
        // PRIMARY CTA — default screen action. Cosmos: solid primary with
        // a soft elevation lift on hover. Mainframe: same fill, no lift.
        default:
          'bg-primary text-primary-foreground hover:bg-primary/90 [&:not(.theme-mainframe_*)]:shadow-sm hover:[&:not(.theme-mainframe_*)]:shadow',
        // BRAND — same fill as default + gold edge highlight on hover.
        // Reserve for the single most-important CTA per screen.
        brand:
          'bg-primary text-primary-foreground hover:bg-primary/90 relative overflow-hidden ' +
          'before:absolute before:inset-y-0 before:right-0 before:w-1 before:bg-accent before:opacity-0 hover:before:opacity-100 before:transition-opacity',
        // Existing variants reused with new tokens
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        'destructive-outline':
          'border border-destructive/60 bg-transparent text-destructive hover:bg-destructive/10',
        success:
          'bg-success text-success-foreground hover:bg-success/90',
        outline:
          'border border-input bg-background hover:bg-secondary hover:text-secondary-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost:
          'text-muted-foreground hover:bg-secondary hover:text-foreground',
        link:
          'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-10 px-6',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  },
)
Button.displayName = 'Button'

export { buttonVariants }
