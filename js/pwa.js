/**
 * PWA — service worker registration and install prompt.
 */
(() => {
  // --- Service Worker Registration ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').then((reg) => {
        // Check for updates periodically (every 60 min)
        setInterval(() => reg.update(), 60 * 60 * 1000);

        // Notify user when a new version is ready
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
              // New version available — show a non-intrusive toast
              if (typeof App !== 'undefined' && App.showToast) {
                App.showToast('Update available — refresh to get the latest version');
              }
            }
          });
        });
      }).catch((err) => {
        console.warn('SW registration failed:', err);
      });
    });
  }

  // --- Install Prompt ---
  let deferredPrompt = null;
  const DISMISS_KEY = 'fsrs_pwa_dismissed';

  const banner = document.getElementById('pwa-install-banner');
  const installBtn = document.getElementById('pwa-install-btn');
  const dismissBtn = document.getElementById('pwa-dismiss-btn');

  // Listen for the browser's install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // Only show banner if user hasn't dismissed it recently (7 days)
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) {
      return;
    }

    if (banner) banner.classList.remove('hidden');
  });

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (banner) banner.classList.add('hidden');
      if (result.outcome === 'accepted') {
        localStorage.removeItem(DISMISS_KEY);
      }
    });
  }

  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      if (banner) banner.classList.add('hidden');
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
    });
  }

  // Hide banner if app was installed
  window.addEventListener('appinstalled', () => {
    if (banner) banner.classList.add('hidden');
    deferredPrompt = null;
  });
})();
