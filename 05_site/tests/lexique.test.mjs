// Vérifie que le lexique a quitté les pages thème et reste sur la page Méthode.
// Lancement : npm test (régénère le site avant de vérifier).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(SITE, 'public');
const lire = (f) => fs.readFileSync(path.join(PUBLIC, f), 'utf8');

const pagesTheme = () =>
  fs.readdirSync(PUBLIC).filter((f) => f.endsWith('.html') && lire(f).includes('id="bref-t"'));

before(() => {
  execFileSync(process.execPath, ['build.mjs'], { cwd: SITE, stdio: 'pipe' });
});

test('les 10 pages thème sont générées', () => {
  assert.equal(pagesTheme().length, 10);
});

test('aucune page thème ne contient « Que signifient ces étiquettes »', () => {
  for (const f of pagesTheme()) {
    const html = lire(f);
    assert.ok(!html.includes('Que signifient ces étiquettes'), f);
    assert.ok(!html.includes('class="lexique'), f);
  }
});

test('« Ce qui a été fait » suit directement « En bref »', () => {
  for (const f of pagesTheme()) {
    const html = lire(f);
    const bref = html.indexOf('id="bref"');
    const finBref = html.indexOf('</section>', bref) + '</section>'.length;
    const suite = html.slice(finBref).trimStart();
    assert.ok(suite.startsWith('<section id="fait"'), f);
    assert.ok(html.indexOf('id="fait"') < html.indexOf('id="props"'), f);
  }
});

test('methode.html garde « Comprendre les étiquettes » avec 12 définitions', () => {
  const html = lire('methode.html');
  assert.ok(html.includes('Comprendre les étiquettes'));
  const debut = html.indexOf('id="etiquettes"');
  assert.ok(debut > -1);
  const dl = html.slice(html.indexOf('<dl class="glo"', debut), html.indexOf('</dl>', debut));
  assert.equal((dl.match(/<dt>/g) || []).length, 12);
});

test('le style ne contient plus les règles details.lexique mais garde dl.glo', () => {
  const css = fs.readFileSync(path.join(SITE, 'src', 'style.css'), 'utf8');
  assert.ok(!css.includes('details.lexique'));
  assert.ok(css.includes('dl.glo'));
});
