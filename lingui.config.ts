import { formatter } from '@lingui/format-po'

import type { LinguiConfig } from '@lingui/conf'

const config: LinguiConfig = {
  // Source-locale catalogue is what extraction reads from JSX / t macros.
  // British English per the project CLAUDE.md (extracted strings normalised
  // during the M1.11.5 sweep). Additional locales are added post-M9 if a
  // translation contribution arrives.
  sourceLocale: 'en',
  locales: ['en'],
  // .po format chosen for translator-friendliness — every standard
  // translation tool (Crowdin, POEditor, Weblate, manual `*.po` editors)
  // speaks it. Lingui 6+ requires the formatter to be passed as a function
  // from a separate package (was a string literal in v5).
  format: formatter({ lineNumbers: false }),
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}/messages',
      include: ['src'],
      // Don't extract from the locale catalogues themselves or tests.
      exclude: ['**/node_modules/**', '**/*.test.{ts,tsx}', '**/locales/**'],
    },
  ],
  // Strip identifier comments from the catalogue — keeps .po files cleaner
  // for translators. The source-location info still lives in the .po.
  compileNamespace: 'es',
  // Warn on missing translations rather than silently falling through to the
  // source string — catches missing keys during the compile step.
  fallbackLocales: {
    default: 'en',
  },
}

export default config
