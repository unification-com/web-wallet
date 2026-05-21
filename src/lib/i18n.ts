import { i18n } from '@lingui/core'

/**
 * The shared lingui i18n instance for the wallet. Mounted into the React
 * tree via `<I18nProvider>` in `bootstrap.tsx` so every `<Trans>` and
 * `t`/`msg` macro in component trees resolves against this one instance.
 *
 * Source locale + only-shipped locale at M1.11 close: `en` (British
 * English per project CLAUDE.md). Additional locales arrive post-M9 when a
 * translation contribution is accepted; loading them switches to a dynamic
 * `import()` of the compiled catalogue.
 *
 * Locale detection from `chrome.i18n.getUILanguage()` is intentionally
 * deferred until a non-English locale exists to detect — captured in the
 * M1 deferral catalogue (D5).
 */

const DEFAULT_LOCALE = 'en'

/**
 * Activate a locale. At M1.11 close only `'en'` is valid and the source-
 * locale fall-through means no catalogue load is needed. Once a translated
 * locale exists, this fetches its compiled catalogue and registers it.
 */
// Signature is intentionally async even though the source-locale branch is
// synchronous today — once a translated locale ships, it'll dynamic-import
// the compiled catalogue and we don't want to ripple-update every caller.
// eslint-disable-next-line @typescript-eslint/require-await -- async-by-design; see comment above
export async function activateLocale(locale: string = DEFAULT_LOCALE): Promise<void> {
  if (locale === DEFAULT_LOCALE) {
    // Source-locale: Trans/t macros render the source string verbatim, so
    // we don't need to load anything. Just mark the locale active so
    // `i18n.locale` reads correctly for any code that branches on it.
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
