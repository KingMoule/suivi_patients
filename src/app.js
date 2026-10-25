import { describeStorage } from './storage-status.js';

async function checkStorage() {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const supported = Boolean(navigator.storage && navigator.storage.persist);

  let persisted = false;
  if (supported) {
    persisted = await navigator.storage.persisted();
    if (!persisted) {
      // Safari décide selon ses heuristiques ; l'app installée est le cas favorable.
      persisted = await navigator.storage.persist();
    }
  }

  const status = describeStorage({ supported, persisted, standalone });
  const element = document.getElementById('storage-status');
  element.textContent = status.message;
  element.className = status.ok ? 'status ok' : 'status warning';
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

checkStorage();
