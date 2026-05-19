// MV3 service worker. Minimal stub for M0; popup ↔ standalone reconciliation
// (chrome.runtime.connect ports for vault unlock state) lands in M1.

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[service-worker] installed', details.reason)
})

export {}
