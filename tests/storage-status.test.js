import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeStorage } from '../src/storage-status.js';

test("avertit si le navigateur n'offre pas l'API de stockage", () => {
  const status = describeStorage({ supported: false, persisted: false, standalone: true });
  assert.equal(status.ok, false);
  assert.match(status.message, /aucune donnée/);
});

test("demande l'installation si l'app est ouverte dans Safari", () => {
  const status = describeStorage({ supported: true, persisted: true, standalone: false });
  assert.equal(status.ok, false);
  assert.match(status.message, /écran d'accueil/);
});

test('avertit si le stockage persistant est refusé', () => {
  const status = describeStorage({ supported: true, persisted: false, standalone: true });
  assert.equal(status.ok, false);
  assert.match(status.message, /pourraient être effacées/);
});

test("confirme quand l'app est installée et le stockage persistant", () => {
  const status = describeStorage({ supported: true, persisted: true, standalone: true });
  assert.deepEqual(status, { ok: true, message: 'Stockage persistant accordé.' });
});
