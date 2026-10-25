// Tableau de bord : sites à droite, unités en haut, résidents en tableau, fiche en dessous.
// Tout le texte passe par textContent : une donnée de résident n'est jamais interprétée comme du HTML.
import {
  todayString, ageOn, addUnit, addResident, addFollowUp, deleteResident,
  attentionReasons, nextFollowUp, sortResidents,
} from './model.js';
import { loadData, saveData } from './store.js';

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
  } catch {
    box.textContent = 'Enregistrement impossible : les dernières modifications ne sont pas gardées.';
  }
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
      el('h2', {}, site.name), messageBox, unitTabs, addUnitForm, addResidentButton, tableBox, detailBox),
    siteTabs));
  renderTable();
  renderDetail();
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
  tableBox = detailBox = messageBox = null;
  document.getElementById('dashboard').replaceChildren();
}
