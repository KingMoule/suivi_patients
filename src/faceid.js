// Déverrouillage biométrique (Touch ID ou Face ID) par passkey (WebAuthn) avec l'extension PRF, qui donne un secret propre à l'iPad.
// Aucun serveur : le défi est local, seul le secret PRF compte.
import { wrapKey, unwrapKey } from './crypto.js';
import { keyOpensVault, getFaceId, saveFaceId } from './vault.js';

const bytes = (n) => crypto.getRandomValues(new Uint8Array(n));

export const faceIdSupported = () => 'PublicKeyCredential' in window;

async function readSecret(credentialId, prfSalt) {
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: bytes(32),
      rpId: location.hostname,
      allowCredentials: [{ type: 'public-key', id: credentialId }],
      userVerification: 'required',
      extensions: { prf: { eval: { first: prfSalt } } },
    },
  });
  return credential.getClientExtensionResults().prf?.results?.first ?? null;
}

// key doit être extractable. Retourne true si le déverrouillage biométrique est activé.
export async function enableFaceId(key) {
  const created = await navigator.credentials.create({
    publicKey: {
      challenge: bytes(32),
      rp: { name: 'Suivi des résidents', id: location.hostname },
      user: { id: bytes(16), name: 'suivi', displayName: 'Suivi' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      extensions: { prf: {} },
    },
  });
  if (!created.getClientExtensionResults().prf?.enabled) return false;

  const credentialId = new Uint8Array(created.rawId);
  const prfSalt = bytes(32);
  const secret = await readSecret(credentialId, prfSalt);
  if (!secret) return false;

  await saveFaceId({ credentialId, prfSalt, wrapped: await wrapKey(secret, key) });
  return true;
}

// Retourne la clé, ou null si le déverrouillage biométrique est annulé ou ne mène à rien.
export async function unlockWithFaceId() {
  const record = await getFaceId();
  if (!record) return null;
  try {
    const secret = await readSecret(record.credentialId, record.prfSalt);
    if (!secret) return null;
    const key = await unwrapKey(secret, record.wrapped);
    return (await keyOpensVault(key)) ? key : null;
  } catch {
    return null; // annulé par l'utilisateur ou refusé
  }
}
