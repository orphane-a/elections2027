#!/usr/bin/env node
// Mesure d'audience sans cookie (ticket 95) : agrégation quotidienne des journaux Nginx de la prod.
//
// Lancé chaque nuit à 2h par le cron du serveur (voir deploy/visites.cron). Lit le journal de la veille
// (acces-AAAA-MM-JJ.log, une ligne JSON par requête, format défini dans deploy/nginx.prod.conf),
// écrit les totaux anonymes dans stats/AAAA-MM-JJ.json, puis supprime les journaux bruts de plus de
// 7 jours et les totaux de plus de 25 mois.
//
// Visiteur unique = même empreinte sur une journée. Empreinte = SHA 256 (sel du jour + adresse + navigateur).
// Le sel est tiré au hasard à chaque lancement, n'est jamais écrit sur le disque et est effacé de la
// mémoire à la fin : on ne peut ni retrouver l'adresse, ni suivre un visiteur d'un jour à l'autre.
//
// Usage : node agreger.mjs --journaux DOSSIER --stats DOSSIER [--date AAAA-MM-JJ]
//   Sans --date : la veille (en temps universel, comme les noms des journaux).
// Codes de sortie : 0 totaux écrits, 1 journal introuvable ou arguments invalides.
// Aucune dépendance : Node seul.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DOMAINE = 'demandez-le-programme.fr';
export const JOURS_JOURNAUX = 7; // journaux bruts (avec adresses IP) : 7 jours au plus
export const MOIS_TOTAUX = 25; // totaux anonymes : 25 mois au plus

// Robots, outils en ligne de commande, sondes de supervision (dont la vérification de version du kanban Spec to prod).
const ROBOTS = /bot\b|bot[/;_-]|crawl|spider|slurp|scrap|fetch|preview|archiver|facebookexternalhit|embedly|lighthouse|headless|pingdom|uptime|monitor|statuscake|curl|wget|python|httpie|libwww|go-http|java\/|okhttp|axios|node-fetch|undici|node\.js|^node$|spec-to-prod|scan|check/i;
const RECHERCHE = /(^|\.)(google|bing|duckduckgo|qwant|ecosia|yahoo|startpage|search\.brave|yandex|baidu|lilo|lite\.qwant|presearch|perplexity)\./i;
const SOCIAL = /(^|\.)(facebook\.com|fb\.com|fb\.me|instagram\.com|t\.co|twitter\.com|x\.com|linkedin\.com|lnkd\.in|bsky\.app|threads\.net|reddit\.com|tiktok\.com|youtube\.com|youtu\.be|whatsapp\.com|wa\.me|t\.me|telegram\.org|pinterest\.[a-z]+|snapchat\.com|mastodon\.[a-z]+|mstdn\.[a-z]+)$/i;
const MOBILE = /Mobi|Android|iPhone|iPad|iPod|Windows Phone|Opera Mini/i;

const estDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d);
const decaler = (d, jours) => new Date(Date.parse(`${d}T00:00:00Z`) + jours * 86400000).toISOString().slice(0, 10);
export const aujourdhui = () => new Date().toISOString().slice(0, 10);
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const dateFr = (d) => { const [a, m, j] = d.split('-').map(Number); return `${j === 1 ? '1er' : j} ${MOIS[m - 1]} ${a}`; };
const nb = (n) => n.toLocaleString('fr-FR').replace(/ | /g, ' ');

// Une ligne de journal -> objet, ou null si elle est mal formée.
export function lireLigne(texte) {
  let l;
  try { l = JSON.parse(texte); } catch { return null; }
  if (!l || typeof l !== 'object' || typeof l.ip !== 'string' || !l.ip || typeof l.page !== 'string' || !l.page.startsWith('/')) return null;
  const statut = Number(l.statut);
  if (!Number.isInteger(statut)) return null;
  return { ip: l.ip, methode: String(l.methode || 'GET'), page: l.page, statut, ua: String(l.ua || ''), ref: String(l.ref || ''), dnt: String(l.dnt || ''), gpc: String(l.gpc || '') };
}

// Adresse demandée -> page du site (« / », « /sante.html »…), ou null pour un fichier technique.
export function pageDuSite(chemin) {
  let p = chemin.split('?')[0].split('#')[0];
  if (p === '/' || p === '/index' || p === '/index.html') return '/';
  if (p.endsWith('/')) p = p.slice(0, -1);
  const nom = p.slice(p.lastIndexOf('/') + 1);
  if (nom.endsWith('.html')) return p;
  if (nom.includes('.')) return null; // CSS, JS, polices, images, robots.txt, sitemap.xml, version.txt…
  return `${p}.html`; // adresse sans extension, servie par Nginx comme la page .html
}

export const estRobot = (ua) => !ua.trim() || ua === '-' || ROBOTS.test(ua);

// Domaine du référent -> recherche, social, autre site, ou null (navigation interne, pas de référent).
export function sourceDe(domaine) {
  const d = domaine.toLowerCase().replace(/:\d+$/, '');
  if (!d || d === '-') return null;
  if (d === DOMAINE || d.endsWith(`.${DOMAINE}`)) return null;
  if (RECHERCHE.test(`${d}.`) || RECHERCHE.test(d)) return 'recherche';
  if (SOCIAL.test(d)) return 'social';
  return 'autre';
}

export const appareilDe = (ua) => (MOBILE.test(ua) ? 'telephone' : 'ordinateur');

// Cœur du calcul : lignes brutes -> totaux anonymes du jour. Le sel n'est utilisé qu'en mémoire.
export function agreger(lignes, { date, sel }) {
  const r = {
    date, visiteursUniques: 0, pagesVues: 0, pages: {},
    sources: { recherche: 0, social: 0, autre: 0, direct: 0 },
    appareils: { telephone: 0, ordinateur: 0 },
    lignesLues: 0, lignesIgnorees: 0,
    exclues: { techniques: 0, robots: 0, erreurs: 0, nePasSuivre: 0 },
  };
  const visiteurs = new Map(); // empreinte -> { source, appareil }
  for (const brute of lignes) {
    if (!brute.trim()) continue;
    r.lignesLues++;
    const l = lireLigne(brute);
    if (!l) { r.lignesIgnorees++; continue; }
    const page = pageDuSite(l.page);
    if (!page || l.methode !== 'GET') { r.exclues.techniques++; continue; } // HEAD, POST… : sondes et outils
    if (l.statut !== 200 && l.statut !== 304) { r.exclues.erreurs++; continue; }
    if (estRobot(l.ua)) { r.exclues.robots++; continue; }
    if (l.dnt === '1' || l.gpc === '1') { r.exclues.nePasSuivre++; continue; }
    r.pagesVues++;
    r.pages[page] = (r.pages[page] || 0) + 1;
    const empreinte = crypto.createHash('sha256').update(sel).update('\n').update(l.ip).update('\n').update(l.ua).digest('hex');
    let v = visiteurs.get(empreinte);
    if (!v) { v = { source: null, appareil: appareilDe(l.ua) }; visiteurs.set(empreinte, v); }
    if (!v.source) v.source = sourceDe(l.ref);
  }
  r.visiteursUniques = visiteurs.size;
  for (const v of visiteurs.values()) { r.sources[v.source || 'direct']++; r.appareils[v.appareil]++; }
  r.pages = Object.fromEntries(Object.entries(r.pages).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
  visiteurs.clear();
  return r;
}

// Suppression des journaux bruts de plus de 7 jours et des totaux de plus de 25 mois. Renvoie les fichiers supprimés.
export function nettoyer({ journaux, stats, aujourdhui: jour = aujourdhui() }) {
  const supprimes = [];
  const limiteJournaux = decaler(jour, -JOURS_JOURNAUX); // un journal daté de cette date ou avant a 7 jours ou plus
  const [a, m, j] = jour.split('-').map(Number);
  const limiteTotaux = new Date(Date.UTC(a, m - 1 - MOIS_TOTAUX, j)).toISOString().slice(0, 10);
  const balayer = (dossier, motif, garder) => {
    if (!dossier || !fs.existsSync(dossier)) return;
    for (const f of fs.readdirSync(dossier)) {
      const d = f.match(motif)?.[1];
      if (d && !garder(d)) { fs.rmSync(path.join(dossier, f), { force: true }); supprimes.push(f); }
    }
  };
  balayer(journaux, /^acces-(\d{4}-\d{2}-\d{2})\.log(?:\.\d+)?$/, (d) => d > limiteJournaux);
  balayer(stats, /^(\d{4}-\d{2}-\d{2})\.json$/, (d) => d >= limiteTotaux);
  return supprimes;
}

function lireArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--journaux' || k === '--stats' || k === '--date' || k === '--aujourdhui') o[k.slice(2)] = argv[++i];
    else throw new Error(`Option inconnue : ${k}`);
  }
  return o;
}

export function principal(argv, { ecrire = (t) => process.stdout.write(`${t}\n`) } = {}) {
  let o;
  try { o = lireArgs(argv); } catch (e) { ecrire(e.message); return 1; }
  const jour = o.aujourdhui || aujourdhui();
  const date = o.date || decaler(jour, -1);
  if (!o.journaux || !o.stats || !estDate(date) || !estDate(jour)) {
    ecrire('Usage : node agreger.mjs --journaux DOSSIER --stats DOSSIER [--date AAAA-MM-JJ]');
    return 1;
  }
  const sel = crypto.randomBytes(32);
  try {
    const fichier = path.join(o.journaux, `acces-${date}.log`);
    if (!fs.existsSync(fichier)) {
      ecrire(`Journal du ${dateFr(date)} introuvable.`);
      ecrire('Aucun fichier de totaux écrit pour ce jour.');
      return 1;
    }
    const r = agreger(fs.readFileSync(fichier, 'utf8').split('\n'), { date, sel });
    fs.mkdirSync(o.stats, { recursive: true });
    const sortie = path.join(o.stats, `${date}.json`);
    fs.writeFileSync(`${sortie}.tmp`, `${JSON.stringify(r, null, 2)}\n`);
    fs.renameSync(`${sortie}.tmp`, sortie);
    if (r.lignesLues === 0) {
      ecrire(`Aucune visite le ${dateFr(date)}.`);
      ecrire('Fichier écrit avec 0 visite unique et 0 page vue.');
    } else {
      ecrire(`Totaux du ${dateFr(date)} écrits.`);
      ecrire(`Visites uniques : ${nb(r.visiteursUniques)}`);
      ecrire(`Pages vues : ${nb(r.pagesVues)}`);
      ecrire(`Lignes lues : ${nb(r.lignesLues)}, comptées : ${nb(r.pagesVues)}`);
      const e = r.exclues;
      ecrire(`Exclues : ${nb(e.techniques)} fichiers techniques, ${nb(e.robots)} robots, ${nb(e.erreurs)} erreurs (404, 500…), ${nb(e.nePasSuivre)} « ne pas suivre »`);
      if (r.lignesIgnorees) ecrire(`${nb(r.lignesIgnorees)} ligne${r.lignesIgnorees > 1 ? 's' : ''} mal formée${r.lignesIgnorees > 1 ? 's' : ''} ignorée${r.lignesIgnorees > 1 ? 's' : ''}.`);
    }
    return 0;
  } finally {
    sel.fill(0);
    ecrire('Sel du jour supprimé.');
    const supprimes = nettoyer({ journaux: o.journaux, stats: o.stats, aujourdhui: jour });
    if (supprimes.length) ecrire(`Anciens fichiers supprimés : ${supprimes.length}.`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = principal(process.argv.slice(2));
}
