// Tests du bloc « Comment lire une fiche » de l'accueil et du gabarit de la page Méthode (ticket 91).
// Le site est généré dans un dossier temporaire pour ne pas toucher à public/.
// Lancement : npm test (depuis 05_site)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INTERDITS = ['Ce qui a été fait', 'budgets', 'résultats mesurés', '2 ou 3 grandes lois'];
const PARTIES = ['En bref', 'Programmes 2027', 'Bilan du mandat : deux votes', 'Pour aller plus loin', 'Vérification'];
const decoder = (s) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const texte = (html) => decoder(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const dossiers = [];

// Copie 05_site dans un dossier temporaire, applique une modification des données, puis génère le site.
function generer(modifier = () => {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'site-lire-'));
  dossiers.push(tmp);
  const dossier = path.join(tmp, '05_site');
  fs.mkdirSync(dossier);
  fs.copyFileSync(path.join(SITE, 'build.mjs'), path.join(dossier, 'build.mjs'));
  fs.cpSync(path.join(SITE, 'data'), path.join(dossier, 'data'), { recursive: true });
  fs.cpSync(path.join(SITE, 'src'), path.join(dossier, 'src'), { recursive: true });
  fs.cpSync(path.join(SITE, 'maj'), path.join(dossier, 'maj'), { recursive: true });
  fs.symlinkSync(path.join(SITE, 'node_modules'), path.join(dossier, 'node_modules'), 'junction');
  modifier(path.join(dossier, 'data'));
  execFileSync(process.execPath, ['build.mjs', '--sans-md'], { cwd: dossier, stdio: 'pipe' });
  const page = (f) => fs.readFileSync(path.join(dossier, 'public', f), 'utf8');
  return { page, existe: (f) => fs.existsSync(path.join(dossier, 'public', f)) };
}

// Le bloc « Comment lire une fiche » dans une page d'accueil générée.
function blocLire(index) {
  const m = index.match(/<section class="bloc" aria-labelledby="lire">([\s\S]*?)<\/section>/);
  assert.ok(m, 'Bloc « Comment lire une fiche » absent de index.html');
  return m[1];
}

// Intitulés des sections de la page thème (h2), dans l'ordre. La liste « Pas encore de proposition
// publiée sur ce thème » fait partie de la carte « Programmes 2027 » : elle n'a pas d'intitulé propre dans le bloc.
function intitulesTheme(theme) {
  const corps = theme.slice(theme.indexOf('<div class="page-theme">'));
  return [...corps.matchAll(/<h2 id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g)]
    .filter(([, id]) => id !== 'att-t')
    .map(([, , h]) => texte(h.replace(/<span class="nb">[\s\S]*?<\/span>/, '')));
}

// Test de cohérence : chaque intitulé de la page thème est repris dans le bloc, dans le même ordre.
export function verifierCoherence(index, theme) {
  const bloc = texte(blocLire(index));
  const intitules = intitulesTheme(theme);
  assert.ok(intitules.length >= 5, `Page thème : intitulés introuvables (${intitules.join(', ')})`);
  let pos = -1;
  for (const i of intitules) {
    const p = bloc.indexOf(i);
    assert.ok(p !== -1, `Intitulé absent du bloc : « ${i} »`);
    assert.ok(p > pos, `Intitulé dans le désordre dans le bloc : « ${i} »`);
    pos = p;
  }
}

let site;
before(() => { site = generer(); });
after(() => { for (const d of dossiers) fs.rmSync(d, { recursive: true, force: true }); });

test('bloc : garde son titre, son identifiant et son lien vers la méthode', () => {
  const bloc = blocLire(site.page('index.html'));
  assert.match(bloc, /<h2 id="lire">Comment lire une fiche <span aria-hidden="true">👀<\/span><\/h2>/);
  assert.match(bloc, /<a class="lnk" href="methode.html">Lire la méthode complète<\/a>/);
  assert.ok(site.existe('methode.html'));
});

test('bloc : intro, on ne confond jamais ce qui a été voté et ce qui est proposé', () => {
  const t = texte(blocLire(site.page('index.html')));
  assert.match(t, /on ne confond jamais ce qui a été voté pendant le mandat et ce qui est proposé pour 2027/);
});

test('bloc : les parties de la fiche dans l\'ordre de la page thème', () => {
  const bloc = blocLire(site.page('index.html'));
  const h3 = [...bloc.matchAll(/<h3>([^<]*)<\/h3>/g)].map((m) => decoder(m[1]));
  assert.deepEqual(h3, ['En bref', 'Programmes 2027', 'Bilan du mandat : deux votes']);
  assert.match(bloc, /<ol class="lire-liste">/);
  const t = texte(bloc);
  let pos = -1;
  for (const p of PARTIES) {
    const i = t.indexOf(p);
    assert.ok(i > pos, `Partie absente ou dans le désordre : « ${p} »`);
    pos = i;
  }
});

test('bloc : la carte « Programmes 2027 » décrit mesures à déplier, filtre et candidats sans proposition', () => {
  const t = texte(blocLire(site.page('index.html')));
  assert.match(t, /jusqu'à 3 mesures clefs\. Dépliez une mesure pour voir le détail, la source et ses dates\./);
  assert.match(t, /Un filtre par sous thème/);
  assert.match(t, /Les candidats sans proposition publiée sont listés à part\./);
});

test('bloc : la carte « Bilan du mandat » décrit les deux lois, les groupes, la raison et le scrutin', () => {
  const t = texte(blocLire(site.page('index.html')));
  assert.match(t, /Deux lois votées pendant le mandat 2022-2027/);
  assert.match(t, /la position majoritaire de chaque groupe à l'Assemblée nationale/);
  assert.match(t, /Touchez un groupe pour lire la raison qu'il a donnée/);
  assert.match(t, /scrutin public/);
});

test('bloc : plus de « Ce qui a été fait », « budgets », « résultats mesurés » ni « 2 ou 3 grandes lois »', () => {
  const bloc = blocLire(site.page('index.html'));
  for (const i of INTERDITS) assert.equal(bloc.includes(i), false, `Texte retiré encore présent : « ${i} »`);
  assert.equal(bloc.includes('fait-ex'), false);
  assert.equal(bloc.includes('prop-ex'), false);
});

test('bloc : textes sans tiret long et sans « quelques minutes » (ticket 87)', () => {
  const bloc = blocLire(site.page('index.html'));
  assert.equal(bloc.includes('—'), false);
  assert.equal(bloc.includes('quelques minutes'), false);
});

test('bloc : icônes et emojis décoratifs masqués aux lecteurs d\'écran', () => {
  const bloc = blocLire(site.page('index.html'));
  const svgs = [...bloc.matchAll(/<svg[^>]*>/g)].map((m) => m[0]);
  assert.equal(svgs.length, 9);
  for (const s of svgs) assert.match(s, /focusable="false"/);
  const tuiles = [...bloc.matchAll(/<span class="tuile-ic"([^>]*)>/g)];
  assert.equal(tuiles.length, 3);
  for (const [, a] of tuiles) assert.match(a, /aria-hidden="true"/);
  for (const m of bloc.matchAll(/<li><svg[^>]*>/g)) assert.match(m[0], /aria-hidden="true"/);
});

test('bloc : « Voir un exemple » mène au premier thème publié et disparaît à l\'impression', () => {
  const bloc = blocLire(site.page('index.html'));
  const m = bloc.match(/<a class="btn noprint" href="([a-z_]+)\.html">Voir un exemple : ([^<]+)<\/a>/);
  assert.ok(m, 'Lien « Voir un exemple » absent');
  assert.equal(m[1], 'education');
  assert.equal(m[2], 'Éducation');
  assert.ok(site.existe('education.html'));
});

test('bloc : sans thème publié, pas de lien « Voir un exemple »', () => {
  const vide = generer((data) => {
    for (const n of fs.readdirSync(path.join(data, 'themes'))) {
      const p = path.join(data, 'themes', n);
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      j.faits = [];
      fs.writeFileSync(p, JSON.stringify(j));
    }
  });
  const bloc = blocLire(vide.page('index.html'));
  assert.equal(bloc.includes('Voir un exemple'), false);
  assert.match(bloc, /<div class="lire-suite">/);
});

test('cohérence : chaque intitulé de la page thème est repris dans le bloc, dans l\'ordre', () => {
  verifierCoherence(site.page('index.html'), site.page('education.html'));
});

test('cohérence : si un intitulé change sur la page thème, le test échoue et nomme l\'intitulé', () => {
  const theme = site.page('education.html').replace('<h2 id="vote-t">Bilan du mandat : deux votes</h2>', '<h2 id="vote-t">Bilan du mandat : trois votes</h2>');
  assert.throws(() => verifierCoherence(site.page('index.html'), theme), (e) => {
    assert.equal(e.message, 'Intitulé absent du bloc : « Bilan du mandat : trois votes »');
    return true;
  });
});

test('style : cartes empilées sous 640 px, une colonne à l\'impression, fin des bordures pleine et pointillée', () => {
  const css = site.page('style.css');
  assert.match(css, /\.lire-liste\{[^}]*grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,280px\),1fr\)\)/);
  assert.match(css, /@media \(max-width:640px\)\{[^@]*\.lire-liste\{grid-template-columns:1fr/);
  assert.match(css, /@media print\{[^@]*\.lire-carte\{[^}]*break-inside:avoid/);
  assert.equal(css.includes('.fait-ex'), false);
  assert.equal(css.includes('.prop-ex'), false);
});

test('méthode : « Le gabarit d\'une fiche » suit l\'ordre de la page thème', () => {
  const m = site.page('methode.html').match(/<section class="deux sect" id="gabarit">([\s\S]*?)<\/section>/);
  assert.ok(m, 'Section « Le gabarit d\'une fiche » absente');
  const items = [...m[1].matchAll(/<li><strong>([^<]*)<\/strong>/g)].map((x) => decoder(x[1]));
  assert.deepEqual(items, ['En bref', 'Programmes 2027', 'Pas encore de proposition publiée sur ce thème', 'Bilan du mandat : deux votes', 'Pour aller plus loin', 'Vérification']);
  assert.equal(m[1].includes('Ce qui a été fait'), false);
});

test('le site versionné dans public/ est régénéré avec le nouveau bloc', () => {
  const index = fs.readFileSync(path.join(SITE, 'public', 'index.html'), 'utf8');
  const bloc = blocLire(index);
  assert.match(bloc, /Comment lire une fiche/);
  for (const p of ['En bref', 'Programmes 2027', 'Bilan du mandat']) assert.ok(bloc.includes(p), `Intitulé absent : « ${p} »`);
  assert.equal(bloc.includes('Ce qui a été fait'), false);
  assert.equal(bloc.includes('2 ou 3 grandes lois'), false);
  const methode = fs.readFileSync(path.join(SITE, 'public', 'methode.html'), 'utf8');
  assert.match(methode, /<ol class="gabarit">/);
});
