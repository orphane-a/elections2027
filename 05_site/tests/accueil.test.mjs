// Tests de la page d'accueil générée (ticket 87).
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
const PHRASE = 'quelques minutes';
let tmp;

function generer(...options) {
  const dossier = path.join(tmp, '05_site');
  fs.rmSync(path.join(dossier, 'public'), { recursive: true, force: true });
  execFileSync(process.execPath, ['build.mjs', '--sans-md', ...options], { cwd: dossier, stdio: 'pipe' });
  return {
    index: fs.readFileSync(path.join(dossier, 'public', 'index.html'), 'utf8'),
    css: fs.readFileSync(path.join(dossier, 'public', 'style.css'), 'utf8'),
  };
}

before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'site-'));
  const dossier = path.join(tmp, '05_site');
  fs.mkdirSync(dossier);
  fs.copyFileSync(path.join(SITE, 'build.mjs'), path.join(dossier, 'build.mjs'));
  fs.cpSync(path.join(SITE, 'data'), path.join(dossier, 'data'), { recursive: true });
  fs.cpSync(path.join(SITE, 'src'), path.join(dossier, 'src'), { recursive: true });
  fs.cpSync(path.join(SITE, 'maj'), path.join(dossier, 'maj'), { recursive: true });
  fs.symlinkSync(path.join(SITE, 'node_modules'), path.join(dossier, 'node_modules'), 'junction');
});

after(() => fs.rmSync(tmp, { recursive: true, force: true }));

for (const [nom, options] of [['prod', []], ['préprod', ['--preprod']]]) {
  test(`accueil ${nom} : la phrase « Une fiche se lit en quelques minutes. » a disparu`, () => {
    const { index } = generer(...options);
    assert.equal(index.includes(PHRASE), false);
  });

  test(`accueil ${nom} : la section des thèmes garde son titre accessible`, () => {
    const { index } = generer(...options);
    assert.match(index, /<section aria-labelledby="themes">/);
    assert.match(index, /<div class="tete-themes"><h2 id="themes">Choisissez un thème <span aria-hidden="true">🗳️<\/span><\/h2><\/div>/);
  });
}

test('style : plus de règle .tete-themes p, le titre garde ses règles', () => {
  const { css } = generer();
  assert.equal(css.includes('.tete-themes p'), false);
  assert.match(css, /\.tete-themes\{[^}]*margin:20px 0 14px/);
  assert.match(css, /\.tete-themes\{margin:14px 0 10px\}/);
  assert.match(css, /\.tete-themes h2\{margin:0;font-weight:600;font-size:26px\}/);
  assert.match(css, /\.tete-themes h2\{font-size:22px\}/);
});

test('le site versionné dans public/ ne contient plus la phrase', () => {
  const index = fs.readFileSync(path.join(SITE, 'public', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(SITE, 'public', 'style.css'), 'utf8');
  assert.equal(index.includes(PHRASE), false);
  assert.equal(css.includes('.tete-themes p'), false);
});

test('accueil : plus de phrase « Point plein… Point pointillé… » sous les thèmes, ni de légende des repères (ticket 89)', () => {
  const { index } = generer();
  assert.equal(index.includes('Point plein'), false);
  assert.equal(index.includes('class="legende"'), false);
  assert.match(index, /<div class="tuiles" style="margin-bottom:40px">/);
});

test('page « Tous les thèmes » : plus de phrase « Point plein… Point pointillé… » (ticket 89)', () => {
  generer();
  const themes = fs.readFileSync(path.join(tmp, '05_site', 'public', 'themes.html'), 'utf8');
  assert.equal(themes.includes('Point plein'), false);
  assert.match(themes, /<div class="tuiles" style="[^"]*margin-bottom:40px">/);
});
