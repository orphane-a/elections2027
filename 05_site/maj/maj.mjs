#!/usr/bin/env node
// Partie mécanique de la mise à jour (ticket 90). Aucun appel réseau, aucune clé d'API.
// Usage (depuis 05_site) :
//   node maj/maj.mjs [--date AAAA-MM-JJ] [--echecs id1,id2] [--nouveautes fichier.json]
//                    [--contradictions fichier.json] [--essai] [--sans-build]
// --nouveautes     : liste JSON [{ "type": "candidat_declare|programme_publie|candidat_retire", "candidat": "<id>", "source": { "titre", "url", "date" } }]
// --contradictions : liste JSON de phrases, recopiées telles quelles dans le rapport
// --essai          : calcule et affiche le rapport sans rien écrire
// En cas d'erreur, rien n'est écrit, aucune date ne change, et le code de sortie vaut 1.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { preparerMaj, appliquer, texteRapport, heureDeParis } from './lib.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(ICI, '..');
const RACINE = path.resolve(SITE, '..');

function option(nom) {
  const i = process.argv.indexOf(`--${nom}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}
const lireListe = (f) => (f ? JSON.parse(fs.readFileSync(path.resolve(f), 'utf8')) : []);

try {
  const date = option('date') || heureDeParis().date;
  const echecs = (option('echecs') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const nouveautes = lireListe(option('nouveautes'));
  const contradictions = lireListe(option('contradictions'));
  const { ecritures, rapport } = preparerMaj({ racine: RACINE, date, echecs, nouveautes });
  if (!process.argv.includes('--essai')) {
    appliquer(ecritures);
    if (!process.argv.includes('--sans-build')) execFileSync(process.execPath, ['build.mjs', '--preprod'], { cwd: SITE, stdio: 'inherit' });
  }
  console.log(texteRapport(rapport, { contradictions }));
} catch (e) {
  console.error(`Échec de la mise à jour : ${e.message}\nRien n'a été écrit, aucune date n'a changé.`);
  process.exit(1);
}
