// Outils communs aux tests : copie du site dans un dossier temporaire, pour ne jamais toucher aux vraies données.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const RACINE = path.resolve(SITE, '..');

// Copie 05_site (sans public) et 01_candidats dans un dossier temporaire. Renvoie la racine de la copie.
export function copierSite() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'site-'));
  const dossier = path.join(tmp, '05_site');
  fs.mkdirSync(dossier);
  fs.copyFileSync(path.join(SITE, 'build.mjs'), path.join(dossier, 'build.mjs'));
  for (const d of ['data', 'src', 'maj']) fs.cpSync(path.join(SITE, d), path.join(dossier, d), { recursive: true });
  fs.symlinkSync(path.join(SITE, 'node_modules'), path.join(dossier, 'node_modules'));
  fs.cpSync(path.join(RACINE, '01_candidats'), path.join(tmp, '01_candidats'), { recursive: true });
  for (const d of ['02_themes', '03_bilan_mandat']) fs.mkdirSync(path.join(tmp, d));
  return tmp;
}

export function generer(tmp, ...options) {
  const dossier = path.join(tmp, '05_site');
  fs.rmSync(path.join(dossier, 'public'), { recursive: true, force: true });
  execFileSync(process.execPath, ['build.mjs', '--sans-md', ...options], { cwd: dossier, stdio: 'pipe' });
  const pub = path.join(dossier, 'public');
  return Object.fromEntries(fs.readdirSync(pub).filter((f) => f.endsWith('.html')).map((f) => [f, fs.readFileSync(path.join(pub, f), 'utf8')]));
}

export const lire = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
export const ecrire = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n');
