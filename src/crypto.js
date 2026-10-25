// Chiffrement des données avec l'API Web Crypto (présente dans Safari et dans Node).
// La clé est tirée de la phrase de passe et n'est jamais enregistrée ni exportable.

const ITERATIONS = 600000; // PBKDF2-SHA256, valeur recommandée par l'OWASP
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function randomSalt() {
  return crypto.getRandomValues(new Uint8Array(16));
}

export async function deriveKey(passphrase, salt, extractable = false) {
  const material = await crypto.subtle.importKey(
    'raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    extractable,
    ['encrypt', 'decrypt']
  );
}

export async function encrypt(key, value) {
  // Un vecteur d'initialisation neuf à chaque chiffrement, exigence d'AES-GCM.
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(value))
  );
  return { iv, data };
}

// Échoue si la clé est mauvaise ou si les données ont été modifiées.
export async function decrypt(key, { iv, data }) {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return JSON.parse(decoder.decode(plain));
}

// Face ID : la clé de données est enveloppée par une clé tirée du secret de la passkey (PRF).
// Sans le secret, que seul l'iPad donne après Face ID, l'enveloppe est inutilisable.
async function wrappingKey(secret) {
  const material = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: encoder.encode('suivi_patients faceid') },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// La clé doit avoir été dérivée avec extractable = true.
export async function wrapKey(secret, key) {
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', key));
  return encrypt(await wrappingKey(secret), Array.from(raw));
}

export async function unwrapKey(secret, wrapped) {
  const raw = new Uint8Array(await decrypt(await wrappingKey(secret), wrapped));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
