import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyData, addUnit, addResident, addFollowUp, deleteResident, ageOn, addDays,
  attentionReasons, nextFollowUp, sortResidents,
} from '../src/model.js';

// Données manifestement fictives.
const TODAY = '2030-06-15';

function fakeResident(overrides = {}) {
  const data = emptyData();
  const resident = addResident(data, 'unite-test');
  Object.assign(resident, { room: '1', fullName: 'Test Fictif', ...overrides });
  return resident;
}

test('les deux sites existent au départ, sans unité ni résident', () => {
  const data = emptyData();
  assert.deepEqual(data.sites.map((s) => s.name), [
    'CHSLD Soulanges',
    'Maison des aînés et alternative de Châteauguay',
  ]);
  assert.equal(data.units.length, 0);
  assert.equal(data.residents.length, 0);
});

test('ajoute une unité à un site et refuse un nom vide', () => {
  const data = emptyData();
  const unit = addUnit(data, 'soulanges', '  Unité test  ');
  assert.equal(unit.name, 'Unité test');
  assert.equal(unit.siteId, 'soulanges');
  assert.equal(addUnit(data, 'soulanges', '   '), null);
  assert.equal(data.units.length, 1);
});

test("calcule l'âge selon la date de naissance", () => {
  assert.equal(ageOn('1940-06-15', TODAY), 90);
  assert.equal(ageOn('1940-06-16', TODAY), 89);
  assert.equal(ageOn('', TODAY), null);
  assert.equal(ageOn('2031-01-01', TODAY), null);
});

test('ajoute des jours en passant par-dessus la fin du mois', () => {
  assert.equal(addDays('2030-06-15', 30), '2030-07-15');
  assert.equal(addDays('2030-12-20', 30), '2031-01-19');
});

test('aucun avant-plan pour un résident sans suivi ni mise en avant', () => {
  assert.deepEqual(attentionReasons(fakeResident(), TODAY), []);
});

test('avant-plan : mise en avant manuelle', () => {
  assert.deepEqual(attentionReasons(fakeResident({ pinned: true }), TODAY), ['Mis en avant']);
});

test("avant-plan : suivi échu, dû aujourd'hui, mais pas un suivi futur ou fait", () => {
  const resident = fakeResident();
  const overdue = addFollowUp(resident);
  overdue.dueDate = '2030-06-14';
  assert.deepEqual(attentionReasons(resident, TODAY), ['Suivi échu']);

  overdue.dueDate = TODAY;
  assert.deepEqual(attentionReasons(resident, TODAY), ["Suivi aujourd'hui"]);

  overdue.dueDate = '2030-06-16';
  assert.deepEqual(attentionReasons(resident, TODAY), []);

  overdue.dueDate = '2030-06-14';
  overdue.done = true;
  assert.deepEqual(attentionReasons(resident, TODAY), []);
});

test('avant-plan : réévaluation annuelle dans 30 jours ou moins, ou dépassée', () => {
  assert.deepEqual(attentionReasons(fakeResident({ annualReview: '2030-07-15' }), TODAY), ['Réévaluation annuelle']);
  assert.deepEqual(attentionReasons(fakeResident({ annualReview: '2030-07-16' }), TODAY), []);
  assert.deepEqual(attentionReasons(fakeResident({ annualReview: '2030-05-01' }), TODAY), ['Réévaluation annuelle']);
});

test('le prochain suivi est le plus proche parmi ceux non faits', () => {
  const resident = fakeResident();
  const later = addFollowUp(resident);
  Object.assign(later, { text: 'Plus tard', dueDate: '2030-09-01' });
  const sooner = addFollowUp(resident);
  Object.assign(sooner, { text: 'Bientôt', dueDate: '2030-07-01' });
  const done = addFollowUp(resident);
  Object.assign(done, { text: 'Fait', dueDate: '2030-06-01', done: true });
  assert.equal(nextFollowUp(resident).text, 'Bientôt');
  assert.equal(nextFollowUp(fakeResident()), null);
});

test("trie l'avant-plan d'abord, puis les chambres dans l'ordre numérique", () => {
  const ten = fakeResident({ room: '10' });
  const two = fakeResident({ room: '2' });
  const pinned = fakeResident({ room: '30', pinned: true });
  assert.deepEqual(sortResidents([ten, two, pinned], TODAY).map((r) => r.room), ['30', '2', '10']);
});

test('supprime un résident sans toucher aux autres', () => {
  const data = emptyData();
  const first = addResident(data, 'u');
  const second = addResident(data, 'u');
  deleteResident(data, first.id);
  assert.deepEqual(data.residents.map((r) => r.id), [second.id]);
});
