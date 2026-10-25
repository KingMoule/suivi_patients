import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBackup, readBackup } from '../src/backup.js';
import { emptyData, addUnit, addResident, backupReminder } from '../src/model.js';

const PASSPHRASE = 'phrase de test fictive';

// Données manifestement fictives.
function fakeData() {
  const data = emptyData();
  const unit = addUnit(data, 'soulanges', 'Unité test');
  const resident = addResident(data, unit.id);
  Object.assign(resident, { room: '1', fullName: 'Test Fictif', ramq: 'XXXX 0000 0000' });
  return data;
}

test('une sauvegarde se restaure à l’identique avec la bonne phrase de passe', async () => {
  const data = fakeData();
  assert.deepEqual(await readBackup(await createBackup(data, PASSPHRASE), PASSPHRASE), data);
});

test('le fichier ne contient aucun texte en clair', async () => {
  const text = await createBackup(fakeData(), PASSPHRASE);
  for (const secret of ['Fictif', 'XXXX', 'Unité test', 'Soulanges', PASSPHRASE]) {
    assert.ok(!text.includes(secret), secret);
  }
});

test('refuse une mauvaise phrase de passe', async () => {
  const text = await createBackup(fakeData(), PASSPHRASE);
  await assert.rejects(readBackup(text, 'autre phrase fictive'));
});

test('refuse un fichier modifié', async () => {
  const file = JSON.parse(await createBackup(fakeData(), PASSPHRASE));
  file.data = file.data.replace(/^./, (c) => (c === 'A' ? 'B' : 'A'));
  await assert.rejects(readBackup(JSON.stringify(file), PASSPHRASE));
});

test("refuse un fichier qui n'est pas une sauvegarde", async () => {
  await assert.rejects(readBackup('pas du JSON', PASSPHRASE), /invalide/);
  await assert.rejects(readBackup('{"format":"autre","version":1}', PASSPHRASE), /invalide/);
});

test('refuse des données chiffrées dont la forme est inattendue', async () => {
  const text = await createBackup({ sites: [], units: [], residents: [] }, PASSPHRASE);
  await assert.rejects(readBackup(text, PASSPHRASE), /invalide/);
  const broken = fakeData();
  delete broken.residents[0].followUps;
  await assert.rejects(readBackup(await createBackup(broken, PASSPHRASE), PASSPHRASE), /invalide/);
});

test('deux sauvegardes des mêmes données diffèrent (sel et vecteur neufs)', async () => {
  const data = fakeData();
  assert.notEqual(await createBackup(data, PASSPHRASE), await createBackup(data, PASSPHRASE));
});

test('rappel : rien sans résident, puis selon la date de la dernière sauvegarde', () => {
  const today = '2030-06-15';
  assert.equal(backupReminder(undefined, today, false), null);
  assert.match(backupReminder(undefined, today, true), /Aucune sauvegarde/);
  assert.match(backupReminder('2030-06-07', today, true), /plus de 7 jours/);
  assert.equal(backupReminder('2030-06-08', today, true), null);
  assert.equal(backupReminder('2030-06-15', today, true), null);
});
