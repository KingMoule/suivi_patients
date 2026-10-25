import { describeStorage } from './storage-status.js';
import { passphraseError } from './passphrase.js';
import { hasVault, createVault, unlockVault, getFaceId } from './vault.js';
import { openDashboard, closeDashboard } from './ui.js';
import { faceIdSupported, enableFaceId, unlockWithFaceId } from './faceid.js';

const LOCK_AFTER_MS = 5 * 60 * 1000; // verrouillage après 5 minutes sans toucher l'écran

let key = null; // clé de chiffrement, en mémoire seulement pendant que l'app est déverrouillée
let lockTimer;

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
  element.hidden = status.ok; // rien à signaler quand le stockage est protégé
}

function show(screen) {
  for (const id of ['setup', 'unlock', 'main']) {
    document.getElementById(id).hidden = id !== screen;
  }
}

async function showUnlock() {
  show('unlock');
  document.getElementById('faceid-unlock').hidden = !(faceIdSupported() && (await getFaceId()));
}

function lock() {
  key = null;
  closeDashboard();
  clearTimeout(lockTimer);
  showUnlock();
}

function resetLockTimer() {
  if (!key) return;
  clearTimeout(lockTimer);
  lockTimer = setTimeout(lock, LOCK_AFTER_MS);
}

async function open(newKey) {
  key = newKey;
  show('main');
  resetLockTimer();
  await openDashboard(newKey, lock);
  document.getElementById('faceid-setup').hidden = !faceIdSupported() || Boolean(await getFaceId());
}

// Lit les champs du formulaire, puis les vide pour ne pas garder la phrase de passe à l'écran.
function takeValues(form) {
  const values = Object.fromEntries(new FormData(form));
  form.reset();
  return values;
}

async function handleSetup(event) {
  event.preventDefault();
  const form = event.target;
  const { passphrase, confirmation } = takeValues(form);
  const error = passphraseError(passphrase, confirmation);
  form.querySelector('.error').textContent = error ?? '';
  if (error) return;
  form.querySelector('button').disabled = true;
  open(await createVault(passphrase));
}

async function handleUnlock(event) {
  event.preventDefault();
  const form = event.target;
  const button = form.querySelector('button');
  const { passphrase } = takeValues(form);
  button.disabled = true;
  const newKey = await unlockVault(passphrase);
  button.disabled = false;
  form.querySelector('.error').textContent = newKey ? '' : 'Phrase de passe incorrecte.';
  if (newKey) open(newKey);
}

async function handleFaceIdSetup(event) {
  event.preventDefault();
  const form = event.target;
  const error = form.querySelector('.error');
  const { passphrase } = takeValues(form);
  error.textContent = '';
  // Clé exportable seulement le temps de l'envelopper ; la clé de la session reste inexportable.
  const exportable = await unlockVault(passphrase, true);
  if (!exportable) {
    error.textContent = 'Phrase de passe incorrecte.';
    return;
  }
  try {
    const enabled = await enableFaceId(exportable);
    if (enabled) form.hidden = true;
    else error.textContent = "Cet iPad ne permet pas le déverrouillage biométrique avec l'app.";
  } catch {
    error.textContent = 'Déverrouillage biométrique annulé.';
  }
}

async function handleFaceIdUnlock() {
  const newKey = await unlockWithFaceId();
  document.querySelector('#unlock .error').textContent = newKey ? '' : 'Le déverrouillage biométrique a échoué : utilisez la phrase de passe.';
  if (newKey) open(newKey);
}

document.getElementById('setup').addEventListener('submit', handleSetup);
document.getElementById('unlock').addEventListener('submit', handleUnlock);
document.getElementById('faceid-setup').addEventListener('submit', handleFaceIdSetup);
document.getElementById('faceid-unlock').addEventListener('click', handleFaceIdUnlock);

// Verrouiller dès que l'app passe en arrière-plan.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && key) lock();
});
document.addEventListener('pointerdown', resetLockTimer);
document.addEventListener('keydown', resetLockTimer);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

checkStorage();
if (await hasVault()) await showUnlock();
else show('setup');
