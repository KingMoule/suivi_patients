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

// Retourne la clé, ou null si la phrase de passe est incorrecte.
export async function unlockVault(passphrase) {
  const meta = await db.get('meta');
  const key = await deriveKey(passphrase, meta.salt);
  try {
    await decrypt(key, meta.check);
    return key;
  } catch {
    return null;
  }
}
