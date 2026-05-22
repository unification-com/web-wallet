import { Trans, useLingui } from '@lingui/react/macro'

import { Card, CardContent } from '@/components/ui/card'
import { SegmentedRadio } from '@/components/ui/segmented'
import type { ThemeMode, ThemePalette } from '@/lib/hooks/useTheme'
import { useVaultStore } from '@/lib/vault'

/**
 * Settings → Appearance section.
 *
 * Drop this near the top of <Settings/> body (above the existing sections).
 * Reads + writes from `vault.preferences.themeMode` / `themePalette`.
 *
 * Two new vault-store actions are required (engineering work outside this
 * file): `setThemeMode(mode: ThemeMode)` and `setThemePalette(p: ThemePalette)`.
 * Both write through to the encrypted vault blob so prefs persist.
 */
export function AppearanceSettings() {
  const { t } = useLingui()
  const mode    = useVaultStore((s) => (s.vault?.preferences.themeMode    ?? 'dark'))
  const palette = useVaultStore((s) => (s.vault?.preferences.themePalette ?? 'cosmos'))
  const setMode    = useVaultStore((s) => s.setThemeMode)
  const setPalette = useVaultStore((s) => s.setThemePalette)

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <h2 className="text-sm font-semibold tracking-tight">
          <Trans>Appearance</Trans>
        </h2>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-xs text-muted-foreground">
            <Trans>Mode</Trans>
          </legend>
          <SegmentedRadio<ThemeMode>
            value={mode}
            onChange={(v) => void setMode(v)}
            label={t`Theme mode`}
            options={[
              { value: 'system', label: t`System` },
              { value: 'light',  label: t`Light`  },
              { value: 'dark',   label: t`Dark`   },
            ]}
          />
        </fieldset>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-xs text-muted-foreground">
            <Trans>Theme</Trans>
          </legend>
          <SegmentedRadio<ThemePalette>
            value={palette}
            onChange={(v) => void setPalette(v)}
            label={t`Theme palette`}
            options={[
              { value: 'cosmos',    label: t`Cosmos`    },
              { value: 'mainframe', label: t`Mainframe` },
            ]}
          />
          <p className="text-[11px] text-muted-foreground leading-snug pt-1">
            <Trans>
              Cosmos is the default — refined, soft, brand-blue. Mainframe is an industrial
              terminal-style alternate; same wallet, denser visual rhythm.
            </Trans>
          </p>
        </fieldset>
      </CardContent>
    </Card>
  )
}
