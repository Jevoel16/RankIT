// Applies the saved or system theme before React renders to avoid a flash of the wrong theme.
(function () {
  var preference = 'system';
  try {
    preference = localStorage.getItem('rankit_theme') || 'system';
  } catch (e) {
    /* storage unavailable */
  }
  var prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  var resolved = preference === 'system' ? (prefersLight ? 'light' : 'dark') : preference;
  document.documentElement.setAttribute('data-theme', resolved === 'light' ? 'light' : 'dark');
})();
