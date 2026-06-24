import { i18n } from '@lingui/core'

import { messages as enMessages } from '../locales/en/messages.po'

/**
 * The shared lingui i18n instance for the wallet. Mounted into the React
 * tree via `<I18nProvider>` in `bootstrap.tsx` so every `<Trans>` and
 * `t`/`msg` macro in component trees resolves against this one instance.
 *
 * Source locale + only-shipped locale at M1.11 close: `en` (British
 * English per project CLAUDE.md). Additional locales arrive post-M9 when
 * a translation contribution is accepted; loading them switches to a
 * dynamic `import()` of the compiled catalogue.
 *
 * **Catalogue loading is REQUIRED even for the source locale** (counter-
 * intuitive but lingui v6 compiles `<Trans>` macros to short hash IDs by
 * default — e.g. `<Trans>Unlock wallet</Trans>` becomes `t("MnJfki")` at
 * build time; without `i18n.load(en, messages)`, the runtime returns the
 * hash rather than the source string and the UI shows garbled IDs). The
 * `.po` import is transformed by `@lingui/vite-plugin` so this resolves at
 * build time; no need to run `lingui:compile` separately.
 *
 * Locale detection from `chrome.i18n.getUILanguage()` is intentionally
 * deferred until a non-English locale exists to detect — captured in the
 * M1 deferral catalogue (D5).
 */

const DEFAULT_LOCALE = 'en'

/**
 * Activate a locale. At M1.11 close only `'en'` is valid; loading the
 * compiled catalogue is what makes `<Trans>` macros resolve to their
 * source text. Once a translated locale exists, this gains a dynamic-
 * import branch for that locale's compiled catalogue.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- async-by-design; see comment below
export async function activateLocale(locale: string = DEFAULT_LOCALE): Promise<void> {
  if (locale === DEFAULT_LOCALE) {
    i18n.load(DEFAULT_LOCALE, enMessages)
    i18n.activate(DEFAULT_LOCALE)
    return
  }
  // Future: dynamic-import the compiled catalogue for `locale` once one exists.
  // const { messages } = await import(`../locales/${locale}/messages.po`) as { messages: Messages }
  // i18n.load(locale, messages)
  // i18n.activate(locale)
  throw new Error(`unsupported locale: ${locale} (only 'en' is shipped at M1.11)`)
}

export { i18n }
