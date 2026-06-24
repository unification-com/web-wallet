import { forwardRef, useId, type InputHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

interface SegmentOption<V extends string> {
  value: V
  label: React.ReactNode
}

interface SegmentedRadioProps<V extends string>
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: V
  onChange: (next: V) => void
  options: readonly SegmentOption<V>[]
  /** Visually-hidden legend for screen readers. */
  label?: string
}

/**
 * A horizontal segmented radio. Each option is an `<input type="radio">`
 * with a `<label>` — fully keyboard-accessible without any Radix dep.
 * Use for small enumerations (2–4 options): theme mode, theme palette,
 * seed-size, ledger-vs-vault.
 */
function SegmentedRadioInner<V extends string>(
  { value, onChange, options, label, className, name, ...rest }: SegmentedRadioProps<V>,
  ref: React.Ref<HTMLFieldSetElement>,
) {
  const fallbackName = useId()
  const groupName = name ?? fallbackName

  return (
    <fieldset
      ref={ref}
      className={cn(
        'inline-flex w-full rounded border border-border bg-surface-sunk p-0.5 text-xs',
        className,
      )}
    >
      {label && <legend className="sr-only">{label}</legend>}
      {options.map((opt) => {
        const id = `${groupName}-${opt.value}`
        const checked = value === opt.value
        return (
          <label
            key={opt.value}
            htmlFor={id}
            className={cn(
              'flex-1 text-center cursor-pointer select-none rounded px-2 py-1.5 transition-colors',
              'focus-within:ring-2 focus-within:ring-ring',
              checked
                ? 'bg-primary text-primary-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground',
              '[.theme-mainframe_&]:font-mono [.theme-mainframe_&]:uppercase [.theme-mainframe_&]:tracking-[0.08em]',
            )}
          >
            <input
              id={id}
              type="radio"
              name={groupName}
              value={opt.value}
              checked={checked}
              onChange={() => onChange(opt.value)}
              className="sr-only"
              {...rest}
            />
            {opt.label}
          </label>
        )
      })}
    </fieldset>
  )
}

// forwardRef + generic component requires this dance — cast back to the
// generic signature so consumers retain inference on `V`.
export const SegmentedRadio = forwardRef(SegmentedRadioInner) as <V extends string>(
  props: SegmentedRadioProps<V> & { ref?: React.Ref<HTMLFieldSetElement> },
) => ReturnType<typeof SegmentedRadioInner>
