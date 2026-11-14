// This polyfill's UMD build exposes globalThis.temporal (lowercase
// namespace), not the spec's actual `Temporal` global — promote it so
// providers.js/popup.js can use `Temporal.*` directly. A no-op once
// browsers ship Temporal natively (globalThis.Temporal would already
// exist and this vendor file wouldn't be needed at all).
//
// This lives in its own file, not an inline <script> in popup.html,
// because Manifest V3's extension CSP (`script-src 'self'`) refuses to run
// inline scripts — inline, it silently never ran and every conversion
// failed with "Temporal is not defined".
window.Temporal = window.Temporal || window.temporal.Temporal;
