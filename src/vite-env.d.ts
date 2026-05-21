/// <reference types="vite/client" />

// `@lingui/vite-plugin` transforms `.po` imports at build time into a
// compiled-catalogue module with a `messages` export. Without this
// declaration, tsc has no way of knowing about the transform and fails
// the import. The runtime type matches what `lingui compile --typescript`
// emits for `.ts` outputs.
declare module '*.po' {
  import type { Messages } from '@lingui/core'
  export const messages: Messages
}
