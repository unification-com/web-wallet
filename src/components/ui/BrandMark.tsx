import { forwardRef, type ImgHTMLAttributes } from 'react'

import iconUrl from '@/assets/brand/unification_icon_128.png'
import { cn } from '@/lib/utils'

/**
 * Unification brand mark.
 *
 * Renders the canonical white-wireframe-Unification-Z on the brand-blue
 * tile — the same mark used as the Chrome extension's install icon
 * (`public/icons/{19,38,48,128}.png`). Vendored at
 * `src/assets/brand/unification_icon_128.png` so the bundler hashes the
 * asset; the 128 px source downscales cleanly to header / splash sizes
 * (28-48 px) without the funky aliasing the intricate full-fractal SVG
 * suffered when squashed to icon scale.
 *
 * Stays brand-blue across all four palette × mode combinations — the brand
 * mark IS the wallet's identity; the rest of the UI's theme tokens swap
 * around it.
 */
export const BrandMark = forwardRef<HTMLImageElement, ImgHTMLAttributes<HTMLImageElement>>(
  ({ className, alt, ...props }, ref) => (
    <img
      ref={ref}
      src={iconUrl}
      alt={alt ?? ''}
      aria-hidden={alt === undefined || alt === ''}
      className={cn('object-contain', className)}
      {...props}
    />
  ),
)
BrandMark.displayName = 'BrandMark'
