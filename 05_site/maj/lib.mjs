// Mise à jour des informations (ticket 90) : la partie mécanique, testable sans Claude.
// - gabarit unique des phrases de la cloche ;
// - moment du déclenchement (lundi et jeudi, 9h, heure de Paris) ;
// - mise à jour des dates de vérification et du journal data/nouveautes.json.
// Aucune dépendance. Aucun appel réseau.
import fs from 'node:fs';
import path from 'node:path';

export const THEMES_SLUGS = ['education', 'ecologie', 'pouvoir_achat', 'travail', 'sante', 'logement', 'securite', 'immigration', 'institutions', 'europe'];
export const TYPES = ['candidat_declare', 'programme_publie', 'candidat_retire'];
export const FUSEAU = 'Europe/Paris';
export const JOURS_MAJ = [1, 4]; // lundi, jeudi
export const HEURE_MAJ = 9;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const URL_RE = /^https?:\/\//i;

// ---------- Phrases de la cloche : un seul gabarit, identique pour tous, sans adjectif ----------
const FINS = {
  candidat_declare: 'a déclaré sa candidature.',
  programme_publie: 'a publié son programme.',
  candidat_retire: 'a retiré sa candidature.',
};
export const libelleCandidat = (c) => `${c.prenom} ${c.nom} (${c.parti || 'Sans parti'})`;
export function phrase(type, c) {
  if (!FINS[type]) throw new Error(`type de nouveauté inconnu : ${type}`);
  return `${libelleCandidat(c)} ${FINS[type]}`;
}
export const finPhrase = (type) => FINS[type];

// ---------- Moment du déclenchement ----------
// Renvoie le jour de la semaine (0 = dimanche) et l'heure à Paris pour un instant donné.
export function heureDeParis(instant = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: FUSEAU, weekday: 'short', hour: '2-digit', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(instant).map((p) => [p.type, p.value]));
  const jours = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { jour: jours[parts.weekday], heure: +parts.hour, date: `${parts.year}-${parts.month}-${parts.day}` };
}
// Vrai seulement entre 9h00 et 9h59, heure de Paris, un lundi ou un jeudi.
// La tâche planifiée se déclenche à 7h et 8h UTC : une seule de ces deux heures est 9h à Paris,
// en heure d'hiver (UTC+1) comme en heure d'été (UTC+2). La mise à jour se lance donc une seule fois.
export function estMomentDeMaj(instant = new Date()) {
  const { jour, heure } = heureDeParis(instant);
  return JOURS_MAJ.includes(jour) && heure === HEURE_MAJ;
}

// ---------- Journal des nouveautés ----------
// Lit data/nouveautes.json. Renvoie { ok, entrees, erreur }. Les entrées sont triées, la plus récente en premier.
export function lireJournal(fichier) {
  if (!fs.existsSync(fichier)) return { ok: false, entrees: [], erreur: 'fichier absent' };
  let brut;
  try { brut = JSON.parse(fs.readFileSync(fichier, 'utf8')); } catch (e) { return { ok: false, entrees: [], erreur: `JSON illisible : ${e.message}` }; }
  if (!Array.isArray(brut)) return { ok: false, entrees: [], erreur: 'le fichier doit contenir une liste' };
  for (const e of brut) {
    if (!e || !DATE_RE.test(e.date || '') || !Array.isArray(e.nouveautes)) return { ok: false, entrees: [], erreur: 'entrée mal formée' };
  }
  return { ok: true, entrees: [...brut].sort((a, b) => b.date.localeCompare(a.date)), erreur: null };
}

// Vérifie une nouveauté avant de l'écrire. Renvoie la liste des problèmes (vide = valide).
export function problemesNouveaute(n, candidats) {
  const pb = [];
  if (!TYPES.includes(n?.type)) pb.push(`type inconnu : ${n?.type}`);
  const c = candidats[n?.candidat];
  if (!c) pb.push(`candidat inconnu : ${n?.candidat}`);
  if (!URL_RE.test(n?.source?.url || '')) pb.push(`source sans lien pour ${n?.candidat}`);
  if (!n?.source?.titre) pb.push(`source sans titre pour ${n?.candidat}`);
  if (n?.source?.date && !DATE_RE.test(n.source.date)) pb.push(`date de source invalide pour ${n?.candidat}`);
  if (n?.type === 'programme_publie' && c && !URL_RE.test(c.programme?.url || '')) pb.push(`programme_publie sans champ programme rempli pour ${n.candidat}`);
  return pb;
}

// ---------- Remplacement des dates sans toucher au reste du fichier ----------
// Change la valeur d'une clé de date au premier niveau d'un JSON, en gardant la mise en forme du fichier.
export function remplacerDateJSON(texte, cle, nouvelle) {
  const avant = JSON.parse(texte);
  if (!(cle in avant)) throw new Error(`clé ${cle} absente`);
  const re = new RegExp(`("${cle}"\\s*:\\s*)"${String(avant[cle]).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`);
  const resultat = texte.replace(re, `$1"${nouvelle}"`);
  // Contrôle : seule la clé de premier niveau a changé.
  const apres = JSON.parse(resultat);
  if (apres[cle] !== nouvelle || JSON.stringify({ ...apres, [cle]: avant[cle] }) !== JSON.stringify(avant)) {
    throw new Error(`remplacement ambigu de ${cle}`);
  }
  return resultat;
}
// Change la première date « Vérifié le AAAA-MM-JJ » ou « Consulté le AAAA-MM-JJ » d'une liste Markdown.
export function remplacerDateMarkdown(texte, nouvelle) {
  const re = /((?:Vérifié|Consulté) le )\d{4}-\d{2}-\d{2}/;
  if (!re.test(texte)) throw new Error('aucune date « Vérifié le » ou « Consulté le » trouvée');
  return texte.replace(re, `$1${nouvelle}`);
}

// Squelette du fichier de mesures d'un nouveau candidat : les 10 thèmes présents, vides = « non communiqué ».
export function squeletteMesures(id, date) {
  return { id, date_verif: date, programme_publie: false, themes: Object.fromEntries(THEMES_SLUGS.map((s) => [s, []])) };
}

// ---------- Préparation d'une mise à jour ----------
// Calcule toutes les écritures sans rien écrire. Lève une erreur si quoi que ce soit est invalide :
// dans ce cas rien n'est écrit et aucune date ne change (exigence 14).
//   racine      : dossier racine du dépôt (contient 05_site et 01_candidats)
//   date        : date du run, AAAA-MM-JJ
//   echecs      : identifiants des candidats dont la vérification a échoué (ils gardent leur ancienne date)
//   verifies    : identifiants vérifiés ; par défaut tous les candidats sauf les échecs
//   nouveautes  : grandes nouveautés du run [{ type, candidat, source: { titre, url, date } }]
//   listesVerifiees : la liste des candidats et celle des prétendants ont été revérifiées (défaut : vrai)
export function preparerMaj({ racine, date, echecs = [], verifies = null, nouveautes = [], listesVerifiees = true }) {
  if (!DATE_RE.test(date || '')) throw new Error(`date invalide : ${date}`);
  const data = path.join(racine, '05_site', 'data');
  const dossierC = path.join(data, 'candidats');
  const dossierM = path.join(data, 'mesures');
  const ids = fs.readdirSync(dossierC).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
  const candidats = Object.fromEntries(ids.map((id) => [id, JSON.parse(fs.readFileSync(path.join(dossierC, `${id}.json`), 'utf8'))]));
  for (const id of [...echecs, ...(verifies || [])]) if (!candidats[id]) throw new Error(`candidat inconnu : ${id}`);
  const echecsSet = new Set(echecs);
  const aDater = (verifies || ids).filter((id) => !echecsSet.has(id));

  const ecritures = [];
  for (const id of aDater) {
    const fc = path.join(dossierC, `${id}.json`);
    const fm = path.join(dossierM, `${id}.json`);
    if (!fs.existsSync(fm)) throw new Error(`fichier de mesures absent : ${id}`);
    const m = JSON.parse(fs.readFileSync(fm, 'utf8'));
    const manquants = THEMES_SLUGS.filter((s) => !Array.isArray(m.themes?.[s]));
    if (manquants.length) throw new Error(`${id} : thèmes absents (${manquants.join(', ')})`);
    if (date < (candidats[id].date_maj || '')) throw new Error(`${id} : la date du run est antérieure à date_maj`);
    ecritures.push({ fichier: fc, contenu: remplacerDateJSON(fs.readFileSync(fc, 'utf8'), 'date_maj', date) });
    ecritures.push({ fichier: fm, contenu: remplacerDateJSON(fs.readFileSync(fm, 'utf8'), 'date_verif', date) });
  }
  if (listesVerifiees) {
    for (const nom of ['00_liste_candidats.md', '00_pretendants_non_declares.md']) {
      const f = path.join(racine, '01_candidats', nom);
      if (fs.existsSync(f)) ecritures.push({ fichier: f, contenu: remplacerDateMarkdown(fs.readFileSync(f, 'utf8'), date) });
    }
  }

  // Journal : une entrée par run, même vide. Un second run le même jour remplace l'entrée du jour.
  const pb = nouveautes.flatMap((n) => problemesNouveaute(n, candidats));
  if (pb.length) throw new Error(`nouveautés invalides :\n - ${pb.join('\n - ')}`);
  const fj = path.join(data, 'nouveautes.json');
  const journal = fs.existsSync(fj) ? lireJournal(fj) : { ok: true, entrees: [] };
  if (!journal.ok) throw new Error(`data/nouveautes.json : ${journal.erreur}`);
  const entree = {
    date,
    nouveautes: nouveautes.map((n) => ({
      type: n.type, candidat: n.candidat, phrase: phrase(n.type, candidats[n.candidat]),
      source: { titre: n.source.titre, url: n.source.url, ...(n.source.date ? { date: n.source.date } : {}) },
    })),
  };
  const entrees = [entree, ...journal.entrees.filter((e) => e.date !== date)].sort((a, b) => b.date.localeCompare(a.date));
  ecritures.push({ fichier: fj, contenu: JSON.stringify(entrees, null, 2) + '\n' });

  const rapport = {
    date,
    verifies: aDater.length,
    total: ids.length,
    echecs: [...echecsSet].map((id) => ({ id, date_gardee: candidats[id].date_maj })),
    nouveautes: entree.nouveautes.map((n) => n.phrase),
    a_verifier: ids.filter((id) => candidats[id].a_verifier),
  };
  return { ecritures, rapport, entree };
}

// Écrit toutes les écritures préparées : chaque fichier passe par un fichier temporaire, puis est renommé.
export function appliquer(ecritures) {
  const temps = ecritures.map((e) => { const t = `${e.fichier}.maj-tmp`; fs.writeFileSync(t, e.contenu); return [t, e.fichier]; });
  for (const [t, f] of temps) fs.renameSync(t, f);
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const dateLongue = (d) => { const [a, m, j] = d.split('-'); return `${+j === 1 ? '1er' : +j} ${MOIS[+m - 1]} ${a}`; };

// Rapport court de fin de run, pour Anne.
export function texteRapport(r, { contradictions = [] } = {}) {
  return [
    `Mise à jour du ${dateLongue(r.date)}`,
    `Fiches vérifiées : ${r.verifies} sur ${r.total}`,
    `Nouveautés : ${r.nouveautes.length ? r.nouveautes.join(' ') : 'aucune (entrée vide ajoutée à data/nouveautes.json)'}`,
    `Vérification échouée : ${r.echecs.length ? r.echecs.map((e) => `${e.id} (date gardée au ${dateLongue(e.date_gardee)})`).join(', ') : 'aucune'}`,
    `Candidatures à confirmer (a_verifier) : ${r.a_verifier.length ? r.a_verifier.join(', ') : 'aucune'}`,
    `Contradictions : ${contradictions.length ? contradictions.join(' ; ') : 'aucune'}`,
  ].join('\n');
}
