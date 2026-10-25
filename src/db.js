// Accès minimal à IndexedDB : une table clé-valeur. Les valeurs sont déjà chiffrées.
const DB_NAME = 'suivi';
const STORE = 'kv';

function open() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run(mode, action) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const request = action(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

export function get(key) {
  return run('readonly', (store) => store.get(key));
}

export function set(key, value) {
  return run('readwrite', (store) => store.put(value, key));
}
