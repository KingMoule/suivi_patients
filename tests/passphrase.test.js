import { test } from 'node:test';
import assert from 'node:assert/strict';
import { passphraseError } from '../src/passphrase.js';

test('refuse une phrase de passe trop courte', () => {
  assert.match(passphraseError('court', 'court'), /au moins 12/);
});

test('refuse si la confirmation ne correspond pas', () => {
  assert.match(passphraseError('phrase assez longue', 'phrase differente'), /ne correspondent pas/);
});

test('accepte une phrase de passe longue et confirmée', () => {
  assert.equal(passphraseError('phrase assez longue', 'phrase assez longue'), null);
});
