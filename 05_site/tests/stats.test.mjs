// Ticket 95 : mesure d'audience sans cookie (agrégation des journaux Nginx, commande de consultation, textes du site).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SITE, copierSite, generer } from './outils.mjs';
import { agreger, lireLigne, pageDuSite, estRobot, sourceDe, nettoyer, principal as agregerCli } from '../stats/agreger.mjs';
import { lireArguments, cumuler, rapport, principal as visiteursCli } from '../stats/visiteurs.mjs';

const SEL = Buffer.from('sel-de-test');
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const ligne = (o) => JSON.stringify({ date: '2026-11-24T10:00:00+00:00', ip: '203.0.113.1', methode: 'GET', page: '/', statut: 200, ua: CHROME, ref: '', dnt: '', gpc: '', ...o });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'stats-'));
const D = '2026-11-24';

// ---------- Agrégation ----------

test('critère 1 : 3 visiteurs distincts qui voient chacun 2 pages = 3 visiteurs uniques et 6 pages vues', () => {
  const lignes = [];
  for (const [ip, ua] of [['203.0.113.1', CHROME], ['203.0.113.2', CHROME], ['203.0.113.1', FIREFOX]]) {
    lignes.push(ligne({ ip, ua, page: '/index.html' }), ligne({ ip, ua, page: '/sante.html' }));
  }
  const r = agreger(lignes, { date: D, sel: SEL });
  assert.equal(r.visiteursUniques, 3);
  assert.equal(r.pagesVues, 6);
  assert.deepEqual(r.pages, { '/': 3, '/sante.html': 3 });
});

test('critère 2 : même adresse et même navigateur, 5 pages = 1 visiteur unique et 5 pages vues', () => {
  const pages = ['/', '/sante', '/methode.html', '/candidat-attal_gabriel.html', '/sante.html'];
  const r = agreger(pages.map((page) => ligne({ page })), { date: D, sel: SEL });
  assert.equal(r.visiteursUniques, 1);
  assert.equal(r.pagesVues, 5);
  assert.equal(r.pages['/sante.html'], 2, "« /sante » et « /sante.html » sont la même page");
});

test('critère 3 : fichiers techniques, robots et erreurs ne sont pas comptés', () => {
  const lignes = [
    ligne({ page: '/style.css' }), ligne({ page: '/fonts/public-sans.woff2' }), ligne({ page: '/robots.txt' }),
    ligne({ page: '/sitemap.xml' }), ligne({ page: '/version.txt', ua: 'spec-to-prod' }), ligne({ page: '/app.js' }),
    ligne({ page: '/img/photo.jpg' }),
    ligne({ ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }),
    ligne({ ua: 'Mozilla/5.0 (compatible; bingbot/2.0)' }), ligne({ ua: 'curl/8.5.0' }), ligne({ ua: 'spec-to-prod' }),
    ligne({ ua: 'Mozilla/5.0+(compatible; UptimeRobot/2.0)' }), ligne({ ua: '' }), ligne({ ua: '-' }),
    ligne({ page: '/introuvable', statut: 404 }), ligne({ statut: 500 }), ligne({ statut: 301 }),
    ligne({ methode: 'HEAD' }), ligne({ methode: 'POST' }),
  ];
  const r = agreger(lignes, { date: D, sel: SEL });
  assert.equal(r.visiteursUniques, 0);
  assert.equal(r.pagesVues, 0);
  assert.deepEqual(r.exclues, { techniques: 9, robots: 7, erreurs: 3, nePasSuivre: 0 });
  assert.deepEqual(r.pages, {});
});

test('une page en 304 (déjà en cache) est comptée, une 404 non', () => {
  const r = agreger([ligne({ statut: 304 }), ligne({ statut: 404, ip: '203.0.113.9' })], { date: D, sel: SEL });
  assert.equal(r.pagesVues, 1);
  assert.equal(r.exclues.erreurs, 1);
});

test('« ne pas suivre » : les navigateurs avec DNT: 1 ou Sec-GPC: 1 ne sont pas comptés', () => {
  const r = agreger([ligne({ dnt: '1' }), ligne({ gpc: '1', ip: '203.0.113.5' }), ligne({ dnt: '0', ip: '203.0.113.6' })], { date: D, sel: SEL });
  assert.equal(r.visiteursUniques, 1);
  assert.equal(r.exclues.nePasSuivre, 2);
});

test('critère 9 : les lignes mal formées sont ignorées, comptées et les autres lignes comptées', () => {
  const lignes = [ligne({}), 'pas du json', '{"ip":"1.2.3.4"', '{"page":"/","statut":200}', '{"ip":"1.2.3.4","page":"/","statut":"abc"}', '[]', 'null', ligne({ ip: '203.0.113.2' })];
  const r = agreger(lignes, { date: D, sel: SEL });
  assert.equal(r.lignesIgnorees, 6);
  assert.equal(r.lignesLues, 8);
  assert.equal(r.visiteursUniques, 2);
  assert.equal(r.pagesVues, 2);
});

test('journal vide : totaux à zéro', () => {
  const r = agreger(['', ''], { date: D, sel: SEL });
  assert.equal(r.lignesLues, 0);
  assert.equal(r.visiteursUniques, 0);
  assert.equal(r.pagesVues, 0);
});

test("empreinte : le sel change, les totaux non ; aucune adresse ni navigateur dans les totaux", () => {
  const lignes = [ligne({ ip: '198.51.100.77' }), ligne({ ip: '198.51.100.78', ua: IPHONE })];
  const a = agreger(lignes, { date: D, sel: Buffer.from('a') });
  const b = agreger(lignes, { date: D, sel: Buffer.from('b') });
  assert.deepEqual(a, b);
  const texte = JSON.stringify(a);
  assert.equal(/198\.51\.100|Mozilla|iPhone|[0-9a-f]{64}/.test(texte), false);
});

test('sources de visite et appareils : domaine du référent seulement, deux catégories d\'appareil', () => {
  const lignes = [
    ligne({ ip: '1.1.1.1', ref: 'www.google.fr' }), ligne({ ip: '1.1.1.1', ref: 'demandez-le-programme.fr', page: '/sante.html' }),
    ligne({ ip: '2.2.2.2', ref: 'l.facebook.com', ua: IPHONE }), ligne({ ip: '3.3.3.3', ref: 't.co' }),
    ligne({ ip: '4.4.4.4' }), ligne({ ip: '5.5.5.5', ref: 'www.lemonde.fr' }), ligne({ ip: '6.6.6.6', ref: 'duckduckgo.com', ua: IPHONE }),
  ];
  const r = agreger(lignes, { date: D, sel: SEL });
  assert.deepEqual(r.sources, { recherche: 2, social: 2, autre: 1, direct: 1 });
  assert.deepEqual(r.appareils, { telephone: 2, ordinateur: 4 });
});

test('petits outils : lecture de ligne, page du site, robots, sources', () => {
  assert.equal(lireLigne('nope'), null);
  assert.equal(pageDuSite('/index.html'), '/');
  assert.equal(pageDuSite('/sante'), '/sante.html');
  assert.equal(pageDuSite('/robots.txt'), null);
  assert.equal(pageDuSite('/fonts/x.woff2'), null);
  assert.equal(estRobot('Mozilla/5.0 (compatible; YandexBot/3.0)'), true);
  assert.equal(estRobot(FIREFOX), false);
  assert.equal(estRobot(IPHONE), false);
  assert.equal(sourceDe(''), null);
  assert.equal(sourceDe('preprod.demandez-le-programme.fr'), null);
  assert.equal(sourceDe('www.qwant.com'), 'recherche');
  assert.equal(sourceDe('www.linkedin.com'), 'social');
});

test('commande d\'agrégation : écrit le fichier du jour, signale les lignes ignorées et supprime le sel', () => {
  const d = tmp();
  const j = path.join(d, 'logs');
  const s = path.join(d, 'stats');
  fs.mkdirSync(j);
  fs.writeFileSync(path.join(j, `acces-${D}.log`), [ligne({}), ligne({ page: '/style.css' }), 'abîmée', ligne({ ip: '203.0.113.2' })].join('\n') + '\n');
  const sortie = [];
  const code = agregerCli(['--journaux', j, '--stats', s, '--date', D, '--aujourdhui', '2026-11-25'], { ecrire: (t) => sortie.push(t) });
  assert.equal(code, 0);
  const r = JSON.parse(fs.readFileSync(path.join(s, `${D}.json`), 'utf8'));
  for (const k of ['date', 'visiteursUniques', 'pagesVues', 'pages', 'sources', 'appareils', 'lignesIgnorees']) assert.ok(k in r, k);
  assert.equal(r.visiteursUniques, 2);
  assert.equal(r.lignesIgnorees, 1);
  const texte = sortie.join('\n');
  assert.match(texte, /Totaux du 24 novembre 2026 écrits\./);
  assert.match(texte, /1 ligne mal formée ignorée\./);
  assert.match(texte, /Sel du jour supprimé\./);
  fs.rmSync(d, { recursive: true, force: true });
});

test("commande d'agrégation : journal vide = fichier à 0, journal introuvable = code 1 sans fichier", () => {
  const d = tmp();
  const j = path.join(d, 'logs');
  const s = path.join(d, 'stats');
  fs.mkdirSync(j);
  fs.writeFileSync(path.join(j, `acces-${D}.log`), '');
  const sortie = [];
  assert.equal(agregerCli(['--journaux', j, '--stats', s, '--date', D], { ecrire: (t) => sortie.push(t) }), 0);
  assert.equal(JSON.parse(fs.readFileSync(path.join(s, `${D}.json`), 'utf8')).visiteursUniques, 0);
  assert.match(sortie.join('\n'), /Aucune visite le 24 novembre 2026\.\nFichier écrit avec 0 visite unique et 0 page vue\./);
  sortie.length = 0;
  assert.equal(agregerCli(['--journaux', j, '--stats', s, '--date', '2026-11-23'], { ecrire: (t) => sortie.push(t) }), 1);
  assert.equal(fs.existsSync(path.join(s, '2026-11-23.json')), false);
  assert.match(sortie.join('\n'), /Journal du 23 novembre 2026 introuvable\./);
  assert.equal(agregerCli(['--journaux', j, '--stats', s, '--date', '24/11/2026'], { ecrire: () => {} }), 1);
  fs.rmSync(d, { recursive: true, force: true });
});

test('critère 7 : journaux bruts supprimés après 7 jours, totaux anonymes gardés 25 mois', () => {
  const d = tmp();
  const j = path.join(d, 'logs');
  const s = path.join(d, 'stats');
  fs.mkdirSync(j);
  fs.mkdirSync(s);
  for (const x of ['2026-11-10', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-24']) fs.writeFileSync(path.join(j, `acces-${x}.log`), '');
  for (const x of ['2024-10-24', '2024-10-25', '2026-11-24']) fs.writeFileSync(path.join(s, `${x}.json`), '{}');
  fs.writeFileSync(path.join(j, 'autre.txt'), '');
  nettoyer({ journaux: j, stats: s, aujourdhui: '2026-11-25' });
  assert.deepEqual(fs.readdirSync(j).sort(), ['acces-2026-11-19.log', 'acces-2026-11-24.log', 'autre.txt']);
  assert.deepEqual(fs.readdirSync(s).sort(), ['2024-10-25.json', '2026-11-24.json']);
  fs.rmSync(d, { recursive: true, force: true });
});

// ---------- Consultation ----------

function totauxNovembre() {
  const d = tmp();
  for (let j = 24; j <= 30; j++) {
    const date = `2026-11-${j}`;
    fs.writeFileSync(path.join(d, `${date}.json`), JSON.stringify({
      date, visiteursUniques: 100 + j, pagesVues: 300 + j,
      pages: { '/': 50, '/pouvoir_achat.html': 30, '/candidat-attal_gabriel.html': 5, '/methode.html': 2 },
      sources: { recherche: 50, social: 20, autre: 4, direct: 26 + j }, appareils: { telephone: 70, ordinateur: 30 + j }, lignesIgnorees: 0,
    }));
  }
  return d;
}

test('critère 4 : consultation du 1er au 30 novembre, en français', () => {
  const d = totauxNovembre();
  const r = visiteursCli(['2026-11-01', '2026-11-30', '--dossier', d], () => '', '2026-12-01');
  assert.equal(r.code, 0);
  assert.match(r.texte, /Attention : pas de totaux pour 23 jours \(1er au 23 novembre\)\./);
  assert.match(r.texte, /Visiteurs du 1er au 30 novembre 2026/);
  assert.match(r.texte, /mardi 24 novembre\s+124\s+324/);
  assert.match(r.texte, /Total de la période : 889 visites uniques \(visites uniques par jour, cumulées\)/);
  assert.match(r.texte, /Pages vues : 2 289/);
  assert.match(r.texte, /Pages les plus lues\n 1\. Accueil\s+350\n 2\. Pouvoir d'achat\s+210\n 3\. Fiche candidat : Gabriel Attal\s+35\n 4\. Méthode\s+14/);
  assert.match(r.texte, /Sources de visite : moteur de recherche \d+ %, réseau social \d+ %, autre site \d+ %, accès direct \d+ %/);
  assert.match(r.texte, /Appareil : téléphone \d+ %, ordinateur \d+ %/);
  fs.rmSync(d, { recursive: true, force: true });
});

test('consultation : sans date la veille, une date un seul jour, option --json', () => {
  const d = totauxNovembre();
  const hier = visiteursCli(['--dossier', d], () => '', '2026-12-01');
  assert.match(hier.texte, /^Visiteurs du lundi 30 novembre 2026\n\nVisites uniques : 130\nPages vues : 330/);
  const json = visiteursCli(['2026-11-24', '2026-11-25', '--json', '--dossier', d], () => '', '2026-12-01');
  const o = JSON.parse(json.texte);
  assert.equal(o.visiteursUniques, 249);
  assert.equal(o.jours.length, 2);
  assert.equal(o.pages[0].page, '/');
  fs.rmSync(d, { recursive: true, force: true });
});

test('consultation : comparaison de deux semaines', () => {
  const d = totauxNovembre();
  for (let j = 17; j <= 23; j++) fs.writeFileSync(path.join(d, `2026-11-${j}.json`), JSON.stringify({ visiteursUniques: 100, pagesVues: 300 }));
  const o = lireArguments(['--comparer', 'semaine'], '2026-11-30');
  assert.deepEqual(o.periode, ['2026-11-23', '2026-11-29']);
  assert.deepEqual(o.precedente, ['2026-11-16', '2026-11-22']);
  const r = visiteursCli(['--comparer', 'semaine', '--dossier', d], () => '', '2026-11-30');
  assert.equal(r.code, 0);
  assert.match(r.texte, /^Cette semaine \(23 au 29 novembre\) et semaine précédente \(16 au 22 novembre\)/);
  assert.match(r.texte, /Visites uniques\s+859\s+600\s+\+43 %/);
  assert.match(r.texte, /semaine précédente, pas de totaux pour 1 jour \(16 novembre\)/);
  fs.rmSync(d, { recursive: true, force: true });
});

test('critère 8 : période sans données = message clair et code 1, sans chiffre inventé', () => {
  const d = totauxNovembre();
  const r = visiteursCli(['2026-10-01', '2026-10-31', '--dossier', d], () => '', '2026-12-01');
  assert.equal(r.code, 1);
  assert.equal(r.texte, 'Aucune donnée pour cette période (1er au 31 octobre 2026).\nLa mesure a commencé le 24 novembre 2026.');
  const rien = visiteursCli(['2026-10-01'], () => '', '2026-12-01');
  assert.equal(rien.code, 1);
  assert.match(rien.texte, /^Aucune donnée pour cette période \(1er octobre 2026\)\./);
  fs.rmSync(d, { recursive: true, force: true });
});

test('dates mal écrites : message clair et code 1', () => {
  for (const args of [['30/11/2026'], ['2026-02-30'], ['2026-11-30', '2026-11-01'], ['2026-11-01', '2026-11-02', '2026-11-03'], ['--comparer', 'annee'], ['--inconnue']]) {
    const r = visiteursCli(args, () => '', '2026-12-01');
    assert.equal(r.code, 1, args.join(' '));
    assert.ok(r.texte.length > 0);
  }
  assert.match(visiteursCli(['30/11/2026'], () => '', '2026-12-01').texte, /^Dates non reconnues\.\nExemple : sh deploy\/visiteurs\.sh 2026-11-01 2026-11-30$/);
});

test('cumul : un jour abîmé sur le serveur est traité comme un jour sans données', () => {
  const r = cumuler({ '2026-11-24': { visiteursUniques: 3, pagesVues: 6 } }, ['2026-11-24', '2026-11-25']);
  assert.equal(r.visiteursUniques, 3);
  assert.deepEqual(r.joursSansDonnees, ['2026-11-25']);
  assert.equal(rapport({ periode: ['2026-11-25', '2026-11-25'] }, {}).code, 1);
});

// La vraie commande, avec un faux « ssh » placé en tête du PATH.
function lancer(args, fauxSsh) {
  const bin = tmp();
  fs.writeFileSync(path.join(bin, 'ssh'), `#!/bin/sh\n${fauxSsh}\n`, { mode: 0o755 });
  const r = spawnSync('sh', ['deploy/visiteurs.sh', ...args], { cwd: SITE, encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });
  fs.rmSync(bin, { recursive: true, force: true });
  return r;
}

test('commande deploy/visiteurs.sh : succès, serveur injoignable (code 2), dates invalides (code 1 sans connexion)', () => {
  const d = totauxNovembre();
  const ok = lancer(['2026-11-24', '2026-11-30'], `for f in ${d}/*.json; do printf '%s\\t%s\\n' "$(basename "$f")" "$(cat "$f")"; done`);
  assert.equal(ok.status, 0, ok.stderr + ok.stdout);
  assert.match(ok.stderr, /Connexion au serveur de prod…\nLecture des totaux du 24 au 30 novembre 2026…/);
  assert.match(ok.stdout, /Total de la période : 889 visites uniques/);
  const ko = lancer(['2026-11-24', '2026-11-30'], 'echo "ssh: connect to host: Connection timed out" >&2; exit 255');
  assert.equal(ko.status, 2);
  assert.match(ko.stdout, /^Serveur injoignable : la connexion SSH a échoué\./);
  const vide = lancer(['2026-10-01', '2026-10-31'], 'exit 0');
  assert.equal(vide.status, 1);
  assert.match(vide.stdout, /Aucune donnée pour cette période/);
  const mauvais = lancer(['30/11/2026'], 'echo appel >&2; exit 0');
  assert.equal(mauvais.status, 1);
  assert.doesNotMatch(mauvais.stderr, /appel|Connexion/);
  assert.match(mauvais.stdout, /Dates non reconnues/);
  fs.rmSync(d, { recursive: true, force: true });
});

// ---------- Serveur et textes du site ----------

const lireDeploy = (f) => fs.readFileSync(path.join(SITE, 'deploy', f), 'utf8');

test('critères 1 et 6 : journaux persistants et vraie adresse en prod, préprod inchangée', () => {
  const conf = lireDeploy('nginx.prod.conf');
  assert.match(conf, /real_ip_header X-Forwarded-For;/);
  assert.match(conf, /set_real_ip_from 172\.16\.0\.0\/12;/);
  assert.match(conf, /access_log \/var\/log\/nginx\/visites\/acces-\$visites_jour\.log visites;/);
  assert.equal(/\$http_referer"|\$request_uri|\$args|\$query_string/.test(conf), false, 'ni référent complet ni paramètres');
  assert.match(lireDeploy('docker-compose.prod.yml'), /- \.\/logs:\/var\/log\/nginx\/visites/);
  for (const f of ['nginx.preprod.conf', 'docker-compose.preprod.yml']) assert.equal(/visites|real_ip/.test(lireDeploy(f)), false, f);
  assert.match(lireDeploy('visites.cron'), /^0 2 \* \* \* root .*agreger\.mjs --journaux \/logs --stats \/stats/m);
});

test('critère 10 : la page Qui sommes nous et le pied de page décrivent la mesure en phrases simples', () => {
  const tmpSite = copierSite();
  const pages = generer(tmpSite);
  const qui = pages['qui-sommes-nous.html'];
  assert.match(qui, /Pas de cookie, pas de publicité, aucun service tiers\./);
  assert.match(qui, /notre serveur garde 7 jours l'adresse de connexion et le type de navigateur, puis n'en conserve que des totaux anonymes\./);
  assert.match(qui, /Si votre navigateur demande à ne pas être suivi, votre visite n'est pas comptée\./);
  assert.match(qui, /gardés 25 mois au plus et ne sont pas publiés/);
  assert.match(qui, /Les polices de caractères sont hébergées sur notre serveur\./);
  assert.equal((qui.match(/<ul class="points">[\s\S]*?<\/ul>/)[0].match(/<svg/g) || []).length, 3);
  for (const [f, html] of Object.entries(pages)) {
    assert.match(html, /Ce site ne recommande aucun vote\. Aucun cookie, aucun service tiers : les visites sont comptées de façon anonyme par notre serveur\./, f);
    assert.equal(/Il n'utilise aucun cookie|aucun suivi|Nginx|hachage/.test(html.replace(/<script[\s\S]*?<\/script>/g, '')), false, f);
  }
  fs.rmSync(tmpSite, { recursive: true, force: true });
});
