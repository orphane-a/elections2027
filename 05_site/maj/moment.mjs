#!/usr/bin/env node
// Garde horaire de la tâche planifiée (ticket 90).
// La tâche se déclenche à 7h et à 8h UTC le lundi et le jeudi ; ce script ne laisse passer
// que celle qui tombe à 9h heure de Paris (heure d'hiver comme heure d'été).
// Code de sortie 0 : c'est le moment. Code 3 : ce n'est pas le moment, la tâche s'arrête sans rien faire.
// --instant <ISO> permet de tester une autre heure.
import { estMomentDeMaj, heureDeParis } from './lib.mjs';

const i = process.argv.indexOf('--instant');
const instant = i > -1 ? new Date(process.argv[i + 1]) : new Date();
const p = heureDeParis(instant);
if (estMomentDeMaj(instant)) {
  console.log(`Mise à jour du ${p.date} : c'est le moment (9h à Paris).`);
} else {
  console.log(`Pas de mise à jour maintenant (${p.date}, ${p.heure}h à Paris).`);
  process.exit(3);
}
