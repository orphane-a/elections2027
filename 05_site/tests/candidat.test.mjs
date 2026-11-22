// Tests de la page candidat retravaillée (ticket 98) : un bloc par thème, la mesure d'abord,
// l'étiquette de chiffrage en une ligne discrète repliable, sans survol.
// Le site est généré dans un dossier temporaire pour ne pas toucher à public/.
// Lancement : npm test (depuis 05_site)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { copierSite, generer, lire, SITE } from './outils.mjs';

const THEMES = [
  ['education', '🎓', 'Éducation', '#E3E1FB'], ['ecologie', '🌿', 'Écologie et énergie', '#D5F0E5'],
  ['pouvoir_achat', '💶', "Pouvoir d'achat", '#FFE6BF'], ['travail', '💼', 'Travail et emploi', '#D8E7FA'],
  ['sante', '❤️', 'Santé', '#FBDCE5'], ['logement', '🏠', 'Logement', '#FAEDB8'],
  ['securite', '⚖️', 'Sécurité et justice', '#DDE3EE'], ['immigration', '🌍', 'Immigration et intégration', '#D3EDF1'],
  ['institutions', '🏛️', 'Institutions et démocratie', '#EADDF6'], ['europe', '⭐', 'Europe et international', '#FFDACB'],
];
const decoder = (s) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const DOSSIER_MES = path.join(SITE, 'data', 'mesures');
const mesuresDe = (cid) => lire(path.join(DOSSIER_MES, `${cid}.json`));
const nbMesures = (cid) => THEMES.map(([s]) => (mesuresDe(cid).themes?.[s] || []).slice(0, 3).length);
const aUnNombre = (x) => !!x.chiffrage && /\d/.test(x.chiffrage);
const publies = new Set(fs.readdirSync(path.join(SITE, 'data', 'candidats')).map((f) => lire(path.join(SITE, 'data', 'candidats', f))).filter((c) => c.statut_publie !== false).map((c) => c.id));
const ids = fs.readdirSync(DOSSIER_MES).map((f) => f.replace(/\.json$/, '')).filter((id) => publies.has(id)).sort();
// Un candidat avec des mesures sur les 10 thèmes, un candidat avec au moins un thème vide
const complet = ids.includes('de_villepin_dominique') && nbMesures('de_villepin_dominique').every((n) => n > 0) ? 'de_villepin_dominique' : ids.find((id) => nbMesures(id).every((n) => n > 0));
const partiel = ids.find((id) => nbMesures(id).some((n) => n === 0) && nbMesures(id).some((n) => n > 0));
// Première mesure chiffrée (avec un nombre) d'un candidat publié
const chiffree = (() => {
  for (const cid of ids) for (const [slug] of THEMES) {
    const k = (mesuresDe(cid).themes?.[slug] || []).slice(0, 3).findIndex(aUnNombre);
    if (k >= 0) return { cid, slug, k };
  }
  throw new Error('aucune mesure chiffrée');
})();

// Découpe une page candidat : sommaire et blocs thème (section.tb)
const blocs = (html) => [...html.matchAll(/<section class="tb" id="theme-([a-z_]+)" aria-labelledby="h-\1">([\s\S]*?)\n<\/section>/g)].map((m) => ({ slug: m[1], html: m[2] }));
const mesuresBloc = (b) => [...b.html.matchAll(/<li class="mes">([\s\S]*?)<\/li>(?=\n<li class="mes">|<\/ul>)/g)].map((m) => m[1]);
// Squelette d'une page : balises et classes seulement, sans texte ni attributs variables (pour comparer deux candidats)
const squelette = (html) => html.slice(html.indexOf('<div class="page-cand">'), html.indexOf('<section class="deux">'))
  .replace(/<li class="mes">[\s\S]*?<\/li>(?=\n<li class="mes">|<\/ul>)/g, '<li class="mes">M</li>')
  .replace(/<ul class="mes-l">[\s\S]*?<\/ul>|<p class="nc">Non communiqué\.<\/p>/g, 'CORPS')
  .replace(/#cand-[a-z_]+/g, '#cand-X').replace(/<span class="chip-nc">, non communiqué<\/span>/g, '');

const tmps = [];
let pages;
before(() => { const t = copierSite(); tmps.push(t); pages = generer(t); });
after(() => tmps.forEach((t) => fs.rmSync(t, { recursive: true, force: true })));
const page = (cid) => pages[`candidat-${cid}.html`];

test('exigence 1 et critère 1 : 10 blocs dans l\'ordre des thèmes, avec emoji masqué, nom en h2 et couleur du thème sur l\'en-tête', () => {
  for (const cid of ids) {
    const b = blocs(page(cid));
    assert.deepEqual(b.map((x) => x.slug), THEMES.map(([s]) => s), cid);
    b.forEach((x, i) => {
      const [slug, emoji, nom, bg] = THEMES[i];
      assert.ok(decoder(x.html).startsWith(`\n<div class="tb-tete" style="background:${bg}"><h2 id="h-${slug}"><span class="emo" aria-hidden="true">${emoji}</span>${nom}</h2>`), `${cid} ${slug}`);
    });
  }
});

test('exigence 2 et critère 5 : chaque en-tête garde le lien « Comparer sur ce thème » vers la page thème', () => {
  for (const cid of ids) for (const b of blocs(page(cid))) {
    assert.ok(b.html.includes(`<a class="lnk cmp" href="${b.slug}.html#cand-${cid}">Comparer sur ce thème</a>`), `${cid} ${b.slug}`);
  }
  assert.ok(page(complet).includes(`href="sante.html#cand-${complet}">Comparer sur ce thème</a>`));
});

test('exigence 3 et critère 1 : la mesure vient en premier, au plus 3 par thème, avec un texte plus grand et plus gras que l\'étiquette', () => {
  for (const cid of ids) {
    const n = nbMesures(cid);
    blocs(page(cid)).forEach((b, i) => {
      const l = mesuresBloc(b);
      assert.equal(l.length, n[i], `${cid} ${b.slug}`);
      assert.ok(l.length <= 3);
      for (const m of l) assert.ok(m.startsWith('<p class="mt">'), `${cid} ${b.slug} : la mesure d'abord`);
    });
  }
  const css = fs.readFileSync(path.join(SITE, 'src', 'style.css'), 'utf8');
  const regle = (sel) => css.match(new RegExp(`(?:^|\\n)${sel.replace(/[.>]/g, (c) => `\\${c}`)}\\{([^}]*)\\}`))?.[1] || '';
  const taille = (r) => Number(r.match(/font-size:(\d+)px/)?.[1]);
  const graisse = (r) => Number(r.match(/font-weight:(\d+)/)?.[1] || 400);
  const mt = regle('.mes-l .mt');
  const lib = regle('.mes-l .niv>summary');
  assert.ok(taille(mt) > taille(lib), 'taille de la mesure > taille de l\'étiquette');
  assert.ok(graisse(mt) > graisse(lib), 'graisse de la mesure > graisse de l\'étiquette');
  assert.ok(taille(mt) > taille(regle('.mes-l .chiffre')) && taille(mt) > taille(regle('.mes-l .msrc')), 'la mesure est le texte le plus grand du bloc');
});

test('exigence 4 et critère 2 : étiquette réduite à une ligne (icône et intitulé), sans cadre noir, définition repliée', () => {
  let nonChiffrees = 0;
  for (const cid of ids) for (const b of blocs(page(cid))) for (const m of mesuresBloc(b)) {
    assert.doesNotMatch(m, /nivbloc|niv-chip/);
    assert.equal((m.match(/<details class="niv">/g) || []).length, 1, `${cid} ${b.slug} : une seule étiquette`);
    const resume = decoder(m.match(/<details class="niv"><summary>([\s\S]*?)<\/summary>/)[1]);
    assert.match(resume, /^<span class="sr">(Chiffrage|Niveau du chiffre) : <\/span><svg width="20" height="20"[^>]*aria-hidden="true"[^>]*class="niv-ic">[\s\S]*?<\/svg><span class="niv-lib">[^<]+<\/span><svg class="chev"/);
    assert.doesNotMatch(resume, /<p[ >]|class="def"|Pourquoi/, 'la ligne ne contient ni définition ni raison');
    if (resume.includes('Mesure non chiffrée par le parti')) {
      nonChiffrees++;
      assert.ok(resume.startsWith('<span class="sr">Chiffrage : </span>'));
      assert.ok(m.includes('<div class="niv-c"><p class="def">Le candidat ne donne pas le coût de cette mesure.'));
      assert.ok(m.includes('<a class="lnk discret" href="methode.html#chiffrage">Notre méthode</a></div></details>'));
    }
  }
  assert.ok(nonChiffrees > 0);
  const css = fs.readFileSync(path.join(SITE, 'src', 'style.css'), 'utf8');
  const lib = css.match(/\n\.mes-l \.niv>summary\{([^}]*)\}/)[1];
  assert.doesNotMatch(lib, /border:|font-weight:[67]/, 'pas de cadre ni de gras sur la ligne');
  assert.match(lib, /min-height:44px/);
});

test('exigence 5 et critère 3 : détail derrière details et summary (clavier natif), fermé par défaut, aucun survol', () => {
  const html = page(chiffree.cid);
  assert.doesNotMatch(html, /<details class="niv" open/);
  const b = blocs(html).find((x) => x.slug === chiffree.slug);
  const m = mesuresBloc(b)[chiffree.k];
  const niv = m.slice(m.indexOf('<details class="niv">'), m.lastIndexOf('</details>') + 10);
  assert.ok(niv.startsWith('<details class="niv"><summary><span class="sr">Niveau du chiffre : </span>'));
  assert.match(niv, /<div class="niv-c"><p class="def">[^<]+<\/p><p class="t">Pourquoi ce niveau<\/p><p class="raison">[^<]+<\/p>\n<details class="srcch"><summary>[\s\S]*Voir les sources du chiffrage<\/summary>/);
  assert.match(niv, /<dt>Chiffre annoncé<\/dt>/);
  assert.match(niv, /Dernière vérification : /);
  assert.match(niv, /href="panel-sources.html">Méthode et panel de sources<\/a>/);
  const css = fs.readFileSync(path.join(SITE, 'src', 'style.css'), 'utf8');
  assert.doesNotMatch(css, /\.niv[^{]*:hover|\.mes-l[^{]*:hover|\.tb[^{]*:hover/);
  const js = fs.readFileSync(path.join(SITE, 'src', 'app.js'), 'utf8');
  assert.doesNotMatch(js, /\.niv\b|mouseenter|mouseover/);
});

test('exigences 6 et 7, critère 4 : chiffrage annoncé et source datée visibles sans rien déplier', () => {
  let vus = 0;
  for (const cid of ids) {
    const mes = mesuresDe(cid);
    for (const b of blocs(page(cid))) {
      mesuresBloc(b).forEach((m, k) => {
        const x = mes.themes[b.slug][k];
        const hors = decoder(m.replace(/<details class="niv">[\s\S]*<\/details>/, ''));
        if (aUnNombre(x)) { vus++; assert.ok(hors.includes(`<p class="chiffre">Chiffrage annoncé : ${x.chiffrage}</p>`), `${cid} ${b.slug} ${k}`); }
        else assert.ok(!hors.includes('Chiffrage annoncé'));
        assert.match(hors, /<p class="msrc">Source : <a class="lnk" href="[^"]+" target="_blank" rel="noopener">/);
        if (x.source?.date) assert.match(hors, /, publiée le \d{1,2}(er)? [a-zéû]+ \d{4}<\/p>$/);
        else if (x.source?.consulte) assert.match(hors, /, consultée le \d{1,2}(er)? [a-zéû]+ \d{4}<\/p>$/);
        // Ordre : mesure, chiffrage, étiquette, source
        assert.ok(m.indexOf('<p class="mt">') < m.indexOf('<details class="niv">') && m.indexOf('<details class="niv">') < m.indexOf('<p class="msrc">'));
      });
    }
  }
  assert.ok(vus > 0);
});

test('exigence 8 et critère 6 : un thème sans mesure garde son bloc, ses repères, et affiche seulement « Non communiqué. »', () => {
  const n = nbMesures(partiel);
  blocs(page(partiel)).forEach((b, i) => {
    if (n[i]) return;
    assert.match(b.html, /<div class="tb-tete" style="background:#[0-9A-F]{6}"><h2 id="h-[a-z_]+"><span class="emo" aria-hidden="true">/);
    assert.ok(b.html.endsWith('<div class="tb-corps"><p class="nc">Non communiqué.</p></div>'), `${partiel} ${b.slug}`);
  });
});

test('critère 7 : candidat sans aucune mesure, les 10 blocs sont présents et affichent « Non communiqué. »', () => {
  const t = copierSite(); tmps.push(t);
  const f = path.join(t, '05_site/data/mesures', `${complet}.json`);
  const m = lire(f); for (const [s] of THEMES) m.themes[s] = []; fs.writeFileSync(f, JSON.stringify(m));
  const html = generer(t)[`candidat-${complet}.html`];
  const b = blocs(html);
  assert.equal(b.length, 10);
  for (const x of b) assert.ok(x.html.endsWith('<div class="tb-corps"><p class="nc">Non communiqué.</p></div>'));
  assert.doesNotMatch(html, /<li class="mes">/);
  assert.equal((html.match(/<span class="chip-nc">, non communiqué<\/span>/g) || []).length, 20, 'sommaire et menu mobile');
});

test('critère 8 : niveau inconnu, affiché « Mesure chiffrée non évaluable » avec la même ligne discrète', () => {
  const t = copierSite(); tmps.push(t);
  const f = path.join(t, '05_site/data/mesures', `${chiffree.cid}.json`);
  const m = lire(f); m.themes[chiffree.slug][chiffree.k].viabilite = { niveau: 'tres_solide', relu: true, raison: 'Raison à ne pas afficher.' }; fs.writeFileSync(f, JSON.stringify(m));
  const html = generer(t)[`candidat-${chiffree.cid}.html`];
  const mes = mesuresBloc(blocs(html).find((x) => x.slug === chiffree.slug))[chiffree.k];
  assert.match(mes, /<details class="niv"><summary><span class="sr">Niveau du chiffre : <\/span><svg[^>]*class="niv-ic">[\s\S]*?<\/svg><span class="niv-lib">Mesure chiffrée non évaluable<\/span>/);
  assert.ok(!mes.includes('Raison à ne pas afficher.'));
});

test('sommaire : un lien par thème vers son bloc, avec emoji et couleur, sans compteur, thème vide signalé sans être caché', () => {
  for (const cid of [complet, partiel]) {
    const html = page(cid);
    const nav = html.match(/<nav class="somm noprint"[\s\S]*?<\/nav>/)[0];
    const liens = [...nav.matchAll(/<a class="chip" href="#theme-([a-z_]+)" style="--bg:(#[0-9A-F]{6})"><span class="emo" aria-hidden="true">[^<]+<\/span>/g)];
    assert.deepEqual(liens.map((l) => [l[1], l[2]]), THEMES.map(([s, , , bg]) => [s, bg]));
    assert.doesNotMatch(nav, /\d+ mesure|class="nb"/);
    const n = nbMesures(cid);
    assert.equal((nav.match(/chip-nc/g) || []).length, n.filter((x) => !x).length);
    assert.match(html, /<div class="tsel-bloc noprint"><details class="tsel"><summary[^>]*>Aller à un thème/);
  }
});

test('critère 10, neutralité : même structure, même ordre et même mise en forme pour tous les candidats', () => {
  const ref = squelette(page(complet));
  for (const cid of ids) assert.equal(squelette(page(cid)), ref, cid);
});

test('accessibilité : contraste du texte discret d\'au moins 4,5 pour 1 sur fond blanc et sur le fond du détail', () => {
  const lum = (hex) => { const c = hex.match(/\w\w/g).map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const contraste = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const css = fs.readFileSync(path.join(SITE, 'src', 'style.css'), 'utf8');
  const couleurLib = css.match(/\n\.mes-l \.niv>summary\{[^}]*color:(#[0-9A-F]{6})/)[1];
  assert.ok(contraste(couleurLib, '#FFFFFF') >= 4.5);
  assert.ok(contraste(couleurLib, '#F7F6FC') >= 4.5);
  assert.ok(contraste('#3B4656', '#FFFFFF') >= 4.5, 'Non communiqué');
  for (const [, , , bg] of THEMES) assert.ok(contraste('#14202E', bg) >= 4.5, `titre sur ${bg}`);
});

test('mobile et impression : une colonne sous 900 px, menu « Aller à un thème » sous 640 px, sommaire masqué et détails dépliés à l\'impression', () => {
  const css = fs.readFileSync(path.join(SITE, 'src', 'style.css'), 'utf8');
  assert.match(css, /\.grille-tb\{display:grid;grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css, /@media \(min-width:900px\)\{\.grille-tb\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}\}/);
  assert.match(css, /\.page-cand \.somm\{display:none\}\n {2}\.page-cand \.tsel-bloc\{display:block\}/);
  assert.match(css, /\.mes-l \.niv::details-content\{content-visibility:visible\}/);
});
