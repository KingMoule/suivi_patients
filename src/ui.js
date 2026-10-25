// Tableau de bord : sites à droite, unités en haut, résidents en tableau, fiche en dessous.
// Tout le texte passe par textContent : une donnée de résident n'est jamais interprétée comme du HTML.
import {
  todayString, ageOn, addUnit, addResident, addFollowUp, deleteResident,
  attentionReasons, nextFollowUp, sortResidents, backupReminder,
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

let key = null;
let data = null;
let siteId = null;
let unitId = null;
let residentId = null;
let tableBox = null;
let detailBox = null;
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
const currentResident = () => data.residents.find((r) => r.id === residentId);

function selectSite(id) {
  siteId = id;
  unitId = unitsOf(id)[0]?.id ?? null;
  residentId = null;
  renderAll();
}

function selectUnit(id) {
  unitId = id;
  residentId = null;
  renderAll();
}

function renderTable() {
  const today = todayString();
  const residents = sortResidents(data.residents.filter((r) => r.unitId === unitId), today);
  const headers = ['Chambre', 'Nom complet', 'RAMQ', 'Âge', 'Naissance', 'Niveau de soins',
    'Problèmes de santé', 'Prochain suivi', 'Réévaluation annuelle', 'Avant-plan'];

  const rows = residents.map((resident) => {
    const reasons = attentionReasons(resident, today);
    const next = nextFollowUp(resident);
    const cells = [
      resident.room, resident.fullName, resident.ramq, ageOn(resident.birthDate, today) ?? '',
      resident.birthDate, resident.careLevel, resident.problems.join(', '),
      next ? [next.text, next.dueDate].filter(Boolean).join(' — ') : '',
      resident.annualReview, reasons.join(', '),
    ];
    return el('tr', {
      class: [reasons.length ? 'attention' : '', resident.id === residentId ? 'selected' : ''].join(' ').trim(),
      onclick: () => { residentId = resident.id; renderTable(); renderDetail(); },
    }, ...cells.map((text) => el('td', {}, String(text))));
  });

  tableBox.replaceChildren(
    residents.length === 0
      ? el('p', {}, 'Aucun résident dans cette unité.')
      : el('table', {},
        el('thead', {}, el('tr', {}, ...headers.map((h) => el('th', {}, h)))),
        el('tbody', {}, ...rows))
  );
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

function renderDetail() {
  const resident = currentResident();
  if (!resident) {
    detailBox.replaceChildren();
    return;
  }

  const problems = el('textarea', { value: resident.problems.join('\n'), rows: 4,
    onchange: (e) => onEdit(() => {
      resident.problems = e.target.value.split('\n').map((p) => p.trim()).filter(Boolean);
    }) });

  detailBox.replaceChildren(el('form', { class: 'detail', onsubmit: (e) => e.preventDefault() },
    el('h3', {}, 'Fiche du résident'),
    ...FIELDS.map(([field, label, type]) =>
      textInput(label, type, resident[field], (value) => onEdit(() => { resident[field] = value; }))),
    el('label', {}, 'Problèmes de santé principaux (un par ligne)', problems),
    el('label', { class: 'inline' },
      el('input', { type: 'checkbox', checked: resident.pinned,
        onchange: (e) => onEdit(() => { resident.pinned = e.target.checked; }) }),
      'Mettre en avant-plan'),
    el('h4', {}, 'Suivis actifs'),
    ...resident.followUps.map((f) => followUpRow(resident, f)),
    el('button', { type: 'button', onclick: () => {
      addFollowUp(resident); renderDetail(); persist();
    } }, 'Ajouter un suivi'),
    el('button', { type: 'button', class: 'danger', onclick: () => {
      if (!window.confirm('Supprimer définitivement ce résident ?')) return;
      deleteResident(data, resident.id);
      residentId = null;
      renderTable(); renderDetail(); persist();
    } }, 'Supprimer ce résident')));
}

function renderAll() {
  const root = document.getElementById('dashboard');
  const site = data.sites.find((s) => s.id === siteId);
  const units = unitsOf(siteId);

  tableBox = el('div', { class: 'table-box' });
  detailBox = el('div', {});
  messageBox = el('p', { class: 'error', role: 'alert' });
  reminderBox = el('p', { class: 'status warning', hidden: true });

  const unitTabs = el('div', { class: 'tabs', role: 'tablist' },
    ...units.map((unit) => el('button', {
      type: 'button', class: unit.id === unitId ? 'tab active' : 'tab', onclick: () => selectUnit(unit.id),
    }, unit.name)));

  const addUnitForm = el('form', { class: 'add-unit', onsubmit: (e) => {
    e.preventDefault();
    const input = e.target.elements.name;
    const unit = addUnit(data, siteId, input.value);
    if (!unit) return;
    persist();
    selectUnit(unit.id);
  } },
  el('input', { type: 'text', name: 'name', placeholder: 'Nouvelle unité', autocomplete: 'off' }),
  el('button', { type: 'submit' }, 'Ajouter une unité'));

  const addResidentButton = unitId
    ? el('button', { type: 'button', onclick: () => {
      residentId = addResident(data, unitId).id;
      renderTable(); renderDetail(); persist();
    } }, 'Ajouter un résident')
    : el('p', {}, 'Ajoutez une unité pour commencer.');

  const siteTabs = el('nav', { class: 'sites', 'aria-label': 'Sites' },
    ...data.sites.map((s) => el('button', {
      type: 'button', class: s.id === siteId ? 'tab active' : 'tab', onclick: () => selectSite(s.id),
    }, s.name)));

  root.replaceChildren(el('div', { class: 'layout' },
    el('section', { class: 'content' },
      reminderBox, el('h2', {}, site.name), messageBox, unitTabs, addUnitForm, addResidentButton,
      tableBox, detailBox, backupSection()),
    siteTabs));
  renderTable();
  renderDetail();
  updateReminder();
}

export async function openDashboard(newKey) {
  key = newKey;
  const loaded = await loadData(newKey);
  if (key !== newKey) return; // verrouillé pendant le chargement
  data = loaded;
  siteId = data.sites[0].id;
  unitId = unitsOf(siteId)[0]?.id ?? null;
  residentId = null;
  renderAll();
}

// Efface les données de la mémoire et de l'écran.
export function closeDashboard() {
  key = null;
  data = null;
  residentId = null;
  tableBox = detailBox = messageBox = reminderBox = null;
  document.getElementById('dashboard').replaceChildren();
}
