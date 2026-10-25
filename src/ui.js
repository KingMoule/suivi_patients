// Tableau de bord « Registre » : sites à droite, unités en haut, résidents en tableau, fiche en grande feuille.
// Tout le texte passe par textContent : une donnée de résident n'est jamais interprétée comme du HTML.
import {
  todayString, ageOn, addUnit, addResident, addFollowUp, deleteResident,
  attentionReasons, nextFollowUp, sortResidents, backupReminder, daysBetween, maskRamq, matchesSearch,
} from './model.js';
import { loadData, saveData, getLastBackup, setLastBackup } from './store.js';
import { createBackup, readBackup } from './backup.js';
import { passphraseError } from './passphrase.js';

const FIELDS = [
  ['room', 'Chambre', 'text'],
  ['fullName', 'Nom complet', 'text'],
  ['ramq', "Numéro d'assurance maladie (RAMQ)", 'text'],
  ['birthDate', 'Date de naissance', 'date'],
  ['careLevel', 'Niveau de soins', 'text'],
  ['annualReview', 'Réévaluation annuelle prévue', 'date'],
];

// Gravité décroissante : la première raison trouvée donne la couleur de la ligne.
const FLAGS = [
  ['Suivi échu', 'late'],
  ["Suivi aujourd'hui", 'today'],
  ['Réévaluation annuelle', 'review'],
  ['Mis en avant', 'pin'],
];

const ICONS = {
  late: 'M12 3 2 20h20L12 3zM12 10v4M12 17h.01',
  today: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  review: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
  pin: 'M9 3h6l-1 6 4 4H6l4-4-1-6zM12 13v8',
  lock: 'M5 11h14v10H5zM8 11V8a4 4 0 0 1 8 0v3',
  plus: 'M12 5v14M5 12h14',
};

let key = null;
let data = null;
let siteId = null;
let unitId = null;
let residentId = null;
let query = '';
let addingUnit = false;
let onLock = null;
let tableBox = null;
let sheet = null;
let messageBox = null;
let reminderBox = null;

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    if (name.startsWith('on')) node.addEventListener(name.slice(2), value);
    else if (name === 'class') node.className = value;
    else if (name in node) node[name] = value;
    else node.setAttribute(name, value);
  }
  node.append(...children);
  return node;
}

function icon(name, label) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'icon');
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
}

const chip = (kind, text) => el('span', { class: `chip ${kind}` }, icon(kind), text);

// « 14 mars 1939 », ou « 14 mars » sans l'année.
function formatDate(dateString, withYear = true) {
  if (!dateString) return '';
  const [y, m, d] = dateString.split('-').map(Number);
  const options = withYear ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' };
  return new Date(y, m - 1, d).toLocaleDateString('fr-CA', options);
}

async function persist() {
  if (!key) return;
  const box = messageBox; // l'app peut se verrouiller avant la fin de l'enregistrement
  try {
    await saveData(key, data);
    box.textContent = '';
    updateReminder();
  } catch {
    box.textContent = 'Enregistrement impossible : les dernières modifications ne sont pas gardées.';
  }
}

async function updateReminder() {
  const box = reminderBox;
  const hasResidents = Boolean(data?.residents.length);
  const message = backupReminder(await getLastBackup(), todayString(), hasResidents);
  if (!box) return;
  box.textContent = message ?? '';
  box.hidden = !message;
}

function downloadFile(file) {
  const link = el('a', { href: URL.createObjectURL(file), download: file.name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 10000);
}

// Retourne true si le fichier a été enregistré. Sur l'iPad, la feuille de partage permet « Enregistrer dans Fichiers ».
async function saveFile(text, message) {
  const file = new File([text], `suivi-sauvegarde-${todayString()}.json`, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
    else downloadFile(file);
  } catch (error) {
    if (error.name !== 'AbortError') message.textContent = "Le fichier n'a pas pu être enregistré.";
    return false;
  }
  await setLastBackup(todayString());
  return true;
}

function backupSection() {
  const exportMessage = el('p', { class: 'error', role: 'alert' });
  const exportResult = el('div', {});
  const restoreMessage = el('p', { class: 'error', role: 'alert' });

  const exportForm = el('form', { onsubmit: async (e) => {
    e.preventDefault();
    const form = e.target;
    const { passphrase, confirmation } = Object.fromEntries(new FormData(form));
    form.reset();
    exportResult.replaceChildren();
    exportMessage.textContent = passphraseError(passphrase, confirmation) ?? '';
    if (exportMessage.textContent) return;
    const text = await createBackup(data, passphrase);
    exportResult.replaceChildren(el('button', { type: 'button', onclick: async () => {
      if (await saveFile(text, exportMessage)) {
        exportResult.replaceChildren(el('p', {}, 'Sauvegarde enregistrée.'));
        updateReminder();
      }
    } }, 'Enregistrer le fichier'));
  } },
  el('h4', {}, 'Exporter une sauvegarde'),
  el('p', {}, "Le fichier est chiffré avec la phrase de passe ci-dessous, qui peut différer de celle de l'app. Gardez-la : sans elle, la sauvegarde est inutilisable."),
  el('label', {}, 'Phrase de passe de la sauvegarde (12 caractères ou plus)',
    el('input', { type: 'password', name: 'passphrase', autocomplete: 'off', required: true })),
  el('label', {}, 'Confirmer',
    el('input', { type: 'password', name: 'confirmation', autocomplete: 'off', required: true })),
  exportMessage,
  el('button', { type: 'submit' }, 'Préparer la sauvegarde'),
  exportResult);

  const restoreForm = el('form', { onsubmit: async (e) => {
    e.preventDefault();
    const form = e.target;
    const file = form.elements.file.files[0];
    const passphrase = form.elements.passphrase.value;
    form.reset();
    restoreMessage.textContent = '';
    let restored;
    try {
      restored = await readBackup(await file.text(), passphrase);
    } catch {
      restoreMessage.textContent = 'Phrase de passe incorrecte ou fichier de sauvegarde invalide.';
      return;
    }
    if (!key) return; // verrouillé pendant la lecture
    if (!window.confirm('Remplacer toutes les données actuelles par celles de la sauvegarde ?')) return;
    data = restored;
    await persist();
    selectSite(data.sites[0].id);
  } },
  el('h4', {}, 'Restaurer une sauvegarde'),
  el('p', {}, 'Remplace toutes les données actuelles.'),
  el('label', {}, 'Fichier de sauvegarde',
    el('input', { type: 'file', name: 'file', accept: '.json,application/json', required: true })),
  el('label', {}, 'Phrase de passe de la sauvegarde',
    el('input', { type: 'password', name: 'passphrase', autocomplete: 'off', required: true })),
  restoreMessage,
  el('button', { type: 'submit' }, 'Restaurer'));

  return el('details', { class: 'backup' }, el('summary', {}, 'Sauvegarde'), exportForm, restoreForm);
}

const unitsOf = (id) => data.units.filter((u) => u.siteId === id);
const residentsIn = (id) => data.residents.filter((r) => r.unitId === id);
const currentResident = () => data.residents.find((r) => r.id === residentId);

function selectSite(id) {
  siteId = id;
  unitId = unitsOf(id)[0]?.id ?? null;
  residentId = null;
  query = '';
  addingUnit = false;
  renderAll();
}

function selectUnit(id) {
  unitId = id;
  residentId = null;
  query = '';
  addingUnit = false;
  renderAll();
}

function openResident(id) {
  residentId = id;
  renderDetail();
}

function followUpCell(resident, today) {
  const next = nextFollowUp(resident);
  if (!next) return el('td', { class: 'muted' }, 'Aucun suivi');
  const days = next.dueDate ? daysBetween(today, next.dueDate) : null;
  let when = next.dueDate ? el('span', { class: 'sub date' }, formatDate(next.dueDate, false)) : '';
  if (days < 0) when = chip('late', `Échu depuis ${-days} j`);
  else if (days === 0) when = chip('today', "Aujourd'hui");
  return el('td', {}, el('div', { class: 'stack' }, next.text || 'Suivi sans titre', when));
}

function reviewCell(resident, reasons, today) {
  const date = el('span', { class: 'date' }, formatDate(resident.annualReview));
  if (!reasons.includes('Réévaluation annuelle')) return el('td', { class: 'muted' }, date);
  const days = daysBetween(today, resident.annualReview);
  let text = `Dans ${days} j`;
  if (days === 0) text = "Aujourd'hui";
  else if (days < 0) text = `Dépassée de ${-days} j`;
  return el('td', {}, el('div', { class: 'stack' }, date, chip('review', text)));
}

function residentRow(resident, today) {
  const reasons = attentionReasons(resident, today);
  const flag = FLAGS.find(([reason]) => reasons.includes(reason))?.[1];
  const age = ageOn(resident.birthDate, today);
  return el('tr', { class: flag ? `flag-${flag}` : '', onclick: () => openResident(resident.id) },
    el('td', { class: 'room' }, resident.room),
    el('td', {},
      el('div', { class: 'name' }, resident.pinned ? icon('pin', 'Mis en avant') : '', resident.fullName || 'Sans nom'),
      el('span', { class: 'sub' }, [age === null ? '' : `${age} ans`, formatDate(resident.birthDate)].filter(Boolean).join(' · '))),
    el('td', { class: 'ramq' }, maskRamq(resident.ramq)),
    el('td', {}, resident.careLevel ? el('span', { class: 'level' }, resident.careLevel) : ''),
    el('td', { class: 'problems' }, resident.problems.join(', ')),
    followUpCell(resident, today),
    reviewCell(resident, reasons, today));
}

const groupRow = (title, detail) => el('tr', { class: 'group' }, el('td', { colSpan: 7 }, el('b', {}, title), detail));

function renderTable() {
  if (!unitId) {
    tableBox.replaceChildren(el('p', { class: 'empty' }, 'Ajoutez une unité pour commencer.'));
    return;
  }
  const today = todayString();
  const inUnit = residentsIn(unitId);
  const residents = sortResidents(inUnit.filter((r) => matchesSearch(r, query)), today);
  const flagged = residents.filter((r) => attentionReasons(r, today).length > 0);
  const others = residents.slice(flagged.length);

  if (residents.length === 0) {
    tableBox.replaceChildren(el('p', { class: 'empty' },
      inUnit.length === 0 ? 'Aucun résident dans cette unité.' : 'Aucun résident ne correspond à la recherche.'));
    return;
  }

  const headers = ['Ch.', 'Résident', 'RAMQ', 'Soins', 'Problèmes de santé', 'Prochain suivi', 'Réévaluation'];
  tableBox.replaceChildren(el('table', {},
    el('thead', {}, el('tr', {}, ...headers.map((h) => el('th', {}, h)))),
    el('tbody', {},
      ...(flagged.length ? [groupRow('Avant-plan', ` · ${flagged.length}`), ...flagged.map((r) => residentRow(r, today))] : []),
      ...(others.length ? [groupRow('Autres résidents', ' · par chambre'), ...others.map((r) => residentRow(r, today))] : []))));
}

function textInput(label, type, value, onchange) {
  return el('label', {}, label, el('input', { type, value, autocomplete: 'off', onchange: (e) => onchange(e.target.value) }));
}

function onEdit(apply) {
  apply();
  renderTable();
  persist();
}

function followUpRow(resident, followUp) {
  return el('div', { class: 'follow-up' },
    el('input', { type: 'checkbox', checked: followUp.done, title: 'Fait',
      onchange: (e) => onEdit(() => { followUp.done = e.target.checked; }) }),
    el('input', { type: 'text', value: followUp.text, placeholder: 'Suivi', autocomplete: 'off',
      onchange: (e) => onEdit(() => { followUp.text = e.target.value; }) }),
    el('input', { type: 'date', value: followUp.dueDate,
      onchange: (e) => onEdit(() => { followUp.dueDate = e.target.value; }) }),
    el('button', { type: 'button', onclick: () => {
      resident.followUps = resident.followUps.filter((f) => f.id !== followUp.id);
      renderTable(); renderDetail(); persist();
    } }, 'Retirer'));
}

// La fiche s'ouvre en grande feuille par-dessus le tableau ; la fermer revient au tableau.
function renderDetail() {
  const resident = currentResident();
  if (!resident) {
    if (sheet.open) sheet.close();
    return;
  }

  const problems = el('textarea', { value: resident.problems.join('\n'), rows: 4,
    onchange: (e) => onEdit(() => {
      resident.problems = e.target.value.split('\n').map((p) => p.trim()).filter(Boolean);
    }) });

  sheet.replaceChildren(el('form', { class: 'detail', onsubmit: (e) => e.preventDefault() },
    el('div', { class: 'sheet-head' },
      el('h3', {}, 'Fiche du résident'),
      el('button', { type: 'button', class: 'primary', onclick: () => sheet.close() }, 'Terminé')),
    el('div', { class: 'fields' },
      ...FIELDS.map(([field, label, type]) =>
        textInput(label, type, resident[field], (value) => onEdit(() => { resident[field] = value; })))),
    el('label', {}, 'Problèmes de santé principaux (un par ligne)', problems),
    el('label', { class: 'inline' },
      el('input', { type: 'checkbox', checked: resident.pinned,
        onchange: (e) => onEdit(() => { resident.pinned = e.target.checked; }) }),
      'Mettre en avant-plan'),
    el('h4', {}, 'Suivis actifs'),
    ...resident.followUps.map((f) => followUpRow(resident, f)),
    el('div', { class: 'sheet-foot' },
      el('button', { type: 'button', onclick: () => {
        addFollowUp(resident); renderDetail(); persist();
      } }, icon('plus'), 'Ajouter un suivi'),
      el('button', { type: 'button', class: 'danger', onclick: () => {
        if (!window.confirm('Supprimer définitivement ce résident ?')) return;
        deleteResident(data, resident.id);
        residentId = null;
        renderTable(); renderDetail(); persist();
      } }, 'Supprimer ce résident'))));
  if (!sheet.open) sheet.showModal();
}

function unitPills(units) {
  const pills = units.map((unit) => el('button', {
    type: 'button', class: unit.id === unitId ? 'pill active' : 'pill',
    'aria-pressed': String(unit.id === unitId), onclick: () => selectUnit(unit.id),
  }, unit.name, el('span', { class: 'count' }, String(residentsIn(unit.id).length))));

  const addUnitForm = el('form', { class: 'add-unit', onsubmit: (e) => {
    e.preventDefault();
    const unit = addUnit(data, siteId, e.target.elements.name.value);
    if (!unit) return;
    persist();
    selectUnit(unit.id);
  } },
  el('input', { type: 'text', name: 'name', placeholder: 'Nom de la nouvelle unité', autocomplete: 'off' }),
  el('button', { type: 'submit' }, 'Ajouter'),
  el('button', { type: 'button', onclick: () => { addingUnit = false; renderAll(); } }, 'Annuler'));

  const addButton = el('button', { type: 'button', class: 'pill add', onclick: () => {
    addingUnit = true;
    renderAll();
    document.querySelector('.add-unit input').focus();
  } }, icon('plus'), 'Unité');

  return el('div', { class: 'units' }, ...pills, addingUnit ? addUnitForm : addButton);
}

function renderAll() {
  const root = document.getElementById('dashboard');
  const site = data.sites.find((s) => s.id === siteId);
  const unit = data.units.find((u) => u.id === unitId);

  tableBox = el('div', { class: 'table-box' });
  sheet = el('dialog', { class: 'sheet', onclose: () => {
    if (!data) return; // verrouillé pendant que la fiche était ouverte
    residentId = null;
    renderTable();
  } });
  messageBox = el('p', { class: 'error', role: 'alert' });
  reminderBox = el('p', { class: 'status warning', hidden: true });

  const tools = unitId ? el('div', { class: 'tools' },
    el('input', { type: 'search', value: query, placeholder: 'Chambre ou nom', autocomplete: 'off',
      'aria-label': 'Rechercher un résident', oninput: (e) => { query = e.target.value; renderTable(); } }),
    el('button', { type: 'button', class: 'primary', onclick: () => {
      const resident = addResident(data, unitId);
      query = '';
      renderAll();
      openResident(resident.id);
      persist();
    } }, icon('plus'), 'Résident')) : '';

  const header = el('div', { class: 'toolbar' },
    el('div', {}, el('p', { class: 'eyebrow' }, site.name), el('h2', {}, unit ? unit.name : 'Aucune unité')),
    tools);

  const rail = el('aside', { class: 'rail' },
    el('nav', { 'aria-label': 'Sites' },
      ...data.sites.map((s) => el('button', {
        type: 'button', class: s.id === siteId ? 'site active' : 'site',
        'aria-pressed': String(s.id === siteId), onclick: () => selectSite(s.id),
      }, s.name))),
    el('button', { type: 'button', class: 'lock', onclick: () => onLock() }, icon('lock'), 'Verrouiller'));

  root.replaceChildren(el('div', { class: 'layout' },
    el('section', { class: 'content' },
      reminderBox, header, messageBox, unitPills(unitsOf(siteId)), tableBox, backupSection()),
    rail), sheet);
  renderTable();
  updateReminder();
}

// lock : appelé par le bouton Verrouiller.
export async function openDashboard(newKey, lock) {
  key = newKey;
  onLock = lock;
  const loaded = await loadData(newKey);
  if (key !== newKey) return; // verrouillé pendant le chargement
  data = loaded;
  siteId = data.sites[0].id;
  unitId = unitsOf(siteId)[0]?.id ?? null;
  residentId = null;
  query = '';
  addingUnit = false;
  renderAll();
}

// Efface les données de la mémoire et de l'écran.
export function closeDashboard() {
  key = null;
  data = null;
  residentId = null;
  query = '';
  tableBox = sheet = messageBox = reminderBox = null;
  document.getElementById('dashboard').replaceChildren();
}
