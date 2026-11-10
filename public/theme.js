// Thème clair ou sombre : préférence enregistrée, sinon réglage de l'appareil.
try {
  var t = localStorage.getItem('numera-theme')
  if (t !== 'light' && t !== 'dark') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  document.documentElement.dataset.theme = t
} catch (e) {}
