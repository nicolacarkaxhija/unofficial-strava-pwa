// Anti-FOUC theme bootstrap.
//
// Loaded as a SYNC (render-blocking) script in <head> — deliberately: it must
// set the `dark` class before the first paint or dark-mode users get a white
// flash. It lives in its own file (not inline in index.html) so the CSP can
// drop 'unsafe-inline' from script-src — the whole script-src surface is now
// same-origin files, which an injected inline <script> cannot satisfy.
//
// Default is light; dark only if the user explicitly chose it, or chose
// System and the OS is dark.
;(function () {
  var t = localStorage.getItem('theme')
  if (t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches))
    document.documentElement.classList.add('dark')
})()
