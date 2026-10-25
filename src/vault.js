// Coffre : sel et valeur témoin chiffrée, pour vérifier la phrase de passe au déverrouillage.
import { deriveKey, encrypt, decrypt, randomSalt } from './crypto.js';
import * as db from './db.js';

const CHECK = { app: 'suivi_patients' };

export async function hasVault() {
  return (await db.get('meta')) !== undefined;
}

export async function createVault(passphrase) {
  const salt = randomSalt();
  const key = await deriveKey(passphrase, salt);
  await db.set('meta', { salt, check: await encrypt(key, CHECK) });
  return key;
}

// Retourne true si la clé ouvre le coffre.
export async function keyOpensVault(key) {
  const meta = await db.get('meta');
  try {
    await decrypt(key, meta.check);
    return true;
  } catch {
    return false;
  }
}

// Retourne la clé, ou null si la phrase de passe est incorrecte.
// extractable = true seulement pour activer Face ID, qui doit envelopper la clé.
export async function unlockVault(passphrase, extractable = false) {
  const meta = await db.get('meta');
  const key = await deriveKey(passphrase, meta.salt, extractable);
  return (await keyOpensVault(key)) ? key : null;
}

export const getFaceId = () => db.get('faceid');
export const saveFaceId = (record) => db.set('faceid', record);
