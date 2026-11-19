// Tests de la page « Qui sommes nous ? » (ticket 93).
// Lancer depuis 05_site : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = path.join(SITE, 'public', 'qui-sommes-nous.html');

// Contenu visible du <main>, sans les balises.
const contenuPrincipal = (html) => html.slice(html.indexOf('<main'), html.indexOf('</main>'));
const texte = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const section = (html, id) => {
  const m = html.match(new RegExp(`<section[^>]*id="${id}"[^>]*>([\\s\\S]*?)</section>`));
  assert.ok(m, `section #${id} absente`);
  return m[1];
};
// La date de mise à jour du pied de page change à chaque build : on l'ignore.
const sansDate = (html) => html.replace(/Dernière mise à jour du site : [^<]*/g, 'Dernière mise à jour du site : X');

const html = fs.readFileSync(PAGE, 'utf8');

test('la page ne contient plus de note de travail « à compléter »', () => {
  assert.ok(!html.includes('à compléter'));
  assert.ok(!html.includes('[Mode de financement'));
  assert.ok(!html.includes('[Nom et parcours'));
});

test('le contenu visible de la page ne contient aucun texte entre crochets', () => {
  assert.doesNotMatch(texte(contenuPrincipal(html)), /\[[^\]]*\]/);
});

test('la section equipe affiche seulement la phrase d’indépendance', () => {
  assert.equal(
    texte(section(html, 'equipe')),
    "Qui porte le projet Ce site est mené à titre individuel, par une seule personne. Aucun parti, aucun candidat, aucun média n'est derrière le projet.",
  );
});

test('la section financement affiche seulement la phrase sur les financements', () => {
  assert.equal(
    texte(section(html, 'financement')),
    "Financement Aucun financement d'un parti, d'un candidat ou d'une campagne.",
  );
});

test('les autres sections et les ancres sont toujours là, sans paragraphe vide', () => {
  for (const id of ['equipe', 'financement', 'limites', 'donnees', 'contact']) section(html, id);
  assert.doesNotMatch(contenuPrincipal(html), /<p[^>]*>\s*<\/p>/);
});

test('la source build.mjs ne contient plus les notes de travail', () => {
  const source = fs.readFileSync(path.join(SITE, 'build.mjs'), 'utf8');
  assert.ok(!source.includes('[Nom et parcours de la porteuse du projet'));
  assert.ok(!source.includes('[Mode de financement'));
});

test('un nouveau build produit la même page que celle committée', () => {
  // Build dans une copie temporaire, pour ne rien modifier dans le dépôt.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qsn-'));
  try {
    const copie = path.join(tmp, '05_site');
    fs.mkdirSync(copie);
    fs.mkdirSync(path.join(tmp, '03_bilan_mandat'));
    for (const f of ['build.mjs', 'data', 'src']) fs.cpSync(path.join(SITE, f), path.join(copie, f), { recursive: true });
    fs.symlinkSync(path.join(SITE, 'node_modules'), path.join(copie, 'node_modules'), 'dir');
    execFileSync(process.execPath, ['build.mjs'], { cwd: copie, stdio: 'ignore' });
    const regeneree = fs.readFileSync(path.join(copie, 'public', 'qui-sommes-nous.html'), 'utf8');
    assert.equal(sansDate(regeneree), sansDate(html));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
