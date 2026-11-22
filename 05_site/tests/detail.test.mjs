// Tests du détail d'une mesure (ticket 92) : l'étiquette de chiffrage est un bloc statique,
// visible dès que la mesure est dépliée, sans survol ni second clic.
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
const THEMES = ['education', 'ecologie', 'pouvoir_achat', 'travail', 'sante', 'logement', 'securite', 'immigration', 'institutions', 'europe'];
const lire = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const decoder = (s) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const dossiers = [];

// Titres et définitions des niveaux, tels qu'affichés (repris de build.mjs, relus)
const NIVEAUX = {
  cadre_valide: ['Dans le cadre validé', "Le chiffre annoncé est cohérent avec les estimations d'au moins deux sources indépendantes."],
  discute: ['Discuté', "Les sources indépendantes ne s'accordent pas sur le chiffre, ou il n'est tenable qu'avec des hypothèses fortes. Nous les affichons toutes, sans trancher."],
  non_evaluable: ['Mesure chiffrée non évaluable', 'Moins de deux sources indépendantes se prononcent, ou la mesure est trop floue pour être chiffrée. Nous ne forçons jamais un niveau.'],
  hors_cadre: ['Hors du cadre validé', "Au moins deux sources indépendantes jugent ce chiffre incompatible avec leurs propres estimations. Ce niveau juge le chiffre, jamais l'intérêt de la mesure."],
};
const NON_CHIFFREE = ['Mesure non chiffrée par le parti', "Le candidat ne donne pas le coût de cette mesure. Il n'y a donc pas de chiffre à comparer aux estimations des institutions. Nous l'indiquons sans commentaire."];
const RAISON_DEFAUT = "Nous n'avons pas encore relevé deux estimations indépendantes de ce chiffre dans les travaux des institutions du panel. Nous ne forçons pas de niveau.";

// Copie 05_site dans un dossier temporaire, applique une modification des données, puis génère le site.
function generer(modifier = () => {}, ...options) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'site-detail-'));
  dossiers.push(tmp);
  const dossier = path.join(tmp, '05_site');
  fs.mkdirSync(dossier);
  fs.copyFileSync(path.join(SITE, 'build.mjs'), path.join(dossier, 'build.mjs'));
  fs.cpSync(path.join(SITE, 'data'), path.join(dossier, 'data'), { recursive: true });
  fs.cpSync(path.join(SITE, 'src'), path.join(dossier, 'src'), { recursive: true });
  fs.cpSync(path.join(SITE, 'maj'), path.join(dossier, 'maj'), { recursive: true });
  fs.symlinkSync(path.join(SITE, 'node_modules'), path.join(dossier, 'node_modules'), 'junction');
  modifier(path.join(dossier, 'data'));
  const sortie = execFileSync(process.execPath, ['build.mjs', '--sans-md', ...options], { cwd: dossier, encoding: 'utf8', stdio: 'pipe' });
  const page = (slug) => fs.readFileSync(path.join(dossier, 'public', `${slug}.html`), 'utf8');
  return { sortie, page, dossier };
}

// Tous les détails de mesure (.mdet) d'une page thème
const details = (html) => [...html.matchAll(/<div class="mdet" id="([^"]+)">([\s\S]*?)\n<\/div><\/li>/g)].map((m) => ({ id: m[1], html: m[2], texte: decoder(m[2]) }));
// Le détail d'une mesure donnée (candidat, rang de 1 à 3)
const detail = (html, cid, k) => details(html).find((d) => d.id === `m-${cid}-${k}`);
const aUnNombre = (x) => !!x.chiffrage && /\d/.test(x.chiffrage);

// Une mesure chiffrée (avec un nombre) prise dans les données réelles, pour les cas modifiés
function premiereMesureChiffree() {
  for (const f of fs.readdirSync(path.join(SITE, 'data', 'mesures')).sort()) {
    const m = lire(path.join(SITE, 'data', 'mesures', f));
    for (const slug of THEMES) {
      const l = (m.themes?.[slug] || []).slice(0, 3);
      const k = l.findIndex(aUnNombre);
      if (k >= 0) return { fichier: f, cid: f.replace(/\.json$/, ''), slug, k };
    }
  }
  throw new Error('aucune mesure chiffrée dans les données');
}
const cible = premiereMesureChiffree();
function avecViabilite(viabilite) {
  return (data) => {
    const p = path.join(data, 'mesures', cible.fichier);
    const m = lire(p);
    m.themes[cible.slug][cible.k].viabilite = viabilite;
    fs.writeFileSync(p, JSON.stringify(m));
  };
}

let base;
before(() => { base = generer(); });
after(() => dossiers.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

test('aucune étiquette repliable details.niv ni icône « i » dans le détail des mesures', () => {
  for (const slug of THEMES) {
    const html = base.page(slug);
    assert.ok(details(html).length > 0, `${slug} : aucun détail de mesure trouvé`);
    for (const d of details(html)) {
      assert.doesNotMatch(d.html, /details class="niv"/, `${slug} ${d.id}`);
      assert.doesNotMatch(d.html, /niv-btn|niv-pop|class="i"|afficher l'explication/, `${slug} ${d.id}`);
    }
  }
});

test('chaque détail contient soit « Mesure non chiffrée par le parti », soit un des quatre niveaux suivi de sa définition', () => {
  const titres = Object.values(NIVEAUX);
  for (const slug of THEMES) {
    for (const d of details(base.page(slug))) {
      const nonChiffree = d.texte.includes(`<span>${NON_CHIFFREE[0]}</span></p>\n<p class="def">${NON_CHIFFREE[1]}</p>`);
      const niveau = titres.filter(([t, def]) => d.texte.includes(`<span>${t}</span></p>\n<p class="def">${def}</p>`));
      assert.equal(Number(nonChiffree) + niveau.length, 1, `${slug} ${d.id} : une seule étiquette attendue, suivie de sa définition`);
    }
  }
});

test('le détail suit les données : non chiffrée sans ligne « Chiffrage annoncé », chiffrée avec la ligne puis le niveau', () => {
  let nbChiffrees = 0;
  let nbNonChiffrees = 0;
  for (const f of fs.readdirSync(path.join(SITE, 'data', 'mesures'))) {
    const m = lire(path.join(SITE, 'data', 'mesures', f));
    const cid = f.replace(/\.json$/, '');
    for (const slug of THEMES) {
      const html = base.page(slug);
      (m.themes?.[slug] || []).slice(0, 3).forEach((x, i) => {
        const d = detail(html, cid, i + 1);
        if (!d) return; // candidat non publié
        if (aUnNombre(x)) {
          nbChiffrees++;
          const c = d.texte.indexOf(`<p class="chiffre">Chiffrage annoncé : ${x.chiffrage}</p>`);
          const n = d.texte.indexOf('<div class="nivbloc">');
          const p = d.texte.indexOf('<p class="t">Pourquoi ce niveau</p>');
          const s = d.texte.indexOf('Voir les sources du chiffrage</summary>');
          assert.ok(c >= 0 && c < n && n < p && p < s, `${cid}/${slug}/${i + 1} : ordre chiffre, niveau, pourquoi, sources`);
          assert.match(d.texte, /<span class="sr">Niveau du chiffre : <\/span>/);
        } else {
          nbNonChiffrees++;
          assert.ok(!d.texte.includes('Chiffrage annoncé'), `${cid}/${slug}/${i + 1} : pas de ligne « Chiffrage annoncé »`);
          assert.ok(d.texte.includes(`<span class="sr">Chiffrage : </span>`), `${cid}/${slug}/${i + 1} : préfixe lecteur d'écran`);
          assert.ok(d.texte.includes(NON_CHIFFREE[0]), `${cid}/${slug}/${i + 1}`);
          assert.ok(d.texte.includes('<a class="lnk discret" href="methode.html#chiffrage">Notre méthode</a>'));
          assert.ok(!d.texte.includes('Pourquoi ce niveau') && !d.texte.includes('srcch'), `${cid}/${slug}/${i + 1} : rien d'autre que l'étiquette`);
        }
      });
    }
  }
  assert.ok(nbChiffrees > 0 && nbNonChiffrees > 0);
});

test('mesure chiffrée sans données de viabilité : « Mesure chiffrée non évaluable », définition et raison par défaut', () => {
  const d = detail(base.page(cible.slug), cible.cid, cible.k + 1);
  assert.ok(d.texte.includes(`<span>${NIVEAUX.non_evaluable[0]}</span></p>\n<p class="def">${NIVEAUX.non_evaluable[1]}</p>\n<p class="t">Pourquoi ce niveau</p><p class="raison">${RAISON_DEFAUT}</p>`));
  // Sources derrière un seul lien repliable, fermé par défaut
  assert.equal((d.html.match(/<details/g) || []).length, 1);
  assert.match(d.html, /<details class="srcch"><summary>/);
  assert.match(d.texte, /<dt>Chiffre annoncé<\/dt><dd>[^<]+<\/dd><dt>Estimations des sources<\/dt><dd>Aucune comparaison possible pour l'instant<\/dd>/);
  assert.match(d.texte, /Dernière vérification : /);
  assert.match(d.html, /href="panel-sources.html">Méthode et panel de sources<\/a>/);
});

test('mesure chiffrée avec un niveau validé (Discuté) : titre, définition et « Pourquoi ce niveau » visibles, sources derrière le lien', () => {
  const raison = 'Les deux institutions donnent des estimations différentes du coût.';
  const { page } = generer(avecViabilite({
    niveau: 'discute', relu: true, raison, chiffre_annonce: '10 Md€ par an', estimations: '8 Md€ selon l’IPP, 14 Md€ selon l’OFCE', date_verif: '2026-11-09',
    sources: [{ institution: 'ipp', titre: 'Note A', url: 'https://www.ipp.eu/a', date: '2026-10-01', verdict: 'Estime 8 Md€.' }, { institution: 'ofce', titre: 'Note B', url: 'https://www.ofce.sciences-po.fr/b', date: '2026-10-02' }],
    sources_divergentes: [{ institution: 'insee', titre: 'Note C', url: 'https://www.insee.fr/c' }],
  }));
  const d = detail(page(cible.slug), cible.cid, cible.k + 1);
  assert.ok(d.texte.includes(`<span class="sr">Niveau du chiffre : </span>`));
  assert.ok(d.texte.includes(`<span>${NIVEAUX.discute[0]}</span></p>\n<p class="def">${NIVEAUX.discute[1]}</p>\n<p class="t">Pourquoi ce niveau</p><p class="raison">${raison}</p>`));
  const sources = d.texte.slice(d.texte.indexOf('<details class="srcch">'));
  assert.ok(sources.includes('<dd>10 Md€ par an</dd>'));
  assert.ok(sources.includes('<p class="t">Sources</p>') && sources.includes('Note A') && sources.includes('Note B'));
  assert.ok(sources.includes('<p class="t">Sources qui ne vont pas dans le même sens</p>') && sources.includes('Note C'));
  assert.ok(sources.includes('Dernière vérification : 9 novembre 2026'));
});

test('niveau inconnu : affiché « Mesure chiffrée non évaluable » avec la raison par défaut, et signalé dans la console du build', () => {
  const { page, sortie } = generer(avecViabilite({ niveau: 'tres_solide', relu: true, raison: 'Raison qui ne doit pas apparaître.' }));
  const d = detail(page(cible.slug), cible.cid, cible.k + 1);
  assert.ok(d.texte.includes(`<span>${NIVEAUX.non_evaluable[0]}</span>`));
  assert.ok(d.texte.includes(RAISON_DEFAUT));
  assert.ok(!d.texte.includes('Raison qui ne doit pas apparaître.'));
  assert.match(sortie, new RegExp(`viabilité ${cible.cid}/${cible.slug} : niveau inconnu « tres_solide »`));
});

test('niveau mal sourcé : ramené à « Mesure chiffrée non évaluable » et signalé dans la console du build', () => {
  const { page, sortie } = generer(avecViabilite({ niveau: 'cadre_valide', relu: true, raison: 'Une seule source.', sources: [{ institution: 'ipp', titre: 'Note', url: 'https://www.ipp.eu/a' }] }));
  const d = detail(page(cible.slug), cible.cid, cible.k + 1);
  assert.ok(d.texte.includes(`<span>${NIVEAUX.non_evaluable[0]}</span>`));
  assert.ok(!d.texte.includes(NIVEAUX.cadre_valide[0]));
  assert.match(sortie, /ramené à Mesure chiffrée non évaluable/);
});

test('aucun comportement au survol pour l’étiquette dans app.js', () => {
  const js = fs.readFileSync(path.join(SITE, 'src', 'app.js'), 'utf8');
  assert.doesNotMatch(js, /details\.niv/);
  assert.doesNotMatch(js, /data-survol/);
  assert.doesNotMatch(js, /\(hover: hover\)/);
  const css = fs.readFileSync(path.join(SITE, 'src', 'style.css'), 'utf8');
  assert.doesNotMatch(css, /details\.niv|\.niv-btn|\.niv-pop/);
  assert.doesNotMatch(css, /\.srcch[^{]*:hover|\.nivbloc[^{]*:hover/);
});

test('page candidat : même bloc statique, sans details.niv', () => {
  const html = base.page(`candidat-${cible.cid}`);
  assert.doesNotMatch(html, /details class="niv"/);
  assert.ok(html.includes('<div class="nivbloc">'));
  assert.ok(decoder(html).includes(`${NIVEAUX.non_evaluable[0]}</span></p>\n<p class="def">${NIVEAUX.non_evaluable[1]}</p>`));
  assert.ok(html.includes('Chiffrage annoncé : '));
});

test('méthode : la phrase décrit le nouvel affichage', () => {
  const html = decoder(base.page('methode'));
  assert.ok(!html.includes('Cliquer ou toucher le niveau ouvre une explication'));
  assert.ok(html.includes("Quand on déplie une mesure avec le bouton « + », on voit tout de suite si elle est chiffrée par le parti, son niveau, ce qu'il veut dire et pourquoi il a été attribué. Le lien « Voir les sources du chiffrage » donne ensuite le chiffre annoncé, les estimations, les sources (y compris celles qui ne vont pas dans le même sens) et la date de vérification."));
});

test('textes du détail sans tiret long', () => {
  for (const slug of THEMES) for (const d of details(base.page(slug))) {
    const bloc = d.texte.match(/<div class="nivbloc">[\s\S]*?<\/p>\n<p class="def">[^<]*<\/p>/)?.[0] || '';
    assert.doesNotMatch(bloc, /—/, `${slug} ${d.id}`);
  }
});
