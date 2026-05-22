import { forwardRef, type SVGAttributes } from 'react'

import { cn } from '@/lib/utils'

/**
 * Unification brand mark.
 *
 * Placeholder geometry: a ring + orbital arc + planet dot, evoking the
 * "universe" motif from unification.com. Swap to the canonical brand SVG
 * once a vector asset is dropped into `src/assets/brand/und-mark.svg`
 * (this component's render is the only spot to change).
 *
 * Inherits `currentColor` so it adopts whatever text-* class is applied —
 * use `text-primary` in headers, `text-foreground` in unlock-splash, etc.
 */
export const BrandMark = forwardRef<SVGSVGElement, SVGAttributes<SVGSVGElement>>(
  ({ className, ...props }, ref) => (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={cn('text-primary', className)}
      {...props}
    >
      {/* outer ring — subtle */}
      <circle cx="12" cy="12" r="10.5" stroke="currentColor" strokeWidth="1" opacity="0.35" />
      {/* the "U" — orbital arc opening downward */}
      <path
        d="M5.5 7 V12.5 a6.5 6.5 0 0 0 13 0 V7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* core planet */}
      <circle cx="12" cy="12.5" r="1.8" fill="currentColor" />
    </svg>
  ),
)
BrandMark.displayName = 'BrandMark'
