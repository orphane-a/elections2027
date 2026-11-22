// Tests de la page thème générée (ticket 89 : programmes en tête, deux votes du mandat).
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
const normaliser = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const decoder = (s) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const dossiers = [];

// Copie 05_site dans un dossier temporaire, applique une modification des données, puis génère le site.
function generer(modifier = () => {}, ...options) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'site-theme-'));
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
  return { sortie, page };
}

// Modifie chaque fichier JSON d'un dossier de data/
function modifierTous(data, sous, f) {
  for (const n of fs.readdirSync(path.join(data, sous))) {
    const p = path.join(data, sous, n);
    const j = lire(p);
    f(j);
    fs.writeFileSync(p, JSON.stringify(j));
  }
}

const candidats = fs.readdirSync(path.join(SITE, 'data', 'candidats')).map((f) => lire(path.join(SITE, 'data', 'candidats', f)))
  .filter((c) => c.statut_publie !== false)
  .sort((a, b) => normaliser(a.nom).localeCompare(normaliser(b.nom)) || normaliser(a.prenom).localeCompare(normaliser(b.prenom)));
const nomComplet = (c) => `${c.prenom} ${c.nom}`;
const mesures = (c, slug) => lire(path.join(SITE, 'data', 'mesures', `${c.id}.json`)).themes?.[slug] || [];
const credits = lire(path.join(SITE, 'data', 'images', 'credits.json'));
const aUnLogo = (c) => Object.values(credits.logos).some((v) => v.candidats.includes(c.id));

// Découpe la page : bloc des programmes, cartes, bloc des candidats sans proposition, bloc des votes
const bloc = (html, id) => { const m = html.match(new RegExp(`<section id="${id}"[\\s\\S]*?\\n</section>`)); return m ? m[0] : ''; };
const cartes = (html) => [...bloc(html, 'qpq').matchAll(/<li class="pc(?: col2)?" id="cand-([^"]+)"[\s\S]*?\n<\/li>/g)].map((m) => ({ id: m[1], html: m[0] }));
const enAttente = (html) => [...bloc(html, 'attente').matchAll(/href="candidat-([^"]+)\.html"/g)].map((m) => m[1]);

let base;
before(() => { base = generer(); });
after(() => dossiers.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

for (const slug of THEMES) {
  test(`${slug} : le bloc « Programmes 2027 » est en tête, dans l'ordre de la page`, () => {
    const html = base.page(slug);
    assert.match(html, /<h2 id="qpq-t">Programmes 2027<\/h2>/);
    const ordre = ['class="bandeau theme"', 'id="bref"', 'aria-label="Accès rapides"', 'id="qpq"', 'id="attente"', 'id="vote"', 'id="plus"', 'id="controle"']
      .map((m) => html.indexOf(m)).filter((i) => i !== -1);
    assert.ok(ordre.length >= 7, 'blocs manquants');
    assert.deepEqual(ordre, [...ordre].sort((a, b) => a - b), 'ordre des blocs');
  });

  test(`${slug} : cartes dans l'ordre alphabétique, 3 mesures au maximum, chaque mesure se déplie seule`, () => {
    const html = base.page(slug);
    const ids = cartes(html).map((c) => c.id);
    const attendus = candidats.filter((c) => mesures(c, slug).length).map((c) => c.id);
    assert.deepEqual(ids, attendus);
    for (const c of cartes(html)) {
      const n = (c.html.match(/class="mbtn"/g) || []).length;
      assert.ok(n >= 1 && n <= 3, `${c.id} : ${n} mesures`);
      assert.equal((c.html.match(/class="mbtn" aria-expanded="false" aria-controls="m-/g) || []).length, n);
    }
  });

  test(`${slug} : chaque candidat déclaré est dans les programmes ou en « Non communiqué », jamais les deux`, () => {
    const html = base.page(slug);
    const dans = new Set(cartes(html).map((c) => c.id));
    const attente = enAttente(html);
    for (const c of candidats) {
      const a = dans.has(c.id), b = attente.includes(c.id);
      assert.ok(a !== b, `${c.id} : programmes ${a}, en attente ${b}`);
      assert.equal(a, mesures(c, slug).length > 0, `${c.id} placé au mauvais endroit`);
    }
    if (attente.length) assert.equal((bloc(html, 'attente').match(/Non communiqué, vérifié le \d/g) || []).length, attente.length);
  });

  test(`${slug} : plus de « Tout déplier » ni de lexique des étiquettes`, () => {
    const html = base.page(slug);
    assert.equal(html.includes('Tout déplier'), false);
    assert.equal(html.includes('Tout replier'), false);
    assert.equal(html.includes('Que signifient ces étiquettes'), false);
  });

  test(`${slug} : les 2 votes du thème avec la position de chaque groupe`, () => {
    const html = base.page(slug);
    const votes = bloc(html, 'vote');
    assert.match(votes, /<h2 id="vote-t">Bilan du mandat : deux votes<\/h2>/);
    const articles = [...votes.matchAll(/<article class="vcarte">[\s\S]*?<\/article>/g)].map((m) => m[0]);
    const data = lire(path.join(SITE, 'data', 'themes', `${slug}.json`)).votes.slice(0, 2);
    assert.equal(articles.length, 2);
    const MOTS = { pour: 'pour', contre: 'contre', abstention: 'abstention', partage: 'partage' };
    data.forEach((v, k) => {
      const a = articles[k];
      assert.ok(decoder(a).includes(v.titre), `titre du vote ${k + 1}`);
      assert.match(a, new RegExp(`<p class="vnum">Vote ${k + 1}</p>`));
      for (const [g, p] of Object.entries(v.positions)) {
        const ligne = a.match(new RegExp(`<div class="vrow vrow-${MOTS[p] || 'nr'}">[\\s\\S]*?</ul></div>`));
        assert.ok(ligne, `ligne ${p} absente`);
        assert.match(ligne[0], new RegExp(`<button type="button" class="gbtn" aria-expanded="false" aria-controls="bulle-\\d+">[^<]+(<span class="ginfo"[^>]*>i</span>)?<span class="sr">, [^<]+</span></button>`));
        const noms = [...ligne[0].matchAll(/<span class="sr">, ([^<,]+)/g)].map((m) => decoder(m[1]));
        assert.ok(noms.length >= 1);
      }
      const nbGroupes = Object.keys(v.positions).length;
      assert.equal((a.match(/class="gbtn"/g) || []).length, nbGroupes, `vote ${k + 1} : un bouton par groupe`);
      assert.match(a, new RegExp(`sur ${nbGroupes} groupes</p>`));
    });
    assert.match(votes, /Sans groupe à l'Assemblée, donc sans vote : /);
  });
}

test('institutions : le compteur et le filtre par sous thème affichent le nombre de mesures', () => {
  const html = base.page('institutions');
  const qpq = bloc(html, 'qpq');
  const pub = candidats.filter((c) => mesures(c, 'institutions').length);
  const total = pub.reduce((n, c) => n + Math.min(3, mesures(c, 'institutions').length), 0);
  assert.ok(qpq.includes(`<strong>${pub.length} candidats sur ${candidats.length}</strong> ont publié sur ce thème, soit ${total} mesures clefs.`));
  assert.match(qpq, /Filtrer par sous thème/);
  assert.match(qpq, new RegExp(`data-sub="tous" aria-pressed="true">Tous<span class="nb" aria-hidden="true">${total}</span>`));
  const ref = (qpq.match(/data-sub="Référendum" aria-pressed="false">Référendum<span class="nb" aria-hidden="true">(\d+)<\/span>/) || [])[1];
  assert.equal(+ref, (qpq.match(/<li class="mes" data-sub="Référendum">/g) || []).length);
});

test('la mention « Mesure non chiffrée par le parti » est conservée', () => {
  const c = candidats.find((x) => mesures(x, 'institutions').some((m) => !m.chiffrage));
  const carte = cartes(base.page('institutions')).find((x) => x.id === c.id);
  assert.match(carte.html, /Mesure non chiffrée par le parti/);
  assert.match(carte.html, /Source : <a class="lnk" href="https?:/);
});

test('logo du parti à droite, sinon sigle officiel, sinon drapeau : jamais de sigle fabriqué', () => {
  const html = base.page('institutions');
  for (const { id, html: carte } of cartes(html)) {
    const c = candidats.find((x) => x.id === id);
    const repere = carte.match(/<span class="pc-logo[^"]*"[^>]*>([\s\S]*?)<\/span><\/div>/)[1];
    if (aUnLogo(c)) assert.match(repere, /<img src="img\/logos\//, id);
    else if (c.parti_sigle && !/^(SE|SP|NC)$/i.test(c.parti_sigle)) assert.equal(repere, c.parti_sigle.replace(/&/g, '&amp;'), id);
    else { assert.match(repere, /^<svg[^>]*aria-hidden="true"/, id); assert.equal(repere.replace(/<[^>]+>/g, '').trim(), '', `${id} : lettres dans la pastille`); }
  }
  assert.equal(html.includes('Voir le détail'), false);
});

test('deux colonnes : la coupure est fixée à la génération, une seule carte ouvre la colonne 2', () => {
  for (const slug of THEMES) {
    const html = base.page(slug);
    const n = cartes(html).length;
    assert.equal((bloc(html, 'qpq').match(/<li class="pc col2"/g) || []).length, n > 1 ? 1 : 0, slug);
  }
});

test('les icônes de la page thème sont en SVG ; les seuls emojis sont ceux des liens, masqués aux lecteurs d\'écran', () => {
  const html = base.page('sante');
  // Emojis décoratifs masqués aux lecteurs d'écran : liens de thèmes (.emo) et icônes de la cloche des nouveautés (.ico, ticket 90)
  const sansEmojisDecoratifs = html.replace(/<span class="(?:emo|ico)" aria-hidden="true">[^<]+<\/span>/g, '');
  assert.equal(/\p{Extended_Pictographic}/u.test(sansEmojisDecoratifs.replace(/[©®™]/g, '')), false);
  assert.match(html, /<span class="th-logo" aria-hidden="true"><svg/);
});

// Ticket 89, maquette du 18 novembre 2026 : liens de thèmes, menus mobiles, En bref dans le bandeau
const EMOJIS = { education: '🎓', ecologie: '🌿', pouvoir_achat: '💶', travail: '💼', sante: '❤️', logement: '🏠', securite: '⚖️', immigration: '🌍', institutions: '🏛️', europe: '⭐' };

test('liens de thèmes : un emoji masqué par lien, thème actif signalé, dans la rangée et dans le sélecteur mobile', () => {
  for (const slug of THEMES) {
    const html = base.page(slug);
    const rangee = html.match(/<nav class="chips noprint" aria-label="Thèmes">[\s\S]*?<\/nav>/)[0];
    const mobile = html.match(/<details class="tsel">[\s\S]*?<\/details>/)[0];
    for (const [s, e] of Object.entries(EMOJIS)) {
      const attendu = `<a class="chip" href="${s}.html"${s === slug ? ' aria-current="page"' : ''} style="--bg:#`;
      assert.ok(rangee.includes(attendu), `${slug} : lien ${s}`);
      assert.ok(rangee.includes(`<span class="emo" aria-hidden="true">${e}</span>`), `${slug} : emoji ${s}`);
      assert.ok(mobile.includes(`<span class="emo" aria-hidden="true">${e}</span>`), `${slug} : emoji mobile ${s}`);
    }
    assert.equal((rangee.match(/aria-current="page"/g) || []).length, 1);
    assert.equal((mobile.match(/aria-current="page"/g) || []).length, 1);
    assert.match(html, /<p class="tsel-lab" id="tsel-lab">Choisir un thème<\/p>/);
    assert.match(mobile, new RegExp(`<summary aria-describedby="tsel-lab" style="--bg:#[0-9A-F]{6}"><span class="emo" aria-hidden="true">${EMOJIS[slug]}</span>`));
  }
});

test('en-tête : cinq liens avec emoji masqué, et le même menu dans le bouton « Menu » mobile', () => {
  const html = base.page('logement');
  const nav = html.match(/<nav class="nav" aria-label="Navigation principale">([\s\S]*?)<\/nav>/)[1];
  const menu = html.match(/<details class="burger">[\s\S]*?<nav class="bmenu" aria-label="Navigation principale \(menu mobile\)">([\s\S]*?)<\/nav>/)[1];
  assert.equal(nav, menu);
  for (const e of ['🗂️', '🔎', '🧑‍🤝‍🧑', '👋', '🚩']) assert.ok(nav.includes(`<span class="emo" aria-hidden="true">${e}</span>`), e);
  assert.match(nav, /<a href="themes.html" aria-current="page"><span class="emo" aria-hidden="true">🗂️<\/span>Thèmes<\/a>/);
  assert.match(html, /<details class="burger">\n<summary>[\s\S]*?Menu<\/summary>/);
});

test('En bref est dans le bandeau, sous le titre et les boutons', () => {
  for (const slug of THEMES) {
    const html = base.page(slug);
    const bandeau = html.slice(html.indexOf('class="bandeau theme"'), html.indexOf('aria-label="Accès rapides"'));
    assert.ok(bandeau.indexOf('id="imprimer"') < bandeau.indexOf('<section id="bref" class="bref"'), slug);
    assert.match(bandeau, /<h2 id="bref-t"><svg[^>]*aria-hidden="true"[\s\S]*?<\/svg>En bref<\/h2>\n<p class="enbref">/);
    assert.equal((html.match(/id="bref"/g) || []).length, 1, `${slug} : un seul bloc En bref`);
  }
});

test('style : espacements de la maquette et menus mobiles sous 640 px', () => {
  const css = fs.readFileSync(path.join(SITE, 'src', 'style.css'), 'utf8');
  for (const r of ['.top{position:relative;', 'padding:20px 0;', '.page-theme .chips{gap:10px;padding:24px 0 8px}', 'margin:20px 0 32px;padding:40px 44px;border-radius:28px',
    '.bref{flex:1 1 100%;margin-top:4px;padding:20px 26px 22px;background:rgba(255,255,255,.7);border-radius:18px}', 'max-width:90ch',
    '.qpq-liste{list-style:none;margin:0;padding:0;columns:2;column-gap:28px}', 'margin:0 0 24px;', 'border-radius:14px;box-shadow:0 1px 3px rgba(20,32,46,.06)',
    '.pc-tete{display:flex;align-items:center;gap:14px;padding:14px 20px}', 'width:72px;height:40px', '.mdet{margin:0 10px 16px 38px;']) assert.ok(css.includes(r), r);
  assert.match(css, /@media \(max-width:640px\)\{\n {2}\.page-theme \.chips\{display:none\}\n {2}\.tsel-bloc\{display:block\}\n\}/);
  assert.match(css, /@media \(max-width:640px\)\{\n {2}\.top\{padding:12px 0\}\n {2}\.top \.nav\{display:none\}\n {2}\.burger\{display:block\}\n\}/);
});

test('filtre : un candidat sans mesure sur le sous thème passe sous les autres avec la mention, sans être masqué', () => {
  const js = fs.readFileSync(path.join(SITE, 'src', 'app.js'), 'utf8');
  assert.match(js, /carte\.classList\.toggle\('sans-sub', n === 0\)/);
  assert.match(js, /sans\.forEach\(function \(c\) \{ listeSans\.appendChild\(c\); \}\)/);
  assert.equal(/\.pc[^\n]*hidden = /.test(js), false, 'aucune carte masquée');
  const carte = cartes(base.page('institutions'))[0].html;
  assert.match(carte, /<p class="aucun-sub" hidden>Aucune mesure clef retenue sur ce sous thème\.<\/p>/);
});

test("cas d'erreur : aucun candidat n'a publié sur le thème", () => {
  const { page } = generer((data) => modifierTous(data, 'mesures', (m) => { if (m.themes) m.themes.logement = []; }));
  const html = page('logement');
  const qpq = bloc(html, 'qpq');
  assert.match(qpq, /Aucun candidat n'a encore publié de proposition sur ce thème\./);
  assert.match(qpq, /<strong>0 candidat sur \d+<\/strong> a publié sur ce thème\./);
  assert.equal(qpq.includes('Filtrer par sous thème'), false);
  assert.equal(enAttente(html).length, candidats.length);
});

test("cas d'erreur : thème sans votes publiés", () => {
  const { page } = generer((data) => {
    const f = path.join(data, 'themes', 'travail.json');
    const t = lire(f); t.votes = []; fs.writeFileSync(f, JSON.stringify(t));
  });
  const html = page('travail');
  assert.match(bloc(html, 'vote'), /Le bilan du dernier mandat est en cours de rédaction\./);
  assert.ok(cartes(html).length > 0, 'les programmes restent affichés');
});

test("cas d'erreur : une mesure sans URL valide est signalée par build.mjs", () => {
  const { sortie } = generer((data) => {
    const f = path.join(data, 'mesures', 'attal_gabriel.json');
    const m = lire(f); m.themes.institutions[0].source.url = 'pas-une-url'; fs.writeFileSync(f, JSON.stringify(m));
  });
  assert.match(sortie, /attal_gabriel\/institutions : mesure sans URL/);
});

test('le site versionné dans public/ utilise le nouveau gabarit sur les 10 pages thème', () => {
  for (const slug of THEMES) {
    const html = fs.readFileSync(path.join(SITE, 'public', `${slug}.html`), 'utf8');
    assert.match(html, /<h2 id="qpq-t">Programmes 2027<\/h2>/, slug);
    assert.equal(html.includes('Que signifient ces étiquettes'), false, slug);
  }
});

test('une seule série d\'emojis de thèmes sur tout le site (accueil, page Thèmes, fiches candidat)', () => {
  const dossier = path.join(dossiers[0], '05_site', 'public');
  const lirePage = (f) => fs.readFileSync(path.join(dossier, f), 'utf8');
  for (const f of ['index.html', 'themes.html']) {
    const html = lirePage(f);
    for (const [s, e] of Object.entries(EMOJIS)) assert.match(html, new RegExp(`href="${s}\.html"[^>]*>\n<span class="emo" aria-hidden="true">${e}</span>`), `${f} : ${s}`);
    for (const ancien of ['🌱', '🛒', '🏥', '🛡️', '🇪🇺']) assert.equal(html.includes(ancien), false, `${f} : ${ancien}`);
  }
  const fiche = lirePage(`candidat-${candidats[0].id}.html`);
  for (const [s, e] of Object.entries(EMOJIS)) assert.ok(fiche.includes(`<h2 id="h-${s}"><span class="emo" aria-hidden="true">${e}</span>`), `fiche candidat : ${e}`);
});

test('thème actif : sa couleur légèrement foncée et un encadrement épais, jamais le fond bleu foncé', () => {
  const css = fs.readFileSync(path.join(SITE, 'src', 'style.css'), 'utf8');
  assert.ok(css.includes('.chip[aria-current=page],.tsel li a[aria-current=page],.tsel summary{background:var(--bg);background:color-mix(in srgb,var(--bg) 90%,#14202E);color:var(--texte);border:2.5px solid var(--texte);font-weight:700}'));
  assert.equal(/(chip|tsel)[^{]*{[^}]*background:var(--accent)/.test(css), false);
  assert.match(base.page('sante'), /<summary aria-describedby="tsel-lab" style="--bg:#FBDCE5">/);
});
