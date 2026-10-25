// Sauvegarde : un fichier JSON dont le contenu est chiffré avec une phrase de passe choisie à l'export.
// Le fichier ne contient ni la clé de l'app ni aucun texte en clair, seulement le sel, le vecteur et les données chiffrées.
import { deriveKey, encrypt, decrypt, randomSalt } from './crypto.js';

const FORMAT = 'suivi_patients-sauvegarde';
const VERSION = 1;

function toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

// Vérifie la forme minimale dont l'app a besoin, pour ne pas planter sur un fichier inattendu.
function isValidData(data) {
  return (
    Array.isArray(data?.sites) && data.sites.length > 0 && data.sites.every((s) => typeof s?.id === 'string') &&
    Array.isArray(data.units) && data.units.every((u) => typeof u?.id === 'string' && typeof u.siteId === 'string') &&
    Array.isArray(data.residents) && data.residents.every((r) =>
      typeof r?.id === 'string' && typeof r.unitId === 'string' &&
      Array.isArray(r.problems) && Array.isArray(r.followUps))
  );
}

export async function createBackup(data, passphrase) {
  const salt = randomSalt();
  const { iv, data: sealed } = await encrypt(await deriveKey(passphrase, salt), data);
  return JSON.stringify({
    format: FORMAT,
    version: VERSION,
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(sealed)),
  });
}

// Échoue, sans détail, si le fichier est invalide ou si la phrase de passe est incorrecte.
export async function readBackup(text, passphrase) {
  let file;
  try {
    file = JSON.parse(text);
  } catch {
    throw new Error('Sauvegarde invalide');
  }
  if (file?.format !== FORMAT || file.version !== VERSION) throw new Error('Sauvegarde invalide');
  const key = await deriveKey(passphrase, fromBase64(file.salt));
  const data = await decrypt(key, { iv: fromBase64(file.iv), data: fromBase64(file.data) });
  if (!isValidData(data)) throw new Error('Sauvegarde invalide');
  return data;
}
