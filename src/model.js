// Modèle de données : fonctions pures, sans navigateur, pour pouvoir les tester avec Node.
// Les dates sont des chaînes « AAAA-MM-JJ » (heure locale), comparables telles quelles.

const REVIEW_NOTICE_DAYS = 30;

const pad = (n) => String(n).padStart(2, '0');

export function todayString(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(dateString, days) {
  const [y, m, d] = dateString.split('-').map(Number);
  return todayString(new Date(y, m - 1, d + days));
}

export function ageOn(birthDate, today) {
  if (!birthDate) return null;
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  const age = ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
  return age >= 0 ? age : null;
}

export function emptyData() {
  return {
    sites: [
      { id: 'soulanges', name: 'CHSLD Soulanges' },
      { id: 'chateauguay', name: 'Maison des aînés et alternative de Châteauguay' },
    ],
    units: [],
    residents: [],
  };
}

// Retourne la nouvelle unité, ou null si le nom est vide.
export function addUnit(data, siteId, name) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const unit = { id: crypto.randomUUID(), siteId, name: trimmed };
  data.units.push(unit);
  return unit;
}

export function addResident(data, unitId) {
  const resident = {
    id: crypto.randomUUID(),
    unitId,
    room: '',
    fullName: '',
    ramq: '',
    birthDate: '',
    careLevel: '',
    problems: [],
    annualReview: '',
    pinned: false,
    followUps: [],
  };
  data.residents.push(resident);
  return resident;
}

export function addFollowUp(resident) {
  const followUp = { id: crypto.randomUUID(), text: '', dueDate: '', done: false };
  resident.followUps.push(followUp);
  return followUp;
}

export function deleteResident(data, residentId) {
  data.residents = data.residents.filter((r) => r.id !== residentId);
}

// Raisons pour lesquelles le résident passe en avant-plan ; vide s'il n'y en a aucune.
export function attentionReasons(resident, today) {
  const reasons = [];
  if (resident.pinned) reasons.push('Mis en avant');
  const open = resident.followUps.filter((f) => !f.done && f.dueDate);
  if (open.some((f) => f.dueDate < today)) reasons.push('Suivi échu');
  if (open.some((f) => f.dueDate === today)) reasons.push("Suivi aujourd'hui");
  if (resident.annualReview && resident.annualReview <= addDays(today, REVIEW_NOTICE_DAYS)) {
    reasons.push('Réévaluation annuelle');
  }
  return reasons;
}

// Le suivi non fait le plus proche ; les suivis sans date passent en dernier.
export function nextFollowUp(resident) {
  const open = resident.followUps.filter((f) => !f.done && (f.text || f.dueDate));
  open.sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  return open[0] ?? null;
}

// Avant-plan d'abord, puis par chambre (ordre numérique : 2 avant 10).
export function sortResidents(residents, today) {
  const rank = (r) => (attentionReasons(r, today).length > 0 ? 0 : 1);
  return [...residents].sort(
    (a, b) => rank(a) - rank(b) || a.room.localeCompare(b.room, 'fr', { numeric: true })
  );
}
