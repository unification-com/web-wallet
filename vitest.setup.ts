// Vitest setup — runs once before any test. Activates the lingui source
// locale so library code that throws `i18n._(msg\`…\`)` errors emits the
// real source string rather than the "no locale set" runtime guard.
//
// Production code activates the locale inside `src/lib/bootstrap.tsx`; tests
// bypass that mount path, so we activate here.
import { i18n } from '@lingui/core'

i18n.activate('en')
