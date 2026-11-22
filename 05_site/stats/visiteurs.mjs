#!/usr/bin/env node
// Mesure d'audience (ticket 95) : mise en forme des totaux quotidiens, en français.
// Appelé par deploy/visiteurs.sh, qui lui passe sur l'entrée standard les totaux lus sur le serveur
// (une ligne par jour : « AAAA-MM-JJ.json<tabulation>contenu JSON »). Avec --dossier, lit un dossier local.
//
// Usage : node stats/visiteurs.mjs [début] [fin] [--comparer semaine|mois] [--json] [--dossier DOSSIER]
//   Sans date : la veille. Une date : ce jour là. Deux dates : la période, bornes comprises.
//   --verifier : vérifie seulement les arguments (utilisé avant la connexion SSH).
// Codes de sortie : 0 succès, 1 pas de données ou dates invalides.
// Ne lit que des totaux anonymes : jamais d'adresse IP ni d'empreinte dans la sortie.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const THEMES = {
  education: 'Éducation', ecologie: 'Écologie et énergie', pouvoir_achat: "Pouvoir d'achat", travail: 'Travail et emploi',
  sante: 'Santé', logement: 'Logement', securite: 'Sécurité et justice', immigration: 'Immigration et intégration',
  institutions: 'Institutions et démocratie', europe: 'Europe et international',
};
const PAGES = {
  '/': 'Accueil', '/themes.html': 'Tous les thèmes', '/candidats.html': 'Les candidats', '/methode.html': 'Méthode',
  '/panel-sources.html': 'Panel de sources', '/qui-sommes-nous.html': 'Qui sommes nous ?', '/nouveautes.html': 'Mises à jour',
  '/signaler.html': 'Signaler une erreur', '/historique.html': 'Historique des corrections', '/lexique.html': 'Lexique',
  '/404.html': 'Page introuvable',
};
const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'candidats');
let nomsCandidats = null;
function nomCandidat(id) {
  if (!nomsCandidats) {
    nomsCandidats = {};
    try {
      for (const f of fs.readdirSync(DATA)) {
        if (!f.endsWith('.json')) continue;
        try { const c = JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); if (c.id) nomsCandidats[c.id] = `${c.prenom} ${c.nom}`; } catch { /* fiche illisible : on garde l'adresse */ }
      }
    } catch { /* dossier absent : on garde l'adresse */ }
  }
  return nomsCandidats[id];
}

// Adresse d'une page -> titre lisible.
export function titrePage(p) {
  if (PAGES[p]) return PAGES[p];
  const nom = p.replace(/^\//, '').replace(/\.html$/, '');
  if (THEMES[nom]) return THEMES[nom];
  const c = nom.match(/^candidat-(.+)$/);
  if (c) return nomCandidat(c[1]) ? `Fiche candidat : ${nomCandidat(c[1])}` : 'Fiche candidat';
  return p;
}

export const estDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d);
export const decaler = (d, j) => new Date(Date.parse(`${d}T00:00:00Z`) + j * 86400000).toISOString().slice(0, 10);
const jourSemaine = (d) => new Date(`${d}T00:00:00Z`).getUTCDay();
const parts = (d) => d.split('-').map(Number);
const jourFr = (j) => (j === 1 ? '1er' : String(j));
export const dateFr = (d, { annee = true, semaine = false } = {}) => {
  const [a, m, j] = parts(d);
  return `${semaine ? `${JOURS[jourSemaine(d)]} ` : ''}${jourFr(j)} ${MOIS[m - 1]}${annee ? ` ${a}` : ''}`;
};
export function periodeFr(debut, fin) {
  if (debut === fin) return dateFr(debut);
  const [a1, m1, j1] = parts(debut);
  const [a2, m2] = parts(fin);
  if (a1 === a2 && m1 === m2) return `${jourFr(j1)} au ${dateFr(fin)}`;
  if (a1 === a2) return `${dateFr(debut, { annee: false })} au ${dateFr(fin)}`;
  return `${dateFr(debut)} au ${dateFr(fin)}`;
}
export const nb = (n) => n.toLocaleString('fr-FR').replace(/ | /g, ' ');
const pc = (n, total) => (total ? Math.round((100 * n) / total) : 0);
export function joursEntre(debut, fin) {
  const r = [];
  for (let d = debut; d <= fin; d = decaler(d, 1)) r.push(d);
  return r;
}
// Liste de dates -> « 20 au 23 novembre, 25 novembre ».
function plagesFr(dates) {
  const plages = [];
  for (const d of dates) {
    const der = plages[plages.length - 1];
    if (der && decaler(der[1], 1) === d) der[1] = d; else plages.push([d, d]);
  }
  return plages.map(([a, b]) => (a === b ? dateFr(a, { annee: false }) : periodeFr(a, b).replace(/ \d{4}$/, ''))).join(', ');
}

const ERREUR_DATES = 'Dates non reconnues.\nExemple : sh deploy/visiteurs.sh 2026-11-01 2026-11-30';

// Arguments -> { periode: [début, fin], precedente?: [début, fin], json } ou { erreur }.
export function lireArguments(argv, aujourdhui) {
  const o = { json: false, dates: [], dossier: null, verifier: false, comparer: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') o.json = true;
    else if (a === '--verifier') o.verifier = true;
    else if (a === '--dossier') o.dossier = argv[++i];
    else if (a === '--aujourdhui') aujourdhui = argv[++i];
    else if (a === '--comparer') { o.comparer = argv[++i]; if (!o.comparer || o.comparer.startsWith('-')) return { erreur: 'Comparaison non reconnue : choisir semaine ou mois.\nExemple : sh deploy/visiteurs.sh --comparer semaine' }; }
    else if (a.startsWith('--comparer=')) o.comparer = a.slice(11);
    else if (a.startsWith('-')) return { erreur: `Option inconnue : ${a}\nOptions : --comparer semaine, --comparer mois, --json` };
    else o.dates.push(a);
  }
  if (!estDate(aujourdhui)) return { erreur: ERREUR_DATES };
  o.aujourdhui = aujourdhui;
  const hier = decaler(aujourdhui, -1);
  if (o.comparer) {
    if (o.dates.length) return { erreur: "L'option --comparer ne prend pas de date.\nExemple : sh deploy/visiteurs.sh --comparer semaine" };
    if (o.comparer === 'semaine') {
      const lundi = decaler(hier, -((jourSemaine(hier) + 6) % 7));
      o.periode = [lundi, hier];
      o.precedente = [decaler(lundi, -7), decaler(hier, -7)];
    } else if (o.comparer === 'mois') {
      const [a, m, j] = parts(hier);
      const premier = `${a}-${String(m).padStart(2, '0')}-01`;
      const prec = new Date(Date.UTC(a, m - 2, 1));
      const finPrecMois = new Date(Date.UTC(a, m - 1, 0)).getUTCDate();
      const pa = prec.getUTCFullYear();
      const pm = String(prec.getUTCMonth() + 1).padStart(2, '0');
      o.periode = [premier, hier];
      o.precedente = [`${pa}-${pm}-01`, `${pa}-${pm}-${String(Math.min(j, finPrecMois)).padStart(2, '0')}`];
    } else return { erreur: 'Comparaison non reconnue : choisir semaine ou mois.\nExemple : sh deploy/visiteurs.sh --comparer semaine' };
    return o;
  }
  if (o.dates.length > 2 || !o.dates.every(estDate)) return { erreur: ERREUR_DATES };
  const [debut = hier, fin = debut] = o.dates;
  if (debut > fin) return { erreur: 'La date de début est après la date de fin.\nExemple : sh deploy/visiteurs.sh 2026-11-01 2026-11-30' };
  if (debut < '2020-01-01' || fin > '2100-12-31' || (Date.parse(fin) - Date.parse(debut)) / 86400000 > 800) return { erreur: 'Période trop longue : les totaux sont gardés 25 mois au plus.\nExemple : sh deploy/visiteurs.sh 2026-11-01 2026-11-30' };
  o.periode = [debut, fin];
  return o;
}

// Texte « nom<TAB>json » par ligne -> { 'AAAA-MM-JJ': totaux }.
export function lireTotaux(texte) {
  const t = {};
  for (const ligne of texte.split('\n')) {
    const i = ligne.indexOf('\t');
    if (i < 0) continue;
    const date = ligne.slice(0, i).trim().replace(/\.json$/, '');
    if (!estDate(date)) continue;
    try {
      const v = JSON.parse(ligne.slice(i + 1));
      if (v && Number.isFinite(v.visiteursUniques) && Number.isFinite(v.pagesVues)) t[date] = v;
    } catch { /* fichier abîmé : jour considéré sans données */ }
  }
  return t;
}
export function lireDossier(dossier) {
  if (!fs.existsSync(dossier)) return {};
  return lireTotaux(fs.readdirSync(dossier).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => `${f}\t${fs.readFileSync(path.join(dossier, f), 'utf8').replace(/\n/g, '')}`).join('\n'));
}

// Somme des totaux quotidiens d'une période.
export function cumuler(totaux, [debut, fin], aujourdhui = null) {
  const jours = joursEntre(debut, fin);
  const r = { debut, fin, visiteursUniques: 0, pagesVues: 0, jours: [], joursSansDonnees: [], pages: {}, sources: {}, appareils: {} };
  for (const d of jours) {
    const t = totaux[d];
    if (!t) { if (!aujourdhui || d < aujourdhui) r.joursSansDonnees.push(d); continue; } // jours à venir : pas encore calculés, pas « manquants »
    r.visiteursUniques += t.visiteursUniques;
    r.pagesVues += t.pagesVues;
    r.jours.push({ date: d, visiteursUniques: t.visiteursUniques, pagesVues: t.pagesVues });
    for (const k of ['pages', 'sources', 'appareils']) for (const [c, v] of Object.entries(t[k] || {})) if (Number.isFinite(v)) r[k][c] = (r[k][c] || 0) + v;
  }
  r.pages = Object.entries(r.pages).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([page, vues]) => ({ page, titre: titrePage(page), vues }));
  return r;
}

const ecart = (a, b) => (b ? `${a >= b ? '+' : '−'}${Math.abs(Math.round((100 * (a - b)) / b))} %` : 'non calculable');
const col = (t, n, droite = false) => (droite ? ` ${t}`.padStart(n) : `${t} `.padEnd(n));

function avertissement(r) {
  if (!r.joursSansDonnees.length || !r.jours.length) return [];
  const n = r.joursSansDonnees.length;
  return [`Attention : pas de totaux pour ${n} jour${n > 1 ? 's' : ''} (${plagesFr(r.joursSansDonnees)}).`,
    `Le total ne porte que sur ${r.jours.length > 1 ? `les ${r.jours.length} jours disponibles` : 'le seul jour disponible'}.`, ''];
}

function vide(r, totaux) {
  const dates = Object.keys(totaux).sort();
  const l = [`Aucune donnée pour cette période (${periodeFr(r.debut, r.fin)}).`];
  if (dates.length) l.push(`La mesure a commencé le ${dateFr(dates[0])}.`);
  else l.push('Aucun total lisible sur le serveur.');
  return l;
}

export function rapport(o, totaux) {
  const r = cumuler(totaux, o.periode, o.aujourdhui);
  if (o.precedente) {
    const p = cumuler(totaux, o.precedente, o.aujourdhui);
    const nom = o.comparer === 'semaine' ? ['Cette semaine', 'Semaine précédente'] : ['Ce mois ci', 'Mois précédent'];
    // Pas de comparaison si une des deux périodes n'a aucune donnée : on n'affiche jamais un 0 inventé.
    const videes = [[r, nom[0]], [p, nom[1]]].filter(([x]) => !x.jours.length);
    if (videes.length) {
      if (o.json) return { code: 1, texte: JSON.stringify({ erreur: 'Aucune donnée pour cette période', periodes: videes.map(([x]) => ({ debut: x.debut, fin: x.fin })) }) };
      const l = videes.map(([x, n]) => `Aucune donnée pour cette période (${n.toLowerCase()}, ${periodeFr(x.debut, x.fin)}).`);
      const dates = Object.keys(totaux).sort();
      l.push(dates.length ? `Comparaison impossible. La mesure a commencé le ${dateFr(dates[0])}.` : 'Comparaison impossible. Aucun total lisible sur le serveur.');
      return { code: 1, texte: l.join('\n') };
    }
    const complet = !r.joursSansDonnees.length && !p.joursSansDonnees.length;
    if (o.json) return { code: 0, texte: JSON.stringify({ periode: r, precedente: p, ecartComparable: complet }, null, 2) };
    const ec = (a, b) => (complet ? ecart(a, b) : 'non calculé');
    const l = [`${nom[0]} (${periodeFr(r.debut, r.fin).replace(/ \d{4}$/, '')}) et ${nom[1].toLowerCase()} (${periodeFr(p.debut, p.fin).replace(/ \d{4}$/, '')})`, ''];
    l.push(`${col('', 18)}${col(nom[0], 16, true)}${col(nom[1], 22, true)}${col('Écart', 16, true)}`);
    l.push(`${col('Visites uniques', 18)}${col(nb(r.visiteursUniques), 16, true)}${col(nb(p.visiteursUniques), 22, true)}${col(ec(r.visiteursUniques, p.visiteursUniques), 16, true)}`);
    l.push(`${col('Pages vues', 18)}${col(nb(r.pagesVues), 16, true)}${col(nb(p.pagesVues), 22, true)}${col(ec(r.pagesVues, p.pagesVues), 16, true)}`);
    l.push('', 'Visites uniques par jour, cumulées.');
    for (const [x, n] of [[r, nom[0]], [p, nom[1]]]) {
      if (x.joursSansDonnees.length) l.push(`Attention : ${n.toLowerCase()}, pas de totaux pour ${x.joursSansDonnees.length} jour${x.joursSansDonnees.length > 1 ? 's' : ''} (${plagesFr(x.joursSansDonnees)}).`);
    }
    if (!complet) l.push("L'écart n'est pas calculé : il manque des jours dans une des deux périodes.");
    return { code: 0, texte: l.join('\n') };
  }
  if (!r.jours.length) {
    return { code: 1, texte: o.json ? JSON.stringify({ erreur: 'Aucune donnée pour cette période', debut: r.debut, fin: r.fin }) : vide(r, totaux).join('\n') };
  }
  if (o.json) return { code: 0, texte: JSON.stringify(r, null, 2) };
  const l = [...avertissement(r)];
  const unJour = r.debut === r.fin;
  l.push(unJour ? `Visiteurs du ${dateFr(r.debut, { semaine: true })}` : `Visiteurs du ${periodeFr(r.debut, r.fin)}`, '');
  if (unJour) {
    l.push(`Visites uniques : ${nb(r.visiteursUniques)}`, `Pages vues : ${nb(r.pagesVues)}`);
  } else {
    l.push(`${col('Jour', 26)}${col('Visites uniques', 16, true)}${col('Pages vues', 12, true)}`);
    for (const j of r.jours) l.push(`${col(dateFr(j.date, { annee: false, semaine: true }), 26)}${col(nb(j.visiteursUniques), 16, true)}${col(nb(j.pagesVues), 12, true)}`);
    l.push('', `Total de la période : ${nb(r.visiteursUniques)} visites uniques (visites uniques par jour, cumulées)`, `Pages vues : ${nb(r.pagesVues)}`);
  }
  if (r.pages.length) {
    l.push('', 'Pages les plus lues');
    const top = r.pages.slice(0, 10);
    const large = Math.max(...top.map((p) => p.titre.length)) + 4;
    top.forEach((p, i) => l.push(`${String(i + 1).padStart(2)}. ${col(p.titre, large)}${col(nb(p.vues), 8, true)}`));
  }
  const s = r.sources;
  const totS = Object.values(s).reduce((a, b) => a + b, 0);
  if (totS) {
    const morceaux = [['recherche', 'moteur de recherche'], ['social', 'réseau social'], ['autre', 'autre site'], ['direct', 'accès direct']]
      .filter(([k]) => s[k]).map(([k, t]) => `${t} ${pc(s[k], totS)} %`);
    l.push('', `Sources de visite : ${morceaux.join(', ')}`);
  }
  const a = r.appareils;
  const totA = (a.telephone || 0) + (a.ordinateur || 0);
  if (totA) l.push(`${totS ? '' : '\n'}Appareil : téléphone ou tablette ${pc(a.telephone || 0, totA)} %, ordinateur ${pc(a.ordinateur || 0, totA)} %`);
  return { code: 0, texte: l.join('\n') };
}

export function principal(argv, entree, aujourdhui = new Date().toISOString().slice(0, 10)) {
  const o = lireArguments(argv, aujourdhui);
  if (o.erreur) return { code: 1, texte: o.erreur };
  if (o.verifier) {
    const [d, f] = o.precedente ? [o.precedente[0], o.periode[1]] : o.periode;
    return { code: 0, texte: '', info: `Lecture des totaux ${d === f ? `du ${dateFr(d)}` : `du ${periodeFr(d, f)}`}…` };
  }
  const totaux = o.dossier ? lireDossier(o.dossier) : lireTotaux(entree());
  return rapport(o, totaux);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const res = principal(argv, () => { try { return fs.readFileSync(0, 'utf8'); } catch { return ''; } });
  if (res.info) process.stderr.write(`${res.info}\n`);
  if (res.texte) process.stdout.write(`${res.texte}\n`);
  process.exitCode = res.code;
}
