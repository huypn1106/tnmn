// Safe pass-through Service Worker to satisfy Chrome PWA installability requirements
// without causing caching or stale bundle hash conflicts during updates.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // A fetch event listener is required for Chrome's PWA installability.
  // Keeping it empty allows the browser to perform standard network fetches,
  // preventing stale assets or dynamic import issues when build hashes change.
});
