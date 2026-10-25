import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveKey, encrypt, decrypt, randomSalt, wrapKey, unwrapKey } from '../src/crypto.js';

// Donnée manifestement fictive.
const SAMPLE = { name: 'Test Fictif', room: '000' };

test('déchiffre ce qui a été chiffré avec la même phrase de passe', async () => {
  const salt = randomSalt();
  const key = await deriveKey('phrase de test fictive', salt);
  const sameKey = await deriveKey('phrase de test fictive', salt);
  assert.deepEqual(await decrypt(sameKey, await encrypt(key, SAMPLE)), SAMPLE);
});

test('refuse de déchiffrer avec une autre phrase de passe', async () => {
  const salt = randomSalt();
  const key = await deriveKey('phrase de test fictive', salt);
  const wrongKey = await deriveKey('autre phrase fictive', salt);
  await assert.rejects(decrypt(wrongKey, await encrypt(key, SAMPLE)));
});

test('refuse des données chiffrées modifiées', async () => {
  const key = await deriveKey('phrase de test fictive', randomSalt());
  const sealed = await encrypt(key, SAMPLE);
  new Uint8Array(sealed.data)[0] ^= 1;
  await assert.rejects(decrypt(key, sealed));
});

test('ne laisse pas le texte en clair dans les données chiffrées', async () => {
  const key = await deriveKey('phrase de test fictive', randomSalt());
  const sealed = await encrypt(key, SAMPLE);
  assert.ok(!new TextDecoder().decode(sealed.data).includes('Fictif'));
});

test('utilise un vecteur différent à chaque chiffrement', async () => {
  const key = await deriveKey('phrase de test fictive', randomSalt());
  const first = await encrypt(key, SAMPLE);
  const second = await encrypt(key, SAMPLE);
  assert.notDeepEqual(first.iv, second.iv);
});

test('la clé ne peut pas être exportée', async () => {
  const key = await deriveKey('phrase de test fictive', randomSalt());
  assert.equal(key.extractable, false);
  await assert.rejects(crypto.subtle.exportKey('raw', key));
});

test('Face ID : la clé enveloppée se retrouve avec le même secret', async () => {
  const salt = randomSalt();
  const key = await deriveKey('phrase de test fictive', salt, true);
  const secret = crypto.getRandomValues(new Uint8Array(32));
  const restored = await unwrapKey(secret, await wrapKey(secret, key));
  const sealed = await encrypt(key, SAMPLE);
  assert.deepEqual(await decrypt(restored, sealed), SAMPLE);
  assert.equal(restored.extractable, false);
});

test('Face ID : un autre secret ne déverrouille pas la clé', async () => {
  const key = await deriveKey('phrase de test fictive', randomSalt(), true);
  const wrapped = await wrapKey(crypto.getRandomValues(new Uint8Array(32)), key);
  await assert.rejects(unwrapKey(crypto.getRandomValues(new Uint8Array(32)), wrapped));
});
