// Tests de la partie mécanique de la mise à jour (ticket 90) : moment du déclenchement, dates, journal.
// Lancement : npm test (depuis 05_site)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  estMomentDeMaj, heureDeParis, phrase, preparerMaj, appliquer, remplacerDateJSON, remplacerDateMarkdown,
  squeletteMesures, lireJournal, texteRapport, THEMES_SLUGS,
} from '../maj/lib.mjs';
import { copierSite, lire, ecrire, SITE } from './outils.mjs';

const RUN = '2026-11-19';
// Date des runs complets : postérieure à toutes les dates des données réelles (sinon preparerMaj refuse le run).
const RUN_MAJ = '2099-01-05';
const RUN_MAJ_FR = '5 janvier 2099';
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const dateFr = (d) => { const [a, m, j] = d.split('-').map(Number); return `${j === 1 ? '1er' : j} ${MOIS[m - 1]} ${a}`; };
const SOURCE = { titre: 'LCP, liste des candidats', url: 'https://lcp.fr/actualites/exemple', date: '2026-11-18' };

// ---------- Déclenchement ----------
test('moment : lundi et jeudi à 9h à Paris, en heure d\'hiver (UTC+1)', () => {
  assert.equal(estMomentDeMaj(new Date('2026-11-19T08:00:00Z')), true); // jeudi 9h00 Paris
  assert.equal(estMomentDeMaj(new Date('2026-11-23T08:30:00Z')), true); // lundi 9h30 Paris
  assert.equal(estMomentDeMaj(new Date('2026-11-19T07:00:00Z')), false); // jeudi 8h Paris
  assert.equal(estMomentDeMaj(new Date('2026-11-19T09:00:00Z')), false); // jeudi 10h Paris
  assert.equal(estMomentDeMaj(new Date('2026-11-18T08:00:00Z')), false); // mercredi
});

test('moment : en heure d\'été (UTC+2), seul le déclenchement de 7h UTC passe', () => {
  assert.equal(estMomentDeMaj(new Date('2027-06-07T07:00:00Z')), true); // lundi 9h Paris
  assert.equal(estMomentDeMaj(new Date('2027-06-07T08:00:00Z')), false); // lundi 10h Paris
});

test('moment : un seul des deux déclenchements (7h et 8h UTC) passe chaque lundi et jeudi de l\'année', () => {
  for (let j = 0; j < 366; j++) {
    const jour = new Date(Date.UTC(2027, 0, 1 + j));
    if (![1, 4].includes(jour.getUTCDay())) continue;
    const passes = [7, 8].filter((h) => estMomentDeMaj(new Date(Date.UTC(2027, 0, 1 + j, h)))).length;
    assert.equal(passes, 1, jour.toISOString());
  }
  // Jours de changement d'heure : dimanche 28 mars et dimanche 31 octobre 2027, puis lundi suivant
  assert.equal(estMomentDeMaj(new Date('2027-03-29T07:00:00Z')), true);
  assert.equal(estMomentDeMaj(new Date('2027-11-01T08:00:00Z')), true);
});

test('moment : la garde horaire renvoie 0 au bon moment, 3 sinon', () => {
  const ok = spawnSync(process.execPath, ['maj/moment.mjs', '--instant', '2026-11-19T08:05:00Z'], { cwd: SITE });
  const non = spawnSync(process.execPath, ['maj/moment.mjs', '--instant', '2026-11-19T07:05:00Z'], { cwd: SITE });
  assert.equal(ok.status, 0);
  assert.equal(non.status, 3);
  assert.equal(heureDeParis(new Date('2026-11-19T08:05:00Z')).date, RUN);
});

test('aucune clé ANTHROPIC_API_KEY ni appel à l\'API Claude dans le code de la mise à jour', () => {
  for (const f of fs.readdirSync(path.join(SITE, 'maj'))) {
    const t = fs.readFileSync(path.join(SITE, 'maj', f), 'utf8');
    assert.equal(/api\.anthropic\.com|@anthropic-ai/.test(t), false, f);
    if (f.endsWith('.mjs')) assert.equal(t.includes('ANTHROPIC_API_KEY'), false, f);
  }
});

// ---------- Phrases ----------
test('phrases : un gabarit unique, sans adjectif, identique pour tous', () => {
  assert.equal(phrase('candidat_declare', { prenom: 'Claire', nom: 'Fontaine', parti: 'Mouvement des communes' }), 'Claire Fontaine (Mouvement des communes) a déclaré sa candidature.');
  assert.equal(phrase('programme_publie', { prenom: 'Paul', nom: 'Mercier', parti: 'Union citoyenne' }), 'Paul Mercier (Union citoyenne) a publié son programme.');
  assert.equal(phrase('candidat_retire', { prenom: 'Paul', nom: 'Mercier', parti: null }), 'Paul Mercier (Sans parti) a retiré sa candidature.');
  assert.throws(() => phrase('mesure_ajoutee', { prenom: 'A', nom: 'B' }));
});

// ---------- Remplacement des dates ----------
test('dates : seule la clé de premier niveau change, la mise en forme est gardée', () => {
  const texte = '{\n  "id": "x",\n  "date_verif": "2026-11-09",\n  "themes": { "travail": [ { "viabilite": { "date_verif": "2026-11-09" } } ] }\n}\n';
  const r = remplacerDateJSON(texte, 'date_verif', RUN);
  assert.equal(r, texte.replace('"date_verif": "2026-11-09",', `"date_verif": "${RUN}",`));
  assert.equal(JSON.parse(r).themes.travail[0].viabilite.date_verif, '2026-11-09');
  const ligne = '{"id":"y","date_verif":"2026-11-16","themes":{}}';
  assert.equal(remplacerDateJSON(ligne, 'date_verif', RUN), `{"id":"y","date_verif":"${RUN}","themes":{}}`);
  assert.equal(remplacerDateMarkdown('# Liste\n\nOrdre alphabétique. Vérifié le 2026-11-16 (recherche web).', RUN), `# Liste\n\nOrdre alphabétique. Vérifié le ${RUN} (recherche web).`);
  assert.equal(remplacerDateMarkdown('Consulté le 2026-11-16, à revérifier.', RUN), `Consulté le ${RUN}, à revérifier.`);
});

test('squelette d\'un nouveau candidat : les 10 thèmes sont présents', () => {
  const m = squeletteMesures('nouveau_candidat', RUN);
  assert.deepEqual(Object.keys(m.themes), THEMES_SLUGS);
  assert.equal(m.date_verif, RUN);
});

// ---------- Run complet ----------
test('run sans changement : toutes les fiches vérifiées portent la date du jour et une entrée vide est ajoutée', () => {
  const tmp = copierSite();
  try {
    const avant = lire(path.join(tmp, '05_site/data/candidats/attal_gabriel.json'));
    const { ecritures, rapport } = preparerMaj({ racine: tmp, date: RUN_MAJ });
    appliquer(ecritures);
    for (const f of fs.readdirSync(path.join(tmp, '05_site/data/mesures'))) assert.equal(lire(path.join(tmp, '05_site/data/mesures', f)).date_verif, RUN_MAJ, f);
    for (const f of fs.readdirSync(path.join(tmp, '05_site/data/candidats'))) assert.equal(lire(path.join(tmp, '05_site/data/candidats', f)).date_maj, RUN_MAJ, f);
    const apres = lire(path.join(tmp, '05_site/data/candidats/attal_gabriel.json'));
    assert.deepEqual({ ...apres, date_maj: avant.date_maj }, avant); // rien d'autre n'a changé
    assert.match(fs.readFileSync(path.join(tmp, '01_candidats/00_liste_candidats.md'), 'utf8'), new RegExp(`Vérifié le ${RUN_MAJ}`));
    assert.match(fs.readFileSync(path.join(tmp, '01_candidats/00_pretendants_non_declares.md'), 'utf8'), new RegExp(`Consulté le ${RUN_MAJ}`));
    const j = lire(path.join(tmp, '05_site/data/nouveautes.json'));
    assert.deepEqual(j[0], { date: RUN_MAJ, nouveautes: [] });
    assert.equal(rapport.verifies, rapport.total);
    assert.match(texteRapport(rapport), /Nouveautés : aucune/);
    assert.equal(fs.readdirSync(path.join(tmp, '05_site/data/candidats')).some((f) => f.includes('maj-tmp')), false);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('source inaccessible : la fiche garde son ancienne date et le rapport la signale', () => {
  const tmp = copierSite();
  try {
    const ancienne = lire(path.join(tmp, '05_site/data/mesures/riner_teddy.json')).date_verif;
    const ancienneC = lire(path.join(tmp, '05_site/data/candidats/riner_teddy.json')).date_maj;
    const { ecritures, rapport } = preparerMaj({ racine: tmp, date: RUN_MAJ, echecs: ['riner_teddy'] });
    appliquer(ecritures);
    assert.equal(lire(path.join(tmp, '05_site/data/mesures/riner_teddy.json')).date_verif, ancienne);
    assert.equal(lire(path.join(tmp, '05_site/data/candidats/riner_teddy.json')).date_maj, ancienneC);
    assert.equal(lire(path.join(tmp, '05_site/data/mesures/attal_gabriel.json')).date_verif, RUN_MAJ);
    assert.equal(rapport.verifies, rapport.total - 1);
    assert.match(texteRapport(rapport), new RegExp(`Vérification échouée : riner_teddy \\(date gardée au ${dateFr(ancienne)}\\)`));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('nouveautés : phrase du gabarit, source obligatoire, programme_publie exige le champ programme', () => {
  const tmp = copierSite();
  try {
    const fc = path.join(tmp, '05_site/data/candidats/riner_teddy.json');
    const nouv = [{ type: 'candidat_declare', candidat: 'riner_teddy', source: SOURCE }];
    const { ecritures } = preparerMaj({ racine: tmp, date: RUN_MAJ, nouveautes: nouv });
    appliquer(ecritures);
    const j = lire(path.join(tmp, '05_site/data/nouveautes.json'));
    assert.equal(j[0].nouveautes[0].phrase, 'Teddy Riner (Sans parti) a déclaré sa candidature.');
    assert.deepEqual(j[0].nouveautes[0].source, SOURCE);
    // Programme non rempli : refusé
    assert.throws(() => preparerMaj({ racine: tmp, date: RUN_MAJ, nouveautes: [{ type: 'programme_publie', candidat: 'riner_teddy', source: SOURCE }] }), /programme_publie sans champ programme/);
    // Programme rempli : accepté
    const c = lire(fc); c.programme = { titre: 'Programme 2027', url: 'https://exemple.fr/programme', date: '2026-11-22', type: 'page web' }; ecrire(fc, c);
    const r = preparerMaj({ racine: tmp, date: RUN_MAJ, nouveautes: [{ type: 'programme_publie', candidat: 'riner_teddy', source: SOURCE }] });
    assert.deepEqual(r.rapport.nouveautes, ['Teddy Riner (Sans parti) a publié son programme.']);
    // Sans source : refusé ; type de petite mesure : refusé
    assert.throws(() => preparerMaj({ racine: tmp, date: RUN_MAJ, nouveautes: [{ type: 'candidat_declare', candidat: 'riner_teddy', source: {} }] }), /source sans lien/);
    assert.throws(() => preparerMaj({ racine: tmp, date: RUN_MAJ, nouveautes: [{ type: 'mesure_ajoutee', candidat: 'riner_teddy', source: SOURCE }] }), /type inconnu/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('journal : la plus récente en premier, un second run le même jour remplace l\'entrée', () => {
  const tmp = copierSite();
  try {
    const fj = path.join(tmp, '05_site/data/nouveautes.json');
    ecrire(fj, [{ date: '2026-11-16', nouveautes: [] }]);
    appliquer(preparerMaj({ racine: tmp, date: RUN_MAJ }).ecritures);
    appliquer(preparerMaj({ racine: tmp, date: RUN_MAJ, nouveautes: [{ type: 'candidat_declare', candidat: 'riner_teddy', source: SOURCE }] }).ecritures);
    const j = lireJournal(fj);
    assert.deepEqual(j.entrees.map((e) => e.date), [RUN_MAJ, '2026-11-16']);
    assert.equal(j.entrees[0].nouveautes.length, 1);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('échec en cours de run : rien n\'est écrit, aucune date ne change', () => {
  const tmp = copierSite();
  try {
    const instantane = () => Object.fromEntries(['candidats', 'mesures'].flatMap((d) => fs.readdirSync(path.join(tmp, '05_site/data', d)).map((f) => [`${d}/${f}`, fs.readFileSync(path.join(tmp, '05_site/data', d, f), 'utf8')])));
    const avant = instantane();
    const journal = fs.readFileSync(path.join(tmp, '05_site/data/nouveautes.json'), 'utf8');
    const liste = fs.readFileSync(path.join(tmp, '01_candidats/00_liste_candidats.md'), 'utf8');
    // Candidat inconnu, nouveauté invalide, date invalide : la préparation échoue avant toute écriture
    assert.throws(() => preparerMaj({ racine: tmp, date: RUN_MAJ, echecs: ['inconnu'] }));
    assert.throws(() => preparerMaj({ racine: tmp, date: RUN_MAJ, nouveautes: [{ type: 'candidat_declare', candidat: 'personne', source: SOURCE }] }));
    assert.throws(() => preparerMaj({ racine: tmp, date: '19/11/2026' }));
    // Par le script en ligne de commande : code 1 et aucun fichier modifié
    const f = path.join(tmp, 'nouv.json');
    fs.writeFileSync(f, JSON.stringify([{ type: 'candidat_declare', candidat: 'riner_teddy', source: {} }]));
    const r = spawnSync(process.execPath, ['maj/maj.mjs', '--date', RUN_MAJ, '--nouveautes', f, '--sans-build'], { cwd: path.join(tmp, '05_site'), encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Rien n'a été écrit, aucune date n'a changé/);
    assert.deepEqual(instantane(), avant);
    assert.equal(fs.readFileSync(path.join(tmp, '05_site/data/nouveautes.json'), 'utf8'), journal);
    assert.equal(fs.readFileSync(path.join(tmp, '01_candidats/00_liste_candidats.md'), 'utf8'), liste);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('script en ligne de commande : run complet, régénération et rapport', () => {
  const tmp = copierSite();
  try {
    const out = execFileSync(process.execPath, ['maj/maj.mjs', '--date', RUN_MAJ], { cwd: path.join(tmp, '05_site'), encoding: 'utf8' });
    assert.match(out, new RegExp(`Mise à jour du ${RUN_MAJ_FR}`));
    assert.match(out, /Fiches vérifiées : (\d+) sur \1\n/);
    const html = fs.readFileSync(path.join(tmp, '05_site/public/index.html'), 'utf8');
    assert.match(html, new RegExp(`Dernière vérification de toutes les fiches : ${RUN_MAJ_FR}\\.`));
    assert.match(html, /Aucun nouveau candidat ni nouveau programme lors de la dernière mise à jour\./);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('contradiction : un candidat a_verifier est listé dans le rapport, avec la contradiction', () => {
  const tmp = copierSite();
  try {
    const { rapport } = preparerMaj({ racine: tmp, date: RUN_MAJ });
    const t = texteRapport(rapport, { contradictions: ['Candidature de X : déclarée selon LCP, démentie par Public Sénat.'] });
    assert.ok(rapport.a_verifier.length > 0);
    assert.match(t, /Contradictions : Candidature de X/);
    assert.match(t, /Candidatures à confirmer \(a_verifier\) : /);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
