// Document unique chiffré qui contient sites, unités et résidents.
import { encrypt, decrypt } from './crypto.js';
import { emptyData } from './model.js';
import * as db from './db.js';

export async function loadData(key) {
  const sealed = await db.get('data');
  return sealed ? decrypt(key, sealed) : emptyData();
}

// Les enregistrements se suivent l'un après l'autre, pour que le dernier état gagne.
let queue = Promise.resolve();

export function saveData(key, data) {
  const run = async () => db.set('data', await encrypt(key, data));
  queue = queue.then(run, run);
  return queue;
}
