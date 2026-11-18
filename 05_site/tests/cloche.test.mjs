// Tests de la cloche des nouveautés et de la page nouveautes.html (ticket 90).
// Le site est généré dans un dossier temporaire avec des journaux de test.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { copierSite, generer, lire, ecrire, SITE } from './outils.mjs';

let tmp, fj, candidats;
const SOURCE = { titre: 'LCP, liste des candidats', url: 'https://lcp.fr/actualites/exemple', date: '2026-11-18' };
const VIDE = 'Aucun nouveau candidat ni nouveau programme lors de la dernière mise à jour.';
const pop = (html) => html.match(/<div class="cloche-pop"[\s\S]*?<\/div>\n<\/div>/)?.[0] || '';

before(() => {
  tmp = copierSite();
  fj = path.join(tmp, '05_site/data/nouveautes.json');
  const dossier = path.join(tmp, '05_site/data/candidats');
  candidats = fs.readdirSync(dossier).map((f) => lire(path.join(dossier, f))).filter((c) => c.statut_publie !== false);
});
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test('la cloche est dans l\'en-tête de toutes les pages générées, à côté de la navigation', () => {
  ecrire(fj, [{ date: '2026-11-19', nouveautes: [] }]);
  for (const options of [[], ['--preprod']]) {
    const pages = generer(tmp, ...options);
    assert.ok(Object.keys(pages).length > 50);
    for (const [f, html] of Object.entries(pages)) {
      assert.match(html, /<\/nav>\n<div class="cloche"[^>]*>[\s\S]*?<\/div>\n<\/div>\n<\/header>/, f);
      assert.equal(html.match(/class="cloche"/g).length, 1, f);
      assert.match(html, /<script src="app\.js" defer><\/script>/, f);
      assert.match(html, /classList\.add\('js'\)/, f);
    }
  }
});

test('accessibilité : bouton avec libellé, aria-controls vers un dialog titré, lien sans JavaScript', () => {
  ecrire(fj, [{ date: '2026-11-19', nouveautes: [] }]);
  const { 'index.html': html } = generer(tmp);
  assert.match(html, /<button class="cloche-btn cloche-js" type="button" aria-label="Nouveautés" aria-expanded="false" aria-controls="cloche-pop">/);
  assert.match(html, /<div class="cloche-pop" id="cloche-pop" role="dialog" aria-labelledby="cloche-titre" tabindex="-1" hidden>/);
  assert.match(html, /<h2 id="cloche-titre">Nouveautés<\/h2>/);
  assert.match(html, /<a class="cloche-btn cloche-lien" href="nouveautes\.html" aria-label="Nouveautés">/);
  assert.match(html, /<button class="fermer" type="button">Fermer<\/button>/);
  const css = fs.readFileSync(path.join(tmp, '05_site/public/style.css'), 'utf8');
  assert.match(css, /\.cloche-js\{display:none\}/);
  assert.match(css, /\.js \.cloche-lien\{display:none\}/);
  assert.match(css, /\.cloche-btn:focus-visible\{outline:3px solid var\(--accent\)/);
});

test('sans nouveauté : message vide et date de la dernière mise à jour', () => {
  ecrire(fj, [{ date: '2026-11-16', nouveautes: [{ type: 'candidat_declare', candidat: 'riner_teddy', phrase: 'x', source: SOURCE }] }, { date: '2026-11-19', nouveautes: [] }]);
  const { 'themes.html': html } = generer(tmp);
  const p = pop(html);
  assert.match(p, /Mise à jour du 19 novembre 2026/);
  assert.ok(p.includes(VIDE));
  assert.equal(p.includes('riner'), false); // seule la dernière mise à jour est dans la cloche
  assert.match(html, /data-maj="2026-11-19" data-nb="0"/);
});

test('avec nouveautés : phrases du gabarit avec lien vers la fiche du candidat', () => {
  ecrire(fj, [{ date: '2026-11-19', nouveautes: [
    { type: 'candidat_declare', candidat: 'riner_teddy', phrase: 'Teddy Riner (Sans parti) a déclaré sa candidature.', source: SOURCE },
    { type: 'programme_publie', candidat: 'attal_gabriel', phrase: 'Gabriel Attal (Renaissance) a publié son programme.', source: SOURCE },
  ] }]);
  const { 'candidats.html': html } = generer(tmp);
  const p = pop(html);
  assert.match(p, /<li><span class="ico" aria-hidden="true">🗳️<\/span><span><a href="candidat-riner_teddy\.html">Teddy Riner \(Sans parti\)<\/a> a déclaré sa candidature\.<\/span><\/li>/);
  assert.match(p, /<a href="candidat-attal_gabriel\.html">Gabriel Attal \(Renaissance\)<\/a> a publié son programme\./);
  assert.equal(p.includes(VIDE), false);
  assert.match(html, /data-maj="2026-11-19" data-nb="2"/);
});

test('les phrases sont identiques pour tous les candidats (même gabarit, sans adjectif)', () => {
  const types = { candidat_declare: 'a déclaré sa candidature.', programme_publie: 'a publié son programme.' };
  for (const [type, fin] of Object.entries(types)) {
    ecrire(fj, [{ date: '2026-11-19', nouveautes: candidats.map((c) => ({ type, candidat: c.id, phrase: '', source: SOURCE })) }]);
    const { 'index.html': html } = generer(tmp);
    const lignes = [...pop(html).matchAll(/<li><span class="ico"[^>]*>[^<]*<\/span><span>([\s\S]*?)<\/span><\/li>/g)].map((m) => m[1]);
    assert.equal(lignes.length, candidats.length);
    for (const c of candidats) {
      const lib = `${c.prenom} ${c.nom} (${c.parti || 'Sans parti'})`.replace(/[&<>"']/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]));
      assert.ok(lignes.includes(`<a href="candidat-${c.id}.html">${lib}</a> ${fin}`), c.id);
    }
    // Même structure pour tous : seule la partie « Prénom Nom (parti) » change
    assert.equal(new Set(lignes.map((l) => l.replace(/<a [^>]*>[^<]*<\/a>/, 'X'))).size, 1);
  }
});

test('une phrase stockée différente du gabarit n\'est jamais affichée', () => {
  ecrire(fj, [{ date: '2026-11-19', nouveautes: [{ type: 'candidat_declare', candidat: 'riner_teddy', phrase: 'Le célèbre Teddy Riner a enfin déclaré sa candidature !', source: SOURCE }] }]);
  const { 'index.html': html } = generer(tmp);
  assert.equal(html.includes('célèbre'), false);
  assert.match(pop(html), /Teddy Riner \(Sans parti\)<\/a> a déclaré sa candidature\./);
});

test('journal absent ou illisible : encadré d\'erreur, le site se génère quand même', () => {
  for (const contenu of [null, '{ pas du json', '{"date":"2026-11-19"}']) {
    if (contenu === null) fs.rmSync(fj, { force: true }); else fs.writeFileSync(fj, contenu);
    const { 'index.html': html, 'nouveautes.html': page } = generer(tmp);
    assert.match(pop(html), /<p class="erreur-encadre" role="status">Les nouveautés ne peuvent pas s'afficher pour le moment\. Elles restent consultables sur la page des mises à jour\.<\/p>/);
    assert.match(page, /erreur-encadre/);
  }
});

test('page nouveautes.html : historique complet, le plus récent en haut, sources, mise à jour vide listée', () => {
  ecrire(fj, [
    { date: '2026-11-12', nouveautes: [{ type: 'candidat_declare', candidat: 'riner_teddy', phrase: '', source: SOURCE }] },
    { date: '2026-11-19', nouveautes: [{ type: 'programme_publie', candidat: 'attal_gabriel', phrase: '', source: SOURCE }] },
    { date: '2026-11-16', nouveautes: [] },
  ]);
  const { 'nouveautes.html': html } = generer(tmp);
  assert.match(html, /<h1>Mises à jour <span aria-hidden="true">🔔<\/span><\/h1>/);
  assert.match(html, /Chaque lundi et chaque jeudi à 9h, toutes les fiches sont vérifiées\./);
  const dates = [...html.matchAll(/<h3>Mise à jour du ([^<]+)<\/h3>/g)].map((m) => m[1]);
  assert.deepEqual(dates, ['19 novembre 2026', '16 novembre 2026', '12 novembre 2026']);
  assert.match(html, /Aucun nouveau candidat ni nouveau programme lors de cette mise à jour\./);
  assert.match(html, /<a class="lnk" href="candidat-riner_teddy\.html">Teddy Riner \(Sans parti\)<\/a> a déclaré sa candidature\. <span class="src">Source : <a class="lnk" href="https:\/\/lcp\.fr\/actualites\/exemple"/);
});

test('pied de page : date de dernière vérification de toutes les fiches et lien vers les mises à jour', () => {
  ecrire(fj, [{ date: '2026-11-19', nouveautes: [] }]);
  const mesures = path.join(tmp, '05_site/data/mesures');
  const sauvegarde = Object.fromEntries(fs.readdirSync(mesures).map((f) => [f, fs.readFileSync(path.join(mesures, f), 'utf8')]));
  try {
    for (const f of fs.readdirSync(mesures)) { const m = lire(path.join(mesures, f)); m.date_verif = '2026-11-19'; ecrire(path.join(mesures, f), m); }
    // Une fiche dont la vérification a échoué garde son ancienne date : le pied de page affiche la plus ancienne
    const r = lire(path.join(mesures, 'riner_teddy.json')); r.date_verif = '2026-11-16'; ecrire(path.join(mesures, 'riner_teddy.json'), r);
    const pages = generer(tmp);
    assert.match(pages['index.html'], /Dernière vérification de toutes les fiches : 16 novembre 2026\./);
    assert.match(pages['index.html'], /<a class="lnk" href="nouveautes\.html">Mises à jour<\/a>/);
    assert.equal(pages['index.html'].includes('Dernière mise à jour du site'), false);
    assert.match(pages['candidat-riner_teddy.html'], /Dernière vérification : 16 novembre 2026\./);
    assert.match(pages['candidat-attal_gabriel.html'], /Dernière vérification : 19 novembre 2026\./);
    assert.match(pages['education.html'], /Propositions vérifiées le 16 novembre 2026\./);
  } finally {
    for (const [f, t] of Object.entries(sauvegarde)) fs.writeFileSync(path.join(mesures, f), t);
  }
});

test('aucun cookie : ni dans les pages, ni dans le script, ni dans la configuration du serveur', () => {
  ecrire(fj, [{ date: '2026-11-19', nouveautes: [] }]);
  const pages = generer(tmp);
  for (const [f, html] of Object.entries(pages)) assert.equal(/document\.cookie|set-cookie/i.test(html), false, f);
  const app = fs.readFileSync(path.join(SITE, 'src/app.js'), 'utf8');
  assert.equal(/document\.cookie/.test(app), false);
  assert.match(app, /localStorage/);
  for (const f of ['nginx.preprod.conf', 'nginx.prod.conf']) assert.equal(/cookie/i.test(fs.readFileSync(path.join(SITE, 'deploy', f), 'utf8')), false, f);
});
