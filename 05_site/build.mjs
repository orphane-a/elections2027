// Générateur du site Elections 2027.
// Usage (depuis 05_site) :  node build.mjs            -> public/ (prod)
//                           node build.mjs --preprod  -> public/ avec bandeau « préproduction »
// Lit data/ (JSON), écrit public/ (HTML statique) et les fiches Markdown de 02_themes et 03_bilan_mandat.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lireJournal, phrase, finPhrase } from './maj/lib.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const DATA = path.join(ICI, 'data');
const OUT = path.join(ICI, 'public');
const PREPROD = process.argv.includes('--preprod');
const AUJOURDHUI = new Date().toISOString().slice(0, 10);
// Adresse publique du site (sert aux balises canonical, au sitemap et au robots.txt).
const SITE_URL = PREPROD ? 'https://preprod.demandez-le-programme.fr' : 'https://demandez-le-programme.fr';
const PAGES_GENEREES = [];
const urlPage = (fichier) => `${SITE_URL}/${fichier === 'index.html' ? '' : fichier}`;

// ---------- Référentiels ----------
const THEMES = [
  { slug: 'education', emoji: '🎓', nom: 'Éducation', sous: 'École, enseignants, enseignement supérieur', bg: '#E3E1FB' },
  { slug: 'ecologie', emoji: '🌿', nom: 'Écologie et énergie', sous: 'Transition, énergies, transports, biodiversité', bg: '#D5F0E5' },
  { slug: 'pouvoir_achat', emoji: '💶', nom: "Pouvoir d'achat", sous: 'Salaires, prix, énergie, fiscalité des ménages', bg: '#FFE6BF' },
  { slug: 'travail', emoji: '💼', nom: 'Travail et emploi', sous: 'Chômage, retraites, conditions de travail', bg: '#D8E7FA' },
  { slug: 'sante', emoji: '❤️', nom: 'Santé', sous: 'Hôpital, déserts médicaux, prévention', bg: '#FBDCE5' },
  { slug: 'logement', emoji: '🏠', nom: 'Logement', sous: 'Loyers, construction, passoires thermiques', bg: '#FAEDB8' },
  { slug: 'securite', emoji: '⚖️', nom: 'Sécurité et justice', sous: 'Délinquance, police, moyens de la justice', bg: '#DDE3EE' },
  { slug: 'immigration', emoji: '🌍', nom: 'Immigration et intégration', sous: 'Asile, titres de séjour, intégration', bg: '#D3EDF1' },
  { slug: 'institutions', emoji: '🏛️', nom: 'Institutions et démocratie', sous: 'Mode de scrutin, référendum, décentralisation', bg: '#EADDF6' },
  { slug: 'europe', emoji: '⭐', nom: 'Europe et international', sous: "Défense, relations avec l'UE, diplomatie", bg: '#FFDACB' },
];
const GROUPES = {
  RN: 'Rassemblement national', LFI: 'La France insoumise', SOC: 'Socialistes et apparentés',
  ECO: 'Écologiste et social', GDR: 'Gauche démocrate et républicaine', EPR: 'Ensemble pour la République (Renaissance)',
  DEM: 'Les Démocrates (MoDem)', HOR: 'Horizons et indépendants', DR: 'Droite républicaine (LR)',
  LIOT: 'LIOT', UDR: 'Union des droites pour la République',
};
const ORIGINES = { gouvernement: 'Gouvernement', parlement: 'Parlement', exterieur: 'Facteur extérieur' };
const GLOSSAIRE = [
  ['Pour, Contre, Abstention', "Position majoritaire du groupe du parti à l'Assemblée nationale lors du scrutin public sur la loi."],
  ['Partagé', "Le groupe s'est divisé sans majorité claire : le décompte est précisé sous la loi."],
  ['Non représenté', "Le groupe n'existait pas à l'Assemblée au moment du vote : il n'a donc pas voté."],
  ['Sans groupe à l\'Assemblée', "Le parti du candidat n'a pas de groupe de députés : pas de vote de groupe à afficher."],
  ['Mesure non chiffrée par le parti', "Le candidat ne donne pas le coût de la mesure. L'étiquette l'indique, sans commentaire : il n'y a pas de chiffre à comparer."],
  ['Non communiqué', "Nous n'avons trouvé aucune proposition publiée et datée du candidat sur ce thème. Nous ne devinons jamais."],
  ['Source contestée', "Des sources sérieuses ne donnent pas le même chiffre. Nous indiquons l'objet du désaccord, la source retenue et l'autre analyse."],
  ['Origine du fait', "Gouvernement, Parlement ou facteur extérieur (conjoncture, crise) : d'où vient ce qui est décrit."],
  ['Dans le cadre validé', "Le chiffre du candidat est cohérent avec les estimations d'au moins deux sources indépendantes."],
  ['Discuté', "Les sources indépendantes ne s'accordent pas, ou le chiffre n'est tenable qu'avec des hypothèses fortes : nous les affichons toutes."],
  ['Mesure chiffrée non évaluable', "Moins de deux sources indépendantes se prononcent, ou la mesure est trop floue pour être chiffrée. Nous ne forçons jamais un niveau."],
  ['Hors du cadre validé', "Au moins deux sources indépendantes jugent le chiffre incompatible avec leurs estimations. Ce niveau juge le chiffre, jamais l'intérêt de la mesure."],
];

// ---------- Utilitaires ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const url = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? esc(u) : '#');
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
function dateFr(d) {
  if (!d) return '';
  const m = String(d).match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (!m) return esc(d);
  const [, a, mo, j] = m;
  if (!mo) return a;
  if (!j) return `${MOIS[+mo - 1]} ${a}`;
  return `${+j === 1 ? '1er' : +j} ${MOIS[+mo - 1]} ${a}`;
}
const lireJSON = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.warn('⚠️  JSON illisible :', path.relative(ICI, f), e.message); return null; } };
const lireDossier = (d) => (fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => lireJSON(path.join(d, f))).filter(Boolean) : []);
const normaliser = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const nomComplet = (c) => `${c.prenom} ${c.nom}`;
const ext = ' target="_blank" rel="noopener"';

// ---------- Données ----------
const candidats = lireDossier(path.join(DATA, 'candidats'))
  .filter((c) => c.statut_publie !== false)
  .sort((a, b) => normaliser(a.nom).localeCompare(normaliser(b.nom)) || normaliser(a.prenom).localeCompare(normaliser(b.prenom)));
const mesures = Object.fromEntries(lireDossier(path.join(DATA, 'mesures')).map((m) => [m.id, m]));
const themesData = Object.fromEntries(lireDossier(path.join(DATA, 'themes')).map((t) => [t.slug, t]));
const explications = Object.fromEntries(lireDossier(path.join(DATA, 'explications')).map((x) => [x.slug, x]));
// Journal des mises à jour (ticket 90) et date de vérification la plus ancienne parmi toutes les fiches.
const JOURNAL = lireJournal(path.join(DATA, 'nouveautes.json'));
const dateFiche = (c) => mesures[c.id]?.date_verif || c.date_maj;
const DERNIERE_VERIF = candidats.map(dateFiche).filter(Boolean).sort()[0] || AUJOURDHUI;

// ---------- Viabilité d'une mesure chiffrée (étiquette à quatre niveaux) ----------
// Spec « Étiquette de mesure chiffrée ». Le niveau juge la solidité d'un chiffre, jamais l'intérêt d'une mesure.
const PANEL = lireJSON(path.join(DATA, 'panel_sources.json')) || { institutions: [] };
const INST = Object.fromEntries((PANEL.institutions || []).map((i) => [i.id, i]));
const NIVEAUX = {
  cadre_valide: { titre: 'Dans le cadre validé', def: "Le chiffre annoncé est cohérent avec les estimations d'au moins deux sources indépendantes.", svg: '<circle cx="10" cy="12" r="2.8" fill="#14202E"/>' },
  discute: { titre: 'Discuté', def: "Les sources indépendantes ne s'accordent pas sur le chiffre, ou il n'est tenable qu'avec des hypothèses fortes. Nous les affichons toutes, sans trancher.", svg: '<circle cx="17" cy="12" r="2.9" fill="#14202E" stroke="#FFFFFF" stroke-width="1.5"/>' },
  non_evaluable: { titre: 'Mesure chiffrée non évaluable', def: "Moins de deux sources indépendantes se prononcent, ou la mesure est trop floue pour être chiffrée. Nous ne forçons jamais un niveau.", pointille: true },
  hors_cadre: { titre: 'Hors du cadre validé', def: "Au moins deux sources indépendantes jugent ce chiffre incompatible avec leurs propres estimations. Ce niveau juge le chiffre, jamais l'intérêt de la mesure.", svg: '<circle cx="20.5" cy="4.5" r="2.8" fill="#14202E"/>' },
  non_chiffree: { titre: 'Mesure non chiffrée par le parti', def: "Le candidat ne donne pas le coût de cette mesure. Il n'y a donc pas de chiffre à comparer aux estimations des institutions. Nous l'indiquons sans commentaire.", pointille: true, svg: '<text x="10" y="16.2" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" font-weight="700" fill="#14202E">?</text>' },
};
const ORDRE_NIVEAUX = ['cadre_valide', 'discute', 'non_evaluable', 'hors_cadre'];
const iconeNiveau = (k) => `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style="flex:none"><rect x="3" y="5" width="14" height="14" rx="3.5" fill="none" stroke="#14202E" stroke-width="1.6"${NIVEAUX[k].pointille ? ' stroke-dasharray="3 2.5"' : ''}/>${NIVEAUX[k].svg || ''}</svg>`;
// Deux institutions « non cumulables » (Cour des comptes et HCFP) comptent pour une seule.
const groupeInst = (id) => ((PANEL.paires_non_cumulables || []).find((p) => p.includes(id)) || [id])[0];
// Règle des deux sources. Renvoie la liste des problèmes : vide = la règle est respectée.
function regleDeuxSources(sources) {
  const pb = [];
  (sources || []).forEach((s) => {
    if (!INST[s.institution]) pb.push(`institution hors panel : ${s.institution}`);
    else if (INST[s.institution].niveau === 3) pb.push(`${INST[s.institution].nom} est un « autre avis », il ne compte pas`);
    if (!/^https?:/.test(s.url || '')) pb.push(`source sans lien (${s.institution})`);
  });
  const valides = [...new Set((sources || []).filter((s) => INST[s.institution] && INST[s.institution].niveau !== 3 && /^https?:/.test(s.url || '')).map((s) => s.institution))];
  const nb = new Set(valides.map(groupeInst)).size;
  if (nb < 2) pb.push(`${nb} institution indépendante, il en faut 2 différentes`);
  else if (!valides.some((id) => INST[id].niveau === 1 && !(PANEL.hors_minimum || []).includes(id))) pb.push('aucune source de niveau 1 hors Cour des comptes et HCFP');
  return pb;
}
const pbViabilite = new Set();
// Niveau affiché pour une mesure. null = pas d'étiquette (mesure sans chiffre).
function viabilite(x, cid, slug) {
  if (!x.chiffrage || !/\d/.test(x.chiffrage)) return null; // pas de montant ni de pourcentage = pas de chiffre à juger
  const v = x.viabilite;
  const dateVerif = v?.date_verif || mesures[cid]?.date_verif || AUJOURDHUI;
  const defaut = {
    niveau: 'non_evaluable',
    raison: "Nous n'avons pas encore relevé deux estimations indépendantes de ce chiffre dans les travaux des institutions du panel. Nous ne forçons pas de niveau.",
    chiffre: x.chiffrage, estimations: "Aucune comparaison possible pour l'instant",
    sources: [], divergentes: [], autres: v?.autres_avis || [], date: dateVerif, brouillon: false,
  };
  if (!v) return defaut;
  if (!NIVEAUX[v.niveau]) { pbViabilite.add(`viabilité ${cid}/${slug} : niveau inconnu « ${v.niveau} » (affiché Mesure chiffrée non évaluable)`); return defaut; }
  if (!v.relu && !PREPROD) return defaut; // en prod, seules les étiquettes relues sont publiées
  if (v.niveau !== 'non_evaluable') {
    const p = regleDeuxSources(v.sources);
    if (p.length) { pbViabilite.add(`viabilité ${cid}/${slug} : « ${NIVEAUX[v.niveau].titre} » ramené à Mesure chiffrée non évaluable (${p.join(' ; ')})`); return defaut; }
  }
  return {
    niveau: v.niveau, raison: v.raison || defaut.raison, chiffre: v.chiffre_annonce || x.chiffrage,
    estimations: v.estimations || defaut.estimations, sources: v.sources || [], divergentes: v.sources_divergentes || [],
    autres: v.autres_avis || [], date: dateVerif, brouillon: !v.relu,
  };
}
const ligneSource = (s) => `<li><a class="lnk" href="${url(s.url)}"${ext}>${esc(INST[s.institution]?.nom || s.institution)}, ${esc(s.titre)}${s.date ? `, ${dateFr(s.date)}` : ''}</a>${s.verdict ? `<span class="m">${esc(s.verdict)}</span>` : ''}</li>`;
// Bloc niveau statique (ticket 92) : visible dès que la mesure est dépliée, sans survol ni second clic.
// Seules les sources du chiffrage restent derrière un lien repliable, ouvert au clic ou au clavier.
const CHEVRON = '<svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9 6l6 6-6 6"/></svg>';
function etiquette(x, cid, slug) {
  const v = viabilite(x, cid, slug);
  if (!v) {
    const n = NIVEAUX.non_chiffree;
    return `<div class="nivbloc">
<p class="niv-t"><span class="sr">Chiffrage : </span>${iconeNiveau('non_chiffree')}<span>${n.titre}</span></p>
<p class="def">${n.def}</p>
<a class="lnk discret" href="methode.html#chiffrage">Notre méthode</a>
</div>`;
  }
  const n = NIVEAUX[v.niveau];
  return `<div class="nivbloc">
<p class="niv-t"><span class="sr">Niveau du chiffre : </span>${iconeNiveau(v.niveau)}<span>${n.titre}</span></p>
<p class="def">${n.def}</p>
<p class="t">Pourquoi ce niveau</p><p class="raison">${esc(v.raison)}</p>
${sourcesChiffrage(v)}
</div>`;
}
// Lien repliable « Voir les sources du chiffrage » : chiffre annoncé, estimations, sources, date de vérification.
const sourcesChiffrage = (v) => `<details class="srcch"><summary>${CHEVRON}Voir les sources du chiffrage</summary>
<div class="srcch-c">
<dl><dt>Chiffre annoncé</dt><dd>${esc(v.chiffre)}</dd><dt>Estimations des sources</dt><dd>${esc(v.estimations)}</dd></dl>
${v.sources.length ? `<p class="t">Sources</p><ul>${v.sources.map(ligneSource).join('')}</ul>` : ''}
${v.divergentes.length ? `<p class="t">Sources qui ne vont pas dans le même sens</p><ul>${v.divergentes.map(ligneSource).join('')}</ul>` : ''}
${v.autres.length ? `<p class="t">Autres avis</p><p class="m">Think tanks qui assument une orientation : affichés pour information, ils ne comptent pas pour le niveau.</p><ul>${v.autres.map(ligneSource).join('')}</ul>` : ''}
${v.brouillon ? '<p><span class="badge-verif" style="margin:0">À relire</span></p>' : ''}<p class="m">Dernière vérification : ${dateFr(v.date)}</p>
<a class="lnk discret" href="panel-sources.html">Méthode et panel de sources</a>
</div></details>`;
// Page candidat (ticket 98) : étiquette réduite à une ligne discrète (icône et intitulé), sous la mesure.
// Tout le détail (définition, « Pourquoi ce niveau », sources) est derrière le même clic, pour tous les niveaux.
// Élément natif details et summary : clic, Entrée ou Espace, aucun survol, fonctionne sans JavaScript.
const iconeNiveauDiscret = (k) => `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="niv-ic"><rect x="3" y="5" width="14" height="14" rx="3.5" fill="none" stroke="currentColor" stroke-width="1.6"${NIVEAUX[k].pointille ? ' stroke-dasharray="3 2.5"' : ''}/>${(NIVEAUX[k].svg || '').replace(/#14202E/g, 'currentColor')}</svg>`;
const CHEVRON_BAS = '<svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6"/></svg>';
function etiquetteDiscrete(x, cid, slug) {
  const v = viabilite(x, cid, slug);
  const k = v ? v.niveau : 'non_chiffree';
  const n = NIVEAUX[k];
  const contenu = v
    ? `<p class="def">${n.def}</p><p class="t">Pourquoi ce niveau</p><p class="raison">${esc(v.raison)}</p>
${sourcesChiffrage(v)}`
    : `<p class="def">${n.def}</p><a class="lnk discret" href="methode.html#chiffrage">Notre méthode</a>`;
  return `<details class="niv"><summary><span class="sr">${v ? 'Niveau du chiffre : ' : 'Chiffrage : '}</span>${iconeNiveauDiscret(k)}<span class="niv-lib">${n.titre}</span>${CHEVRON_BAS}</summary>
<div class="niv-c">${contenu}</div></details>`;
}

// Couleur et logo fixes par parti : teintes réparties à l'angle d'or, même luminosité pour tous (aucun classement)
const partis = [...new Set(candidats.map((c) => c.parti_sigle || c.parti || 'Sans parti'))].sort((a, b) => normaliser(a).localeCompare(normaliser(b)));
const COULEUR = {};
partis.forEach((p, i) => { COULEUR[p] = /^(SE|sans parti|sans étiquette|non précisé)$/i.test(p) ? '#5F6B7A' : `hsl(${Math.round((i * 137.508) % 360)} 58% 32%)`; });
const cleParti = (c) => c.parti_sigle || c.parti || 'Sans parti';
const sigleCourt = (c) => { const s = cleParti(c); return s.length <= 4 ? s : s.split(/[\s-]+/).map((w) => w[0]).join('').slice(0, 4).toUpperCase(); };
const logo = (c, petit) => `<span class="logo-parti${petit ? ' p' : ''}" aria-hidden="true" style="background:${COULEUR[cleParti(c)]}">${esc(sigleCourt(c))}</span>`;
// Photos des candidats et logos des partis (data/images, licences libres Wikimedia Commons, crédits dans credits.json)
const IMAGES = JSON.parse(fs.readFileSync(path.join(DATA, 'images', 'credits.json'), 'utf8'));
const logoDe = (c) => Object.entries(IMAGES.logos).find(([, v]) => v.candidats.includes(c.id))?.[0];
const initiales = (c) => `${(c.prenom || '')[0] || ''}${(c.nom || '').replace(/^(Le|La|De|Du)\s+/i, '')[0] || ''}`.toUpperCase();
const photo = (c, taille = 'm') => IMAGES.photos[c.id]
  ? `<img class="photo ${taille}" style="--pc:${COULEUR[cleParti(c)]}" src="img/photos/${esc(c.id)}.webp" alt="" width="240" height="240" loading="lazy" decoding="async">`
  : `<span class="photo ${taille} sans" style="--pc:${COULEUR[cleParti(c)]}" aria-hidden="true" title="Photo non disponible sous licence libre">${esc(initiales(c))}</span>`;
// Logo officiel si disponible sous licence libre, sinon le repère (sigle + couleur)
const logoParti = (c, petit) => { const l = logoDe(c); return l ? `<span class="logo-img${petit ? ' p' : ''}"><img src="img/logos/${esc(l)}.png" alt="Logo ${esc(c.parti)}" loading="lazy" decoding="async"></span>` : logo(c, petit); };
const credit = (x) => `${esc(x.auteur || 'Auteur inconnu')}, ${esc(x.licence || 'licence non précisée')}, <a class="lnk" href="${url(x.page)}"${ext}>Wikimedia Commons</a>`;

const etatTheme = (slug) => {
  const t = themesData[slug];
  return t && Array.isArray(t.faits) && t.faits.length ? { publie: true, date: t.date_maj } : { publie: false };
};

// ---------- Cloche des nouveautés (ticket 90) ----------
// Contenu écrit à la génération. Le JavaScript sert seulement à ouvrir, fermer et afficher la pastille.
const ICONES_NOUV = { candidat_declare: '🗳️', programme_publie: '📄', candidat_retire: '🚪' };
const parId = (id) => candidats.find((c) => c.id === id);
// Phrase d'une nouveauté, toujours recalculée avec le gabarit unique. Lien vers la fiche si elle existe.
function phraseNouveaute(n, classeLien = '') {
  const c = parId(n.candidat);
  if (!c) return esc(n.phrase || '');
  const lib = `${nomComplet(c)} (${c.parti || 'Sans parti'})`;
  return `<a${classeLien ? ` class="${classeLien}"` : ''} href="candidat-${esc(c.id)}.html">${esc(lib)}</a> ${esc(finPhrase(n.type))}`;
}
const MSG_VIDE = 'Aucun nouveau candidat ni nouveau programme lors de la dernière mise à jour.';
const MSG_ERREUR = "Les nouveautés ne peuvent pas s'afficher pour le moment. Elles restent consultables sur la page des mises à jour.";
const MSG_AUCUNE_MAJ = "La première mise à jour automatique n'a pas encore eu lieu.";
// Coche des listes de points (page Qui sommes nous, section Vos données : ticket 95)
const SVG_COCHE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 6 9 17l-5-5"/></svg>';
const SVG_CLOCHE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
function cloche() {
  const derniere = JOURNAL.ok ? JOURNAL.entrees[0] : null;
  const nouv = derniere?.nouveautes || [];
  let contenu;
  if (!JOURNAL.ok) contenu = `<p class="erreur-encadre" role="status">${MSG_ERREUR}</p>`;
  else if (!derniere) contenu = `<p class="vide">${MSG_AUCUNE_MAJ}</p>`;
  else contenu = `<p class="quand">Mise à jour du ${dateFr(derniere.date)}</p>${nouv.length
    ? `<ul>${nouv.map((n) => `<li><span class="ico" aria-hidden="true">${ICONES_NOUV[n.type] || '🔔'}</span><span>${phraseNouveaute(n)}</span></li>`).join('')}</ul>`
    : `<p class="vide">${MSG_VIDE}</p>`}`;
  return `<div class="cloche" data-maj="${esc(derniere?.date || '')}" data-nb="${nouv.length}">
<a class="cloche-btn cloche-lien" href="nouveautes.html" aria-label="Nouveautés">${SVG_CLOCHE}</a>
<button class="cloche-btn cloche-js" type="button" aria-label="Nouveautés" aria-expanded="false" aria-controls="cloche-pop">${SVG_CLOCHE}</button>
<div class="cloche-pop" id="cloche-pop" role="dialog" aria-labelledby="cloche-titre" tabindex="-1" hidden>
<h2 id="cloche-titre">Nouveautés</h2>
${contenu}
<div class="bas"><a class="lnk" href="nouveautes.html">Toutes les mises à jour</a><button class="fermer" type="button">Fermer</button></div>
</div>
</div>`;
}

// ---------- Gabarit commun ----------
const LOGO_SVG = '<svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><rect x="1" y="1" width="26" height="11" rx="2" fill="#3A35C8"/><rect x="1.75" y="16.75" width="24.5" height="9.5" rx="2" fill="none" stroke="#3A35C8" stroke-width="1.5" stroke-dasharray="4 3"/></svg>';
function page({ fichier, titre, description, courant, corps, scripts = false }) {
  // Navigation principale : mêmes liens et mêmes emojis (décoratifs, masqués aux lecteurs d'écran) sur ordinateur et dans le menu mobile
  const nav = [['themes.html', 'Thèmes', '🗂️'], ['methode.html', 'Méthode', '🔎'], ['candidats.html', 'Candidats', '🧑‍🤝‍🧑'], ['qui-sommes-nous.html', 'Qui sommes nous ?', '👋'], ['signaler.html', 'Signaler une erreur', '🚩']];
  const liensNav = nav.map(([h, l, emo]) => `<a href="${h}"${courant === h ? ' aria-current="page"' : ''}><span class="emo" aria-hidden="true">${emo}</span>${l}</a>`).join('');
  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titre)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${urlPage(fichier)}">
<meta property="og:url" content="${urlPage(fichier)}">
${PREPROD ?'<meta name="robots" content="noindex, nofollow">\n' : ''}<link rel="stylesheet" href="style.css">
<script>document.documentElement.classList.add('js')</script>
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(LOGO_SVG.replace('aria-hidden="true"', 'xmlns="http://www.w3.org/2000/svg"'))}">
</head>
<body>
<a class="skip" href="#contenu">Aller au contenu</a>
${PREPROD ? '<div class="preprod" role="note">Version de préproduction, en cours de relecture : les contenus peuvent encore contenir des erreurs.</div>' : ''}
<div class="wrap">
<header class="top">
<a class="logo" href="index.html">${LOGO_SVG}<span>Programmes 2027</span></a>
<nav class="nav" aria-label="Navigation principale">${liensNav}</nav>
${cloche()}
<details class="burger">
<summary><svg class="bars" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M4 7h16M4 12h16M4 17h16"/></svg><svg class="croix" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>Menu</summary>
<nav class="bmenu" aria-label="Navigation principale (menu mobile)">${liensNav}</nav>
</details>
</header>
<main id="contenu">
${corps}
</main>
<footer class="pied">
<p>Ce site ne recommande aucun vote. Aucun cookie, aucun service tiers : les visites sont comptées de façon anonyme par notre serveur. Dernière vérification de toutes les fiches : ${dateFr(DERNIERE_VERIF)}.</p>
<div class="liens"><a class="lnk" href="methode.html">Méthode complète</a><a class="lnk" href="panel-sources.html">Panel de sources</a><a class="lnk" href="qui-sommes-nous.html">Qui sommes nous ?</a><a class="lnk" href="nouveautes.html">Mises à jour</a><a class="lnk" href="signaler.html">Signaler une erreur</a><a class="lnk" href="historique.html">Historique des corrections</a></div>
</footer>
</div>
<script src="app.js" defer></script>
</body>
</html>
`;
  fs.writeFileSync(path.join(OUT, fichier), html);
  PAGES_GENEREES.push(fichier);
}

// robots.txt et sitemap.xml : la préprod interdit toute indexation, la prod l'autorise.
function robotsEtSitemap() {
  const robots = PREPROD
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
  fs.writeFileSync(path.join(OUT, 'robots.txt'), robots);
  const urls = [...PAGES_GENEREES].sort((a, b) => (a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b)))
    .map((f) => `  <url><loc>${urlPage(f)}</loc><lastmod>${AUJOURDHUI}</lastmod></url>`);
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
}

// ---------- Accueil ----------
function accueil() {
  const tuiles = THEMES.map((t) => {
    const e = etatTheme(t.slug);
    return `<a class="tuile" href="${t.slug}.html" style="background:${t.bg}">
<span class="emo" aria-hidden="true">${t.emoji}</span><h3>${esc(t.nom)}</h3>
<span class="etat"><span class="pt ${e.publie ? 'ok' : 'attente'}" aria-hidden="true"></span><span>${e.publie ? `Publiée le ${dateFr(e.date)}` : 'En préparation'}</span></span></a>`;
  }).join('\n');
  const cands = candidats.map((c) => `<a class="cand" href="candidat-${esc(c.id)}.html">${photo(c)}<span class="txt"><span class="nm">${esc(nomComplet(c))}</span><span class="pt2">${esc(c.parti || 'Sans parti')}</span></span>${logoParti(c, true)}</a>`).join('\n');
  const regles = [
    ['Mêmes règles pour tous', "Même gabarit, 3 mesures au maximum par thème, même ton. Les candidats sont présentés dans l'ordre alphabétique."],
    ["Sources publiques d'abord", 'Programmes officiels, déclarations datées, textes de loi, rapports et statistiques publiques. Chaque information renvoie vers sa source.'],
    ['Des faits, pas de jugements', 'Nous décrivons ce qui est proposé et ce qui a été fait. Pas de note, pas de classement, pas de recommandation de vote.'],
    ['Des corrections publiques', 'Une erreur repérée ? Signalez-la. Réponse sous 72 heures, correction publique et datée.'],
  ];
  page({
    fichier: 'index.html', titre: 'Programmes 2027 : comparer les candidats thème par thème',
    description: "Comparer, thème par thème, les propositions des candidats déclarés à l'élection présidentielle 2027 et le bilan du dernier mandat, avec les sources.",
    corps: `<section class="hero">
<h1>Les programmes de 2027, thème par thème</h1>
<p>Choisissez un sujet : ce qu'a fait le dernier mandat, ce que propose chaque candidat et la source de chaque information.</p>
</section>
<section aria-labelledby="themes">
<div class="tete-themes"><h2 id="themes">Choisissez un thème <span aria-hidden="true">🗳️</span></h2></div>
<div class="tuiles" style="margin-bottom:40px">${tuiles}</div>
</section>
<section class="bloc" aria-labelledby="cands-t">
<h2 id="cands-t">Tous les candidats, tous les partis <span aria-hidden="true">🧑‍🤝‍🧑</span></h2>
<p class="intro">${candidats.length} candidats déclarés, dans l'ordre alphabétique. Chaque parti garde le même logo et la même couleur sur tout le site : la couleur sert à le repérer, jamais à le classer. <a class="lnk" href="candidats.html">Statut de chaque candidature</a></p>
<div class="cands">${cands}</div>
<p class="small" style="margin:12px 0 0;max-width:66ch">Photos et logos sous licence libre (Wikimedia Commons). Le crédit de chaque photo et de chaque logo figure en bas de la fiche du candidat. Sans photo libre, les initiales sont affichées ; sans logo libre, le sigle du parti.</p>
</section>
<section class="bloc" aria-labelledby="lire">
${blocLire()}
</section>
<section class="bloc" aria-labelledby="regles-t">
<h2 id="regles-t">Nos règles <span aria-hidden="true">⚖️</span></h2>
<div style="margin-top:16px">${regles.map(([t, p]) => `<div class="regle"><h3>${t}</h3><p>${p}</p></div>`).join('')}</div>
</section>`,
  });
}

// ---------- Bloc « Comment lire une fiche » de l'accueil (ticket 91) ----------
// Reprend, dans l'ordre, les intitulés exacts des sections de la page thème (ticket 89).
// tests/lire.test.mjs vérifie que chaque h2 de la page thème est repris ici.
const LIRE_PUCE_PLUS = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="7" fill="none" stroke="#3B4656" stroke-width="1.4"/><path d="M4.5 8h7M8 4.5v7" stroke="#3B4656" stroke-width="1.4"/></svg>';
function blocLire() {
  const puce = (ic, texte) => `<li>${ic === 'plus' ? LIRE_PUCE_PLUS : svg(I[ic], { t: 16, trait: '#3B4656' })}<span>${texte}</span></li>`;
  const carte = (icone, titre, contenu) => `<li class="lire-carte">
<div class="lire-tete">${icone}<h3>${titre}</h3></div>
${contenu}
</li>`;
  const exemple = THEMES.find((t) => etatTheme(t.slug).publie);
  return `<h2 id="lire">Comment lire une fiche <span aria-hidden="true">👀</span></h2>
<p class="intro">Sur chaque thème, on ne confond jamais ce qui a été voté pendant le mandat et ce qui est proposé pour 2027. Chaque fiche suit le même ordre. <a class="lnk" href="methode.html">Lire la méthode complète</a></p>
<ol class="lire-liste">
${carte(tuile('ampoule'), 'En bref', "<p>L'enjeu du thème en quelques phrases, pour savoir de quoi on parle avant d'entrer dans le détail.</p>")}
${carte(tuile('document'), 'Programmes 2027', `<ul>
${puce('plus', "Une carte par candidat, avec jusqu'à 3 mesures clefs. Dépliez une mesure pour voir le détail, la source et ses dates.")}
${puce('entonnoir', "Un filtre par sous thème pour ne garder qu'un sujet.")}
${puce('horloge', 'Les candidats sans proposition publiée sont listés à part.')}
</ul>`)}
${carte(HEMICYCLE, 'Bilan du mandat : deux votes', `<ul>
${puce('colonnes', 'Deux lois votées pendant le mandat 2022-2027, les mêmes pour tous les groupes.')}
${puce('personnes', "Pour chaque loi, la position majoritaire de chaque groupe à l'Assemblée nationale.")}
${puce('bulle', "Touchez un groupe pour lire la raison qu'il a donnée et voir ses candidats. Un lien mène au scrutin public.")}
</ul>`)}
</ol>
<div class="lire-suite">
<p>En bas de chaque fiche : <strong>Pour aller plus loin</strong>, des liens pour approfondir, puis <strong>Vérification</strong>, avec les dates, la relecture, le signalement d'erreur et l'historique.</p>
${exemple ? `<a class="btn noprint" href="${exemple.slug}.html">Voir un exemple : ${esc(exemple.nom)}</a>` : ''}
</div>`;
}

// ---------- Page de tous les thèmes ----------
function pageThemes() {
  const tuiles = THEMES.map((t) => {
    const e = etatTheme(t.slug);
    return `<a class="tuile" href="${t.slug}.html" style="background:${t.bg}">
<span class="emo" aria-hidden="true">${t.emoji}</span><h2 style="margin:0;font-family:var(--corps);font-size:17px;font-weight:600;line-height:1.25">${esc(t.nom)}</h2>
<span class="small" style="margin:0">${esc(t.sous)}</span>
<span class="etat"><span class="pt ${e.publie ? 'ok' : 'attente'}" aria-hidden="true"></span><span>${e.publie ? `Publiée le ${dateFr(e.date)}` : 'En préparation'}</span></span></a>`;
  }).join('\n');
  page({
    fichier: 'themes.html', titre: 'Tous les thèmes', courant: 'themes.html',
    description: "Les 10 thèmes du site : pour chacun, le bilan du mandat 2022-2027 et les propositions des candidats à la présidentielle 2027.",
    corps: `<div class="bandeau" style="background:#E3E1FB;margin-top:24px"><p class="ariane"><a class="lnk" href="index.html">Accueil</a> › Thèmes</p>
<h1>Tous les thèmes <span aria-hidden="true">🗂️</span></h1>
<p class="sous">${THEMES.length} thèmes. Pour chacun : ce qu'a fait le dernier mandat, ce que propose chaque candidat et la source de chaque information.</p></div>
<div class="tuiles" style="grid-template-columns:repeat(auto-fill,minmax(min(100%,240px),1fr));margin-bottom:40px">${tuiles}</div>`,
  });
}

// ---------- Fiche thème (ticket 89) ----------
// Icônes en SVG en ligne, décoratives (aria-hidden). Aucun emoji sur la page thème.
const svg = (corps, { t = 24, trait = 'currentColor', ep = 2, vb = '0 0 24 24', style = '' } = {}) => `<svg width="${t}" height="${t}" viewBox="${vb}" fill="none" stroke="${trait}" stroke-width="${ep}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"${style ? ` style="${style}"` : ''}>${corps}</svg>`;
const ETOILES = Array.from({ length: 12 }, (_, k) => { const a = (k * Math.PI) / 6; return `<circle cx="${(12 + 7 * Math.cos(a)).toFixed(2)}" cy="${(12 + 7 * Math.sin(a)).toFixed(2)}" r="1.1" fill="#3A35C8" stroke="none"/>`; }).join('');
const LOGOS_THEMES = {
  education: '<path d="M2 9.5 12 4.5l10 5-10 5z" fill="#EADDF6"/><path d="M6 11.5V16c0 1.6 2.7 3 6 3s6-1.4 6-3v-4.5"/><path d="M22 9.5V15"/>',
  ecologie: '<path d="M5 19c0-8.5 5-14 15-15 0 10-5.5 15-14 15z" fill="#EADDF6"/><path d="M5 19c3-4.5 6.5-7.5 10.5-9.5"/>',
  pouvoir_achat: '<path d="M3 4h2.2l2.3 10.5h10.8l2-7.5H6.4"/><circle cx="9.5" cy="19" r="1.6"/><circle cx="16.5" cy="19" r="1.6"/>',
  travail: '<rect x="3" y="7.5" width="18" height="12.5" rx="2" fill="#EADDF6"/><path d="M9 7.5V5.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5v2"/><path d="M3 13h18"/>',
  sante: '<path d="M12 20.5s-7.5-4.6-7.5-10.4A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.7c0 5.8-7.5 10.4-7.5 10.4z" fill="#EADDF6"/><path d="M7.5 12h2.5l1.2-2.2 2 4.4 1.3-2.2h2"/>',
  logement: '<path d="M3 11 12 4l9 7"/><path d="M5.5 9.5V20h13V9.5" fill="#EADDF6"/><path d="M10 20v-5.5h4V20"/>',
  securite: '<path d="M12 3 19.5 6v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z" fill="#EADDF6"/><path d="M9 12l2.2 2.2L15.5 10"/>',
  immigration: '<circle cx="12" cy="12" r="9" fill="#EADDF6"/><path d="M3 12h18"/><path d="M12 3c2.4 2.5 3.7 5.5 3.7 9s-1.3 6.5-3.7 9c-2.4-2.5-3.7-5.5-3.7-9S9.6 5.5 12 3z"/>',
  institutions: '<path d="M2 9.5 12 3l10 6.5z" fill="#EADDF6"/><path d="M4 10.5h16"/><path d="M5.5 11v7M9.8 11v7M14.2 11v7M18.5 11v7"/><path d="M3.5 18.5h17M2 21h20"/>',
  europe: `<circle cx="12" cy="12" r="10.5" fill="#EADDF6" stroke="none"/>${ETOILES}`,
};
const logoTheme = (t) => `<span class="th-logo" aria-hidden="true">${svg(LOGOS_THEMES[t.slug] || LOGOS_THEMES.institutions, { t: 38, trait: '#3A35C8', ep: 1.6 })}</span>`;
const I = {
  ampoule: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z"/>',
  document: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h5"/>',
  colonnes: '<path d="M3 21h18M5 21V10M19 21V10M9.5 21V10M14.5 21V10M2 10l10-6 10 6z"/>',
  lien: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  imprimante: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
  entonnoir: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  horloge: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  drapeau: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
  calendrier: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  bulle: '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  personnes: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5a5 5 0 0 1 6 4.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
  marteau: '<path d="M14 4l6 6M12.5 5.5l6 6M9 9l6 6"/><path d="M11 7l-6.5 6.5a1.5 1.5 0 0 0 0 2.1l1.9 1.9a1.5 1.5 0 0 0 2.1 0L15 11"/><path d="M4 21h9"/>',
  main: '<path d="M4 11h3v9H4z"/><path d="M7 19h8.5a2 2 0 0 0 2-1.6l1.2-5.4A2 2 0 0 0 16.7 9.6H13V6a2 2 0 0 0-2-2l-4 7"/>',
  loi: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8.5 14.5l2.2 2.2 4.3-4.3"/>',
};
const ICONE_EXT = '<svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true" focusable="false" class="ext"><path d="M6 3H3v10h10v-3M9 2h5v5M14 2 7 9" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
const NOUVEL_ONGLET = '<span class="sr"> (s\'ouvre dans un nouvel onglet)</span>';
const tuile = (nom) => `<span class="tuile-ic" aria-hidden="true">${svg(I[nom], { trait: '#3A35C8', ep: 1.9 })}</span>`;
const HEMICYCLE = '<span class="tuile-ic" aria-hidden="true"><svg width="30" height="30" viewBox="0 0 32 32" focusable="false"><g fill="#3A35C8"><circle cx="4" cy="24" r="2.2"/><circle cx="6" cy="16.5" r="2.2"/><circle cx="10.5" cy="10" r="2.2"/><circle cx="16" cy="7.5" r="2.2"/><circle cx="21.5" cy="10" r="2.2"/><circle cx="26" cy="16.5" r="2.2"/><circle cx="28" cy="24" r="2.2"/><circle cx="10" cy="22" r="2"/><circle cx="13" cy="16" r="2"/><circle cx="19" cy="16" r="2"/><circle cx="22" cy="22" r="2"/></g><rect x="12" y="23" width="8" height="5" rx="1.5" fill="#14202E"/></svg></span>';
const PLUS = '<svg class="plus-moins" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M4.5 8h7" stroke="currentColor" stroke-width="1.4"/><path class="barre-v" d="M8 4.5v7" stroke="currentColor" stroke-width="1.4"/></svg>';

// Positions des groupes : le sens est porté par l'icône et le mot, jamais par la seule couleur (ni vert ni rouge).
const POSITIONS = [
  { cle: 'pour', mot: 'Pour', ic: '<circle cx="12" cy="12" r="11" fill="#3A35C8"/><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' },
  { cle: 'contre', mot: 'Contre', ic: '<circle cx="12" cy="12" r="11" fill="#B45309"/><path d="M8 8l8 8M16 8l-8 8" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>' },
  { cle: 'abstention', mot: 'Abstention', ic: '<circle cx="12" cy="12" r="11" fill="#4A5666"/><path d="M7.5 12h9" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>' },
  { cle: 'partage', mot: 'Partagé', ic: '<circle cx="12" cy="12" r="10.2" fill="#fff" stroke="#4A5666" stroke-width="1.6"/><path d="M12 1.8v20.4" stroke="#4A5666" stroke-width="1.6"/><path d="M12 1.8a10.2 10.2 0 0 1 0 20.4z" fill="#4A5666"/>' },
  { cle: null, mot: 'Non représenté', ic: '<circle cx="12" cy="12" r="10" fill="#fff" stroke="#4A5666" stroke-width="1.6" stroke-dasharray="3 2.5"/><path d="M8 12h8" stroke="#4A5666" stroke-width="2.2" stroke-linecap="round"/>' },
];
const icPos = (p, t = 22) => `<svg width="${t}" height="${t}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style="flex:none">${p.ic}</svg>`;
const clePosition = (val) => (POSITIONS.some((p) => p.cle && p.cle === val) ? val : null);
// Noms courts des groupes à l'Assemblée, affichés sur les pastilles (le nom complet est dans la bulle).
const GROUPES_COURTS = { RN: 'RN', LFI: 'LFI', SOC: 'Socialistes', ECO: 'Écologistes', GDR: 'GDR', EPR: 'Ensemble', DEM: 'MoDem', HOR: 'Horizons', DR: 'Droite républicaine', LIOT: 'LIOT', UDR: 'UDR' };
const NB_VOTES = 2;

// Explication du vote d'un groupe : affichée seulement si elle a un texte et une source,
// et si elle a été relue (en préprod, les brouillons s'affichent avec la mention « À relire »).
const MAX_EXPLI = 160;
function explicationAffichable(slug, v, g) {
  const e = explications[slug]?.votes?.[v.scrutin?.url]?.[g];
  if (!e || !e.texte || !/^https?:\/\//.test(e.source?.url || '')) return null;
  if (!e.relu && !PREPROD) return null;
  return e;
}
const iconeVote = (v) => (/censure/i.test(v.titre) ? I.marteau : /confiance/i.test(v.titre) ? I.main : I.loi);
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
let compteurBulle = 0;
function blocVote(v, k, slug) {
  const cles = Object.keys(GROUPES).filter((g) => v.positions && g in v.positions);
  const parPos = POSITIONS.map((p) => ({ ...p, gs: cles.filter((g) => clePosition(v.positions[g]) === p.cle) })).filter((p) => p.gs.length);
  const resume = `${parPos.map((p) => `${p.gs.length} ${p.mot.toLowerCase()}`).join(', ')}, sur ${pluriel(cles.length, 'groupe')}`;
  const barre = parPos.flatMap((p) => p.gs.map(() => `<span class="seg-${p.cle || 'nr'}"></span>`)).join('');
  const pastille = (g) => {
    const id = `bulle-${++compteurBulle}`;
    const e = explicationAffichable(slug, v, g);
    const lies = candidats.filter((c) => c.groupe_an === g);
    const texte = e ? (e.texte.length > MAX_EXPLI ? e.texte.slice(0, MAX_EXPLI - 1).trimEnd() + '…' : e.texte) : null;
    const raison = e
      ? `<p class="b-raison">${e.relu ? '' : '<span class="brouillon">À relire</span> '}${esc(texte)} <a class="lnk" href="${url(e.source.url)}"${ext}>Voir la source</a>${NOUVEL_ONGLET}</p>`
      : '<p class="b-raison nd">Explication non disponible.</p>';
    const rattaches = lies.length
      ? `Candidat${lies.length > 1 ? 's' : ''} rattaché${lies.length > 1 ? 's' : ''} : ${lies.map((c) => `<a class="lnk" href="candidat-${esc(c.id)}.html">${esc(nomComplet(c))}</a>`).join(', ')}.`
      : 'Aucun candidat déclaré rattaché à ce groupe.';
    return `<li class="gchip"><button type="button" class="gbtn" aria-expanded="false" aria-controls="${id}">${esc(GROUPES_COURTS[g] || g)}${e ? '<span class="ginfo" aria-hidden="true">i</span>' : ''}<span class="sr">, ${esc(GROUPES[g])}${e ? ', pourquoi ce vote' : ''}</span></button>
<div class="bulle" id="${id}"><p class="b-nom">${svg(I.bulle, { t: 16, trait: '#3A35C8' })}${esc(GROUPES[g])}</p>${raison}<p class="b-cands">${svg(I.personnes, { t: 15, trait: '#3B4656', style: 'flex:none;margin-top:2px' })}<span>${rattaches}</span></p></div></li>`;
  };
  return `<article class="vcarte">
<div class="vtete"><span class="vic" aria-hidden="true">${svg(iconeVote(v), { trait: '#fff', ep: 1.8 })}</span>
<div class="vtxt"><p class="vnum">Vote ${k + 1}</p><h3>${esc(v.titre)}</h3><p class="vdate">${svg(I.calendrier, { t: 14, trait: '#3B4656' })}<span>${dateFr(v.date)}</span></p></div></div>
<p class="vphrase">${esc(v.phrase)}</p>
<div><div class="vbarre" aria-hidden="true">${barre}</div><p class="vresume">${resume}</p></div>
${parPos.map((p) => `<div class="vrow vrow-${p.cle || 'nr'}"><p class="vpos">${icPos(p)}<span>${p.mot}</span><span class="vnb">${pluriel(p.gs.length, 'groupe')}</span></p>
<ul class="gliste">${p.gs.map(pastille).join('\n')}</ul></div>`).join('\n')}
<p class="vscrutin"><a class="lnk" href="${url(v.scrutin?.url)}"${ext}>${esc(v.scrutin?.titre || 'Scrutin public')}, Assemblée nationale${ICONE_EXT}</a>${NOUVEL_ONGLET}</p>
</article>`;
}
// Filtre : liste fermée des sous-thèmes du thème, le reste va dans « Autres sujets »
const norm = (x) => normaliser(x || '').replace(/s/g, '').trim();
function categorie(slug, sub) {
  const ref = themesData[slug]?.sous_themes || [];
  return ref.find((r) => norm(r) === norm(sub) || norm(sub).includes(norm(r))) || 'Autres sujets';
}
// Repère du parti sur la carte : logo officiel, sinon pastille couleur avec le sigle officiel, sinon un drapeau.
// Jamais de sigle fabriqué à partir du nom du parti.
function repereParti(c) {
  const l = logoDe(c);
  if (l) return `<span class="pc-logo"><img src="img/logos/${esc(l)}.png" alt="Logo ${esc(c.parti)}" loading="lazy" decoding="async"></span>`;
  const fond = COULEUR[cleParti(c)];
  return c.parti_sigle && !/^(SE|SP|NC)$/i.test(c.parti_sigle)
    ? `<span class="pc-logo sigle" aria-hidden="true" style="background:${fond}">${esc(c.parti_sigle)}</span>`
    : `<span class="pc-logo sigle" aria-hidden="true" style="background:${fond}">${svg(I.drapeau, { t: 16, trait: '#fff' })}</span>`;
}
function carteCandidat(c, slug, col2 = false) {
  const liste = (mesures[c.id]?.themes?.[slug] || []).slice(0, 3);
  const items = liste.map((x, k) => {
    const id = `m-${esc(c.id)}-${k + 1}`;
    const s = x.source || {};
    const dates = [s.date ? `Publiée le ${dateFr(s.date)}.` : '', s.consulte ? `Consultée le ${dateFr(s.consulte)}.` : ''].filter(Boolean).join(' ');
    return `<li class="mes" data-sub="${esc(categorie(slug, x.sous_theme))}">
<button type="button" class="mbtn" aria-expanded="false" aria-controls="${id}">${PLUS}<span class="mt">${esc(x.texte)}</span></button>
<div class="mdet" id="${id}">
${x.sous_theme ? `<p><span class="tag">${esc(x.sous_theme)}</span></p>` : ''}
${x.chiffrage && /\d/.test(x.chiffrage) ? `<p class="chiffre">Chiffrage annoncé : ${esc(x.chiffrage)}</p>` : ''}${etiquette(x, c.id, slug)}
<p class="msource">Source : <a class="lnk" href="${url(s.url)}"${ext}>${esc(s.titre)}${ICONE_EXT}</a>${NOUVEL_ONGLET}${dates ? `<span class="mdates">${dates}</span>` : ''}</p>
</div></li>`;
  }).join('\n');
  return `<li class="pc${col2 ? ' col2' : ''}" id="cand-${esc(c.id)}" style="border-left-color:${COULEUR[cleParti(c)]}">
<div class="pc-tete">${photo(c, 's')}<div class="pc-id"><h3>${esc(nomComplet(c))}</h3><p>${esc(c.parti || 'Sans parti')}</p>${c.a_verifier ? '<span class="badge-verif">Candidature à confirmer</span>' : ''}</div>${repereParti(c)}</div>
<ul class="pc-mes" aria-label="Mesures clefs de ${esc(nomComplet(c))}">${items}</ul>
<p class="aucun-sub" hidden>Aucune mesure clef retenue sur ce sous thème.</p>
</li>`;
}
// Emojis des liens de thèmes (les mêmes que partout sur le site, voir THEMES), décoratifs : masqués aux lecteurs d'écran.
const emoNav = (t) => `<span class="emo" aria-hidden="true">${t.emoji}</span>`;
const lienTheme = (t, courant, cls = '') => `<a${cls ? ` class="${cls}"` : ''} href="${t.slug}.html"${t.slug === courant ? ' aria-current="page"' : ''} style="--bg:${t.bg}">${emoNav(t)}${esc(t.nom)}</a>`;
// Ordinateur : rangée de liens. Mobile (moins de 640 px) : menu déroulant « Choisir un thème », sans JavaScript.
const chipsThemes = (courant) => {
  const actif = THEMES.find((t) => t.slug === courant);
  return `<nav class="chips noprint" aria-label="Thèmes">${THEMES.map((t) => lienTheme(t, courant, 'chip')).join('')}</nav>
<div class="tsel-bloc noprint">
<p class="tsel-lab" id="tsel-lab">Choisir un thème</p>
<details class="tsel">
<summary aria-describedby="tsel-lab" style="--bg:${actif.bg}">${emoNav(actif)}<span><span class="sr">Thème affiché : </span>${esc(actif.nom)}</span><svg class="chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6"/></svg></summary>
<nav aria-label="Thèmes (menu mobile)"><ul>${THEMES.map((t) => `<li>${lienTheme(t, courant)}</li>`).join('')}</ul></nav>
</details>
</div>`;
};

function ficheTheme(t) {
  const d = themesData[t.slug];
  const e = etatTheme(t.slug);
  // Ordre alphabétique : ceux qui ont publié sur ce thème, puis les autres en compact
  const aPublie = (c) => (mesures[c.id]?.themes?.[t.slug] || []).length > 0;
  const publies = candidats.filter(aPublie);
  const enAttente = candidats.filter((c) => !aPublie(c));
  const toutes = publies.flatMap((c) => mesures[c.id].themes[t.slug].slice(0, 3));
  const compte = {};
  toutes.forEach((x) => { const s = categorie(t.slug, x.sous_theme); compte[s] = (compte[s] || 0) + 1; });
  // Deux colonnes : la coupure est fixée à la génération (hauteur estimée, mesures repliées),
  // pour qu'une carte ne change jamais de colonne quand on déplie une mesure.
  // Estimation : en-tête de carte 108 px (marge comprise), puis 24 px de padding et 22,5 px par ligne d'environ 60 caractères par mesure.
  const poids = publies.map((c) => 108 + mesures[c.id].themes[t.slug].slice(0, 3).reduce((n, x) => n + 24 + 22.5 * Math.ceil(String(x.texte).length / 60), 0));
  const totalPoids = poids.reduce((a, b) => a + b, 0);
  let cumul = 0, iCol2 = -1, ecart = Infinity;
  poids.forEach((p, i) => { cumul += p; const e = Math.abs(totalPoids - 2 * cumul); if (i < poids.length - 1 && e < ecart) { ecart = e; iCol2 = i + 1; } });
  const debutCol2 = iCol2 > 0 && iCol2 < publies.length ? publies[iCol2] : null;
  const subs = [...(d?.sous_themes || []), 'Autres sujets'].filter((s) => compte[s]);
  const sansGroupe = candidats.filter((c) => !c.groupe_an || !GROUPES[c.groupe_an]);
  const datesVerif = candidats.map((c) => mesures[c.id]?.date_verif).filter(Boolean).sort();
  const verif = datesVerif[0] || d?.date_maj || AUJOURDHUI;
  const votes = (d?.votes || []).slice(0, NB_VOTES);
  const nbMes = (n) => `${n} mesure${n > 1 ? 's' : ''}`;
  const onglet = (sub, lib, n, actif) => `<button type="button" class="f${actif ? ' on' : ''}" data-sub="${esc(sub)}" aria-pressed="${actif}">${esc(lib)}<span class="nb" aria-hidden="true">${n}</span><span class="sr"> (${nbMes(n)})</span></button>`;

  const compteur = publies.length
    ? `<strong>${publies.length} candidat${publies.length > 1 ? 's' : ''} sur ${candidats.length}</strong> ${publies.length > 1 ? 'ont' : 'a'} publié sur ce thème, soit ${toutes.length} mesure${toutes.length > 1 ? 's' : ''} clef${toutes.length > 1 ? 's' : ''}. Ordre alphabétique, 3 mesures au maximum chacun. Touchez une mesure pour voir son chiffrage et sa source.`
    : `<strong>0 candidat sur ${candidats.length}</strong> a publié sur ce thème.`;
  const filtre = publies.length && subs.length > 1
    ? `<div class="filtre noprint"><p id="filtre-t" class="filtre-t">${svg(I.entonnoir, { t: 16, trait: '#3B4656' })}Filtrer par sous thème</p>
<div class="seg" role="group" aria-labelledby="filtre-t">${onglet('tous', 'Tous', toutes.length, true)}${subs.map((s) => onglet(s, s, compte[s], false)).join('')}</div></div>`
    : '';
  const programmes = publies.length
    ? `${filtre}<p class="sr" role="status" id="filtre-etat"></p><ul class="qpq-liste">${publies.map((c) => carteCandidat(c, t.slug, c === debutCol2)).join('\n')}</ul>`
    : '<p class="qpq-vide">Aucun candidat n\'a encore publié de proposition sur ce thème.</p>';
  const attente = enAttente.length ? `<section id="attente" class="sect" aria-labelledby="att-t">
<h2 id="att-t">${svg(I.horloge, { t: 20, trait: '#4A5666', ep: 1.9 })}Pas encore de proposition publiée sur ce thème <span class="nb">${pluriel(enAttente.length, 'candidat')}</span></h2>
<p class="att-intro">Non communiqué : aucune proposition publiée et datée trouvée. Ils apparaîtront dans « Programmes 2027 » dès qu'ils publieront. Ordre alphabétique.</p>
<ul class="att-liste">${enAttente.map((c) => `<li><a href="candidat-${esc(c.id)}.html">${photo(c, 'xs')}<span class="att-txt"><span class="an">${esc(nomComplet(c))}</span><span class="ap">${esc(c.parti || 'Sans parti')}</span><span class="ap">Non communiqué, vérifié le ${dateFr(mesures[c.id]?.date_verif || verif)}</span></span></a></li>`).join('')}</ul>
</section>` : '';
  const posPresentes = POSITIONS.filter((p) => votes.some((v) => Object.values(v.positions || {}).some((x) => clePosition(x) === p.cle)));
  const bilan = votes.length
    ? `<div class="vlegende">${posPresentes.map((p) => `<span>${icPos(p, 18)}${p.mot}</span>`).join('')}</div>
</div>
<div class="votes2">${votes.map((v, k) => blocVote(v, k, t.slug)).join('\n')}</div>
${sansGroupe.length ? `<p class="sans-groupe">${svg(I.info, { t: 16, trait: '#4A5666', style: 'flex:none;margin-top:3px' })}<span>Sans groupe à l'Assemblée, donc sans vote : ${esc(sansGroupe.map(nomComplet).join(', '))}.</span></p>` : ''}`
    : `</div>
<div class="fait"><p class="txt" style="margin:0 0 6px;font-weight:600">Le bilan du dernier mandat est en cours de rédaction.</p><p class="small" style="margin:0">Il ne dépend pas des programmes de 2027 : il sera publié en premier.</p></div>`;

  page({
    fichier: `${t.slug}.html`, titre: `${t.nom} : bilan et propositions 2027`, courant: 'themes.html', scripts: true,
    description: `${t.nom} : ce que proposent les candidats à la présidentielle 2027 et deux votes du mandat 2022-2027, avec les sources.`,
    corps: `<div class="page-theme">
${chipsThemes(t.slug)}
<div class="bandeau theme" style="background:${t.bg}">
<div class="b-txt">
<p class="ariane"><a class="lnk" href="index.html">Accueil</a> › ${esc(t.nom)}</p>
<h1>${logoTheme(t)}<span>${esc(t.nom)}</span></h1>
<p class="sous">${esc(t.sous)}</p>
<p class="meta">${e.publie ? `Version du ${dateFr(d.date_maj)}. Propositions vérifiées le ${dateFr(verif)}.` : `Propositions vérifiées le ${dateFr(verif)}.`} <a class="lnk" href="methode.html">Comment nous travaillons</a></p>
</div>
<div class="actions noprint"><button type="button" class="btn" id="copier">${svg(I.lien, { t: 18 })}<span role="status">Copier le lien</span></button><button type="button" class="btn" id="imprimer">${svg(I.imprimante, { t: 18 })}Imprimer ou enregistrer en PDF</button></div>
<section id="bref" class="bref" aria-labelledby="bref-t">
<h2 id="bref-t">${svg(I.ampoule, { t: 22, trait: '#3A35C8', ep: 1.9 })}En bref</h2>
<p class="enbref">${esc(d?.en_bref || 'Résumé en préparation.')}</p>
</section>
</div>
<nav class="ancres noprint" aria-label="Accès rapides"><span class="ancres-t">Aller à</span><a class="anc" href="#qpq">${svg(I.document, { t: 18 })}Programmes 2027</a><a class="anc" href="#vote">${svg(I.colonnes, { t: 18 })}Bilan du mandat</a></nav>
<section id="qpq" class="sect" aria-labelledby="qpq-t">
<div class="qpq-tete"><div class="titre-ic">${tuile('document')}<h2 id="qpq-t">Programmes 2027</h2></div>
<p class="compteur">${compteur}</p></div>
${programmes}
</section>
${attente}
<section id="vote" class="sect" aria-labelledby="vote-t">
<div class="vote-tete"><div class="titre-ic">${HEMICYCLE}<div><h2 id="vote-t">Bilan du mandat : deux votes</h2>
<p class="vote-intro">Position majoritaire de chaque groupe à l'Assemblée nationale. Touchez un groupe pour lire la raison qu'il a donnée et voir ses candidats.</p></div></div>
${bilan}
</section>
<section id="plus" class="sect deux t-deux" aria-labelledby="plus-t">
<div class="g"><h2 id="plus-t">Pour aller plus loin</h2></div>
<div class="d"><ul class="plus">${(d?.liens || []).map((l) => `<li><a class="lnk" href="${url(l.url)}"${ext}>${esc(l.titre)}</a><span class="m">${esc(l.type || 'Site externe')}, s'ouvre dans un nouvel onglet</span></li>`).join('')}
<li><a class="lnk" href="candidats.html">Programmes officiels et sites de campagne de chaque candidat</a><span class="m">Page du site</span></li></ul></div>
</section>
<section id="controle" class="sect deux t-deux" aria-labelledby="ctrl-t">
<div class="g"><h2 id="ctrl-t">Vérification</h2></div>
<div class="d"><p style="margin:0 0 12px">Version du ${dateFr(d?.date_maj || AUJOURDHUI)}. Dernière vérification des propositions : ${dateFr(verif)}. Relecture : en attente de relecture humaine (version V0).</p>
<p class="small" style="margin:0 0 12px;max-width:60ch">Vous repérez une erreur ou une mesure mal présentée ? Signalez-la : nous répondons sous 72 heures et la correction est publique.</p>
<div class="noprint" style="display:flex;flex-wrap:wrap;align-items:center;gap:4px 24px"><a class="btn noir" href="signaler.html">Signaler une erreur</a><a class="lnk" href="historique.html">Historique des modifications</a><a class="lnk" href="methode.html">Méthode complète</a></div></div>
</section>
</div>`,
  });
}

// ---------- Candidats ----------
function pageCandidats() {
  const lignes = candidats.map((c) => `<tr><td><a class="lnk" href="candidat-${esc(c.id)}.html">${esc(nomComplet(c))}</a>${c.a_verifier ? '<br><span class="badge-verif">Candidature à confirmer</span>' : ''}</td>
<td data-label="Parti ou mouvement">${esc(c.parti || 'Sans parti')}</td><td data-label="Statut">${esc(c.statut)}${c.date_declaration ? `, ${dateFr(c.date_declaration)}` : ''}</td>
<td data-label="Programme 2027">${c.programme?.url ? `<a class="lnk" href="${url(c.programme.url)}"${ext}>${esc(c.programme.titre || 'Programme')}</a>` : 'Pas encore publié'}</td></tr>`).join('\n');
  page({
    fichier: 'candidats.html', titre: 'Les candidats déclarés', courant: 'candidats.html',
    description: 'Liste des candidats déclarés à la présidentielle 2027, statut de leur candidature et lien vers leur programme.',
    corps: `<div class="bandeau" style="background:#DDE3EE;margin-top:24px"><p class="ariane"><a class="lnk" href="index.html">Accueil</a> › Candidats</p>
<h1>Les candidats déclarés <span aria-hidden="true">🧑‍🤝‍🧑</span></h1>
<p class="sous">Ordre alphabétique. Une candidature n'est officielle qu'après la validation des 500 parrainages par le Conseil constitutionnel. Liste vérifiée le ${dateFr(candidats.map((c) => c.date_maj).filter(Boolean).sort()[0] || AUJOURDHUI)}, mise à jour chaque lundi et chaque jeudi.</p></div>
<div style="overflow-x:auto;margin-bottom:40px"><table class="liste empile"><caption class="sr">Candidats, parti, statut et programme</caption>
<thead><tr><th scope="col">Candidat</th><th scope="col">Parti ou mouvement</th><th scope="col">Statut</th><th scope="col">Programme 2027</th></tr></thead><tbody>${lignes}</tbody></table></div>`,
  });
  for (const c of candidats) {
    const m = mesures[c.id];
    // Un bloc par thème, dans l'ordre de THEMES, même structure pour tous les candidats (règle de neutralité).
    const liste = (t) => (m?.themes?.[t.slug] || []).slice(0, 3);
    const blocs = THEMES.map((t) => {
      const l = liste(t);
      const mes = l.map((x) => {
        const s = x.source || {};
        const quand = s.date ? `, publiée le ${dateFr(s.date)}` : s.consulte ? `, consultée le ${dateFr(s.consulte)}` : '';
        return `<li class="mes"><p class="mt">${esc(x.texte)}</p>
${x.chiffrage && /\d/.test(x.chiffrage) ? `<p class="chiffre">Chiffrage annoncé : ${esc(x.chiffrage)}</p>\n` : ''}${etiquetteDiscrete(x, c.id, t.slug)}
<p class="msrc">Source : <a class="lnk" href="${url(s.url)}"${ext}>${esc(s.titre || 'Source')}</a>${NOUVEL_ONGLET}${quand}</p></li>`;
      }).join('\n');
      return `<section class="tb" id="theme-${t.slug}" aria-labelledby="h-${t.slug}">
<div class="tb-tete" style="background:${t.bg}"><h2 id="h-${t.slug}"><span class="emo" aria-hidden="true">${t.emoji}</span>${esc(t.nom)}</h2><a class="lnk cmp" href="${t.slug}.html#cand-${esc(c.id)}">Comparer sur ce thème</a></div>
<div class="tb-corps">${l.length ? `<ul class="mes-l">${mes}</ul>` : '<p class="nc">Non communiqué.</p>'}</div>
</section>`;
    }).join('\n');
    // Sommaire : un lien par thème, sans compteur de mesures. Thème vide : suffixe neutre, ni grisé ni caché.
    const lienSomm = (t) => `<a class="chip" href="#theme-${t.slug}" style="--bg:${t.bg}">${emoNav(t)}${esc(t.nom)}${liste(t).length ? '' : '<span class="chip-nc">, non communiqué</span>'}</a>`;
    const sommaire = `<nav class="somm noprint" aria-labelledby="somm-t"><p class="somm-t" id="somm-t">Ses propositions, thème par thème</p><div class="chips">${THEMES.map(lienSomm).join('')}</div></nav>
<div class="tsel-bloc noprint"><details class="tsel"><summary style="--bg:#fff">Aller à un thème${CHEVRON_BAS}</summary><nav aria-label="Thèmes de cette fiche (menu mobile)"><ul>${THEMES.map((t) => `<li>${lienSomm(t)}</li>`).join('')}</ul></nav></details></div>`;
    page({
      fichier: `candidat-${c.id}.html`, titre: `${nomComplet(c)} : propositions 2027`, courant: 'candidats.html',
      description: `Propositions de ${nomComplet(c)} (${c.parti || 'sans parti'}) pour la présidentielle 2027, thème par thème, avec les sources.`,
      corps: `<div class="bandeau" style="background:#fff;border:1px solid var(--trait);border-top:8px solid ${COULEUR[cleParti(c)]};margin-top:24px">
<p class="ariane"><a class="lnk" href="index.html">Accueil</a> › <a class="lnk" href="candidats.html">Candidats</a> › ${esc(nomComplet(c))}</p>
<h1 style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">${photo(c, 'l')}${esc(nomComplet(c))}</h1>
<p class="sous" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">${logoParti(c)}<span>${esc(c.parti || 'Sans parti')} · ${c.groupe_an && GROUPES[c.groupe_an] ? `Groupe à l'Assemblée : ${esc(GROUPES[c.groupe_an])}` : "Sans groupe à l'Assemblée"}${c.groupe_an_note ? ` (${esc(c.groupe_an_note)})` : ''}</span></p>
<p class="meta">Statut : ${esc(c.statut)}${c.date_declaration ? `, déclaration le ${dateFr(c.date_declaration)}` : ''}.${c.statut_detail ? ` ${esc(c.statut_detail)}` : ''}</p>
${c.a_verifier ? '<p><span class="badge-verif">Candidature à confirmer : une seule source ou des sources divergentes</span></p>' : ''}
<p class="meta">${c.programme?.url ? `Programme : <a class="lnk" href="${url(c.programme.url)}"${ext}>${esc(c.programme.titre)}</a>${c.programme.date ? `, ${dateFr(c.programme.date)}` : ''}` : 'Programme 2027 pas encore publié.'}${c.site_campagne ? ` · <a class="lnk" href="${url(c.site_campagne)}"${ext}>Site de campagne</a>` : ''}</p>
<p class="meta">Dernière vérification : ${dateFr(m?.date_verif || c.date_maj)}. Niveau de confiance des sources : ${esc(c.confiance || 'non évalué')}.</p></div>
<div class="page-cand">
${sommaire}
<div class="grille-tb">
${blocs}
</div>
</div>
<section class="deux"><div class="g"><h2 style="margin:0;font-size:22px;font-weight:600">Sources de cette fiche</h2></div><div class="d"><ul class="plus">${(c.sources || []).map((s) => `<li><a class="lnk" href="${url(s.url)}"${ext}>${esc(s.titre)}</a><span class="m">${s.date ? `Publié le ${dateFr(s.date)}. ` : ''}Consulté le ${dateFr(s.consulte || c.date_maj)}</span></li>`).join('')}</ul>
<p class="small">${IMAGES.photos[c.id] ? `Photo : ${credit(IMAGES.photos[c.id])}. ` : 'Photo : aucune photo sous licence libre trouvée à ce jour. '}${logoDe(c) ? `Logo : ${credit(IMAGES.logos[logoDe(c)])}.` : 'Logo : aucun logo sous licence libre trouvé à ce jour, le repère du site (sigle et couleur) est affiché.'}</p></div></section>`,
    });
  }
}

// ---------- Pages de texte ----------
function pageTexte(fichier, titre, description, bg, h1, chapo, sections) {
  page({
    fichier, titre, description, courant: fichier,
    corps: `<div class="bandeau" style="background:${bg};margin-top:24px"><p class="ariane"><a class="lnk" href="index.html">Accueil</a> › ${esc(titre)}</p><h1>${h1}</h1><p class="sous">${chapo}</p></div>
<div class="page-texte">${sections.map(([id, t, html]) => `<section class="deux sect" id="${id}"><div class="g"><h2>${t}</h2></div><div class="d">${html}</div></section>`).join('\n')}</div><div style="height:24px"></div>`,
  });
}
function pagesTexte() {
  pageTexte('methode.html', 'Méthode', 'Règles de sélection, de rédaction et de neutralité du site Programmes 2027.', '#EADDF6',
    'Comment nous travaillons <span aria-hidden="true">⚖️</span>',
    "La confiance est la condition de survie du site. Ces règles sont des exigences, pas des intentions : elles s'appliquent de la même façon à chaque candidat.", [
      ['candidats', 'Quels candidats', `<p>Tous les candidats qui ont déclaré leur candidature, quel que soit leur score dans les sondages. Quand une candidature n'est confirmée que par une seule source, ou que les sources divergent, nous l'indiquons avec l'étiquette « Candidature à confirmer ». La liste est revérifiée régulièrement jusqu'à la publication officielle de la liste du Conseil constitutionnel.</p>`],
      ['principes', 'Nos principes', `<p><strong>Mêmes règles pour tous.</strong> Même gabarit, même nombre de mesures, même ton, ordre alphabétique.</p><p><strong>Sources primaires d'abord.</strong> Programme officiel, site de campagne, puis déclarations publiques datées (interview, discours, tribune) rapportées par un média identifié. Pour le bilan : textes de loi, rapports officiels et statistiques publiques (INSEE, Cour des comptes, ministères, Assemblée nationale).</p><p><strong>Des faits, pas de jugements.</strong> Aucun adjectif qui juge, aucun classement, aucune recommandation de vote.</p><p><strong>Pas de source, pas d'affirmation.</strong> Si une position n'est pas publiée, nous écrivons « Non communiqué ». Nous ne devinons jamais.</p>`],
      ['mesures', 'Choix des mesures clefs', `<p>Une mesure est retenue si le candidat la présente comme prioritaire, ou si elle a un impact concret sur la vie quotidienne. Le même critère s'applique à tous : 3 mesures au maximum par candidat et par thème. Chaque mesure renvoie vers sa source et sa date.</p><p>Si le candidat ne donne pas le coût d'une mesure, l'étiquette « Mesure non chiffrée par le parti » l'indique, sans commentaire. Nous ne produisons pas nos propres estimations : quand une mesure est chiffrée, nous comparons le chiffre aux travaux publics d'institutions indépendantes (voir le bloc suivant).</p>`],
      ['chiffrage', 'Les chiffres des mesures', `<p>Quand un candidat chiffre une mesure, une étiquette indique si ce chiffre est cohérent avec les estimations publiques d'institutions indépendantes. Elle juge la solidité du chiffre, jamais l'intérêt de la mesure. Aucune note globale, aucun classement des candidats.</p><ul class="plus">${['non_chiffree', ...ORDRE_NIVEAUX].map((k) => `<li><span class="niv-chip">${iconeNiveau(k)}${NIVEAUX[k].titre}</span><span class="m" style="margin-top:6px">${NIVEAUX[k].def}</span></li>`).join('')}</ul><p>Un niveau est attribué seulement si au moins deux institutions différentes du panel se prononcent, dont au moins une du premier cercle hors Cour des comptes et Haut Conseil des finances publiques (qui ne se cumulent pas). Sinon, la mesure reste « Mesure chiffrée non évaluable ». Deux notes d'une même institution comptent pour une seule. La même grille et le même seuil s'appliquent à tous les candidats.</p><p>Quand on déplie une mesure avec le bouton « + », on voit tout de suite si elle est chiffrée par le parti, son niveau, ce qu'il veut dire et pourquoi il a été attribué. Le lien « Voir les sources du chiffrage » donne ensuite le chiffre annoncé, les estimations, les sources (y compris celles qui ne vont pas dans le même sens) et la date de vérification. Chaque niveau est relu par une personne avant publication. Une mesure sans chiffre reçoit l'étiquette « Mesure non chiffrée par le parti », qui a la même forme mais n'est pas un niveau : il n'y a rien à comparer.</p><p><a class="lnk" href="panel-sources.html">Voir le panel de sources</a></p>`],
      ['bilan', 'Bilan du mandat et votes', `<p>Le bilan présente, pour chaque thème, 3 à 5 faits du mandat 2022-2027 : lois votées, budgets, résultats mesurés par des organismes publics, avec leur date, leur source et leur origine (gouvernement, Parlement ou facteur extérieur). Il ne désigne ni coupable ni gagnant.</p><p>Pour les votes, nous retenons 2 ou 3 grandes lois du thème et affichons, pour les mêmes lois et pour tous les groupes, la position majoritaire de chaque groupe à l'Assemblée nationale lors du scrutin public, avec le lien vers ce scrutin. Le mandat couvre deux législatures (2022-2024 puis depuis 2024) : un groupe qui n'existait pas encore apparaît « Non représenté ». Chaque candidat est rattaché au groupe où siègent les députés de son parti, ou indiqué « Sans groupe à l'Assemblée ».</p><p>Pour chaque groupe, une phrase de 160 caractères au plus résume la raison que le groupe a lui-même donnée pour son vote, en priorité lors des explications de vote en séance (compte rendu de l'Assemblée nationale), avec le lien vers cette source. Chaque phrase est relue avant publication. Sans source trouvée, nous écrivons « Explication non disponible ».</p><p>Quand des sources sérieuses se contredisent, nous retenons la plus consensuelle et nous signalons la contestation, avec l'objet du désaccord et le lien vers l'autre analyse.</p>`],
      ['etiquettes', 'Comprendre les étiquettes', `<dl class="glo" style="padding:0">${GLOSSAIRE.map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('')}</dl>`],
      ['logos', 'Repères et couleurs des partis', `<p>Chaque parti a un repère (son sigle) et une couleur, identiques sur toutes les pages. Les couleurs sont réparties automatiquement, avec la même intensité pour tous : elles servent à repérer un parti d'un coup d'œil, jamais à le classer. Le nom du parti est toujours écrit à côté.</p><p><strong>Photos et logos.</strong> Nous utilisons uniquement des images publiées sous licence libre ou dans le domaine public sur Wikimedia Commons, avec le nom de l'auteur et la licence. Les photos sont recadrées sur le visage, au même format pour tous. Quand aucune photo libre n'existe, nous affichons les initiales du candidat ; quand aucun logo libre n'existe, le repère du site (sigle et couleur). Un candidat ou son équipe peut nous proposer une photo libre de droits.</p><details><summary class="lnk" style="cursor:pointer">Crédits des images</summary><ul class="plus">${candidats.map((c) => `<li>${esc(nomComplet(c))}<span class="m">${IMAGES.photos[c.id] ? `Photo : ${credit(IMAGES.photos[c.id])}` : 'Photo : non disponible'}. ${logoDe(c) ? `Logo : ${credit(IMAGES.logos[logoDe(c)])}` : 'Logo : repère du site'}.</span></li>`).join('')}${Object.entries(IMAGES.logos).filter(([, v]) => !v.candidats.length).map(([k, v]) => `<li>Logo ${esc(k === 'MODEM' ? 'du MoDem' : k === 'UDR' ? "de l'UDR" : k)} (votes à l'Assemblée)<span class="m">${credit(v)}.</span></li>`).join('')}</ul><p>Dans les votes à l'Assemblée, chaque groupe est repéré par le logo du parti dont il est issu (par exemple le logo du Parti socialiste pour le groupe Socialistes et apparentés). Le groupe LIOT, qui ne correspond à aucun parti, garde son sigle.</p></details>`],
      ['gabarit', "Le gabarit d'une fiche", `<p style="margin:0 0 10px">Chaque fiche thème suit le même ordre, pour tous les candidats.</p><ol class="gabarit"><li><strong>En bref</strong> : l'enjeu du thème en quelques phrases.</li><li><strong>Programmes 2027</strong> : une carte par candidat, jusqu'à 3 mesures clefs à déplier, avec la source et ses dates. Un filtre par sous thème.</li><li><strong>Pas encore de proposition publiée sur ce thème</strong> : les candidats sans mesure publiée, dans l'ordre alphabétique.</li><li><strong>Bilan du mandat : deux votes</strong> : la position majoritaire de chaque groupe à l'Assemblée nationale sur deux lois du mandat 2022-2027, la raison donnée par le groupe, ses candidats et le lien vers le scrutin public.</li><li><strong>Pour aller plus loin</strong> : 5 à 10 liens.</li><li><strong>Vérification</strong> : dates, relecture, signalement d'erreur et historique.</li></ol>`],
      ['production', 'Comment les fiches sont produites', `<p>Cette version (V0) a été préparée avec l'aide d'un assistant d'intelligence artificielle, chargé de rechercher et de résumer les sources publiques selon les règles ci-dessus. Chaque information renvoie vers sa source pour pouvoir être vérifiée. Les fiches sont en cours de relecture humaine.</p>`],
      ['corrections', 'Mises à jour et corrections', `<p>Les programmes évoluent pendant la campagne. Chaque fiche porte sa date de version et de vérification. Une erreur repérée ? <a class="lnk" href="signaler.html">Signalez-la</a> : réponse sous 72 heures, correction publique dans l'<a class="lnk" href="historique.html">historique des corrections</a>. Un candidat ou son équipe peut aussi demander la correction d'une erreur factuelle.</p>`],
    ]);
  pageTexte('qui-sommes-nous.html', 'Qui sommes nous ?', 'Qui porte le site Programmes 2027, comment il est financé et comment le contacter.', '#D3EDF1',
    'Qui est derrière ce site <span aria-hidden="true">🙋</span>', 'Voici qui porte le projet, comment il est financé et comment nous contacter.', [
      ['equipe', 'Qui porte le projet', `<p>Ce site est mené à titre individuel, par une seule personne. Aucun parti, aucun candidat, aucun média n'est derrière le projet.</p><p class="small">[Nom et parcours de la porteuse du projet : à compléter avant la mise en ligne publique.]</p>`],
      ['financement', 'Financement', `<p>Aucun financement d'un parti, d'un candidat ou d'une campagne.</p><p class="small">[Mode de financement : à compléter avant la mise en ligne publique.]</p>`],
      ['limites', 'Ce que nous ne faisons pas', `<p>Pas de recommandation de vote, pas de test d'affinité, pas de commentaires ni de forum. Nous ne produisons pas nos propres estimations économiques (nous comparons les chiffres annoncés aux travaux d'institutions indépendantes, voir le <a class="lnk" href="panel-sources.html">panel de sources</a>) et nous ne couvrons que les mesures clefs, avec un lien vers le programme complet.</p>`],
      ['donnees', 'Vos données', `<p class="lead">Pas de cookie, pas de publicité, aucun service tiers.</p><p class="plus">Pour compter les visites, notre serveur garde 7 jours l'adresse de connexion et le type de navigateur, puis n'en conserve que des totaux anonymes.</p><ul class="points">${[
        "Aucun script de mesure dans les pages : votre navigateur n'envoie rien de plus qu'une simple consultation.",
        'Les totaux (nombre de visites par jour et par page) sont gardés 25 mois au plus et ne sont pas publiés.',
        "Si votre navigateur demande à ne pas être suivi, votre visite n'est pas comptée.",
      ].map((t) => `<li>${SVG_COCHE}<span>${t}</span></li>`).join('')}</ul><p class="plus">Les polices de caractères sont hébergées sur notre serveur.</p>`],
      ['contact', 'Nous contacter', `<p>Pour signaler une erreur ou nous écrire : <a class="lnk" href="signaler.html">page de signalement</a>. Nous répondons sous 72 heures.</p>`],
    ]);
  pageTexte('signaler.html', 'Signaler une erreur', "Signaler une erreur sur le site Programmes 2027.", '#FFE6BF',
    'Signaler une erreur <span aria-hidden="true">✍️</span>', 'Une information fausse, datée ou mal présentée ? Dites-le nous : réponse sous 72 heures, correction publique si l\'erreur est confirmée.', [
      ['quoi', 'Ce qu\'il faut nous indiquer', `<ol><li>La page concernée (copiez son lien).</li><li>L'information qui pose problème.</li><li>La source qui montre l'erreur (lien et date).</li></ol><p>Les équipes de campagne peuvent aussi nous signaler une erreur factuelle sur leur candidat.</p>`],
      ['comment', 'Comment nous écrire', `<p class="small">[Adresse de contact ou formulaire : à brancher avant la mise en ligne publique.]</p>`],
      ['suite', 'Ce qui se passe ensuite', `<p>Nous vérifions la source. Si l'erreur est confirmée, la fiche est corrigée, sa date de version change et la correction est inscrite dans l'<a class="lnk" href="historique.html">historique des corrections</a>.</p>`],
    ]);
  pagePanel();
  const hist = lireJSON(path.join(DATA, 'historique.json')) || [];
  pageTexte('historique.html', 'Historique des corrections', 'Historique public des versions et corrections du site Programmes 2027.', '#DDE3EE',
    'Historique des corrections <span aria-hidden="true">🗂️</span>', 'Chaque version et chaque correction du site, datée.', [
      ['journal', 'Journal', `<ul class="plus">${hist.map((h) => `<li><strong>${dateFr(h.date)}</strong> : ${esc(h.texte)}</li>`).join('')}</ul>`],
    ]);
  pageNouveautes();
}

// ---------- Page des mises à jour (ticket 90) : historique complet, la plus récente en haut ----------
function pageNouveautes() {
  const source = (s) => (s?.url ? ` <span class="src">Source : <a class="lnk" href="${url(s.url)}"${ext}>${esc(s.titre || 'lien')}${s.date ? `, ${dateFr(s.date)}` : ''}</a></span>` : '');
  const liste = !JOURNAL.ok
    ? `<p class="erreur-encadre" role="status">Les mises à jour ne peuvent pas s'afficher pour le moment.</p>`
    : JOURNAL.entrees.length
      ? `<ol class="journal-maj" reversed>${JOURNAL.entrees.map((e) => `<li><h3>Mise à jour du ${dateFr(e.date)}</h3>${e.nouveautes.length
        ? `<ul>${e.nouveautes.map((n) => `<li>${phraseNouveaute(n, 'lnk')}${source(n.source)}</li>`).join('')}</ul>`
        : '<p class="rien">Aucun nouveau candidat ni nouveau programme lors de cette mise à jour.</p>'}</li>`).join('\n')}</ol>`
      : `<p class="rien">${MSG_AUCUNE_MAJ}</p>`;
  page({
    fichier: 'nouveautes.html', titre: 'Mises à jour', courant: 'nouveautes.html',
    description: 'Les nouveaux candidats déclarés et les nouveaux programmes publiés, mise à jour par mise à jour.',
    corps: `<div class="bandeau" style="background:#E6E4F8;margin-top:24px"><p class="ariane"><a class="lnk" href="index.html">Accueil</a> › Mises à jour</p><h1>Mises à jour <span aria-hidden="true">🔔</span></h1><p class="sous">Chaque lundi et chaque jeudi à 9h, toutes les fiches sont vérifiées. Ici, les nouveaux candidats et les nouveaux programmes, du plus récent au plus ancien.</p></div>
<div class="page-texte"><section class="deux sect" id="journal"><div class="g"><h2>Journal</h2><p class="small">Les petites évolutions de mesures sont visibles dans chaque fiche, avec sa date de version.</p><p class="small">Dernière vérification de toutes les fiches : ${dateFr(DERNIERE_VERIF)}.</p></div><div class="d">${liste}</div></section></div><div style="height:24px"></div>`,
  });
}

function pagePanel() {
  const parNiveau = (n) => (PANEL.institutions || []).filter((i) => i.niveau === n);
  const tableau = `<div style="overflow-x:auto"><table class="liste empile" style="min-width:560px"><caption class="sr">Institutions du premier cercle, ce qu'elles apportent et leur point de vigilance</caption><thead><tr><th scope="col">Institution</th><th scope="col">Utile pour</th><th scope="col">Point de vigilance</th></tr></thead><tbody>${parNiveau(1).map((i) => `<tr><th scope="row">${esc(i.nom)}</th><td data-label="Utile pour">${esc(i.utile)}</td><td data-label="Point de vigilance">${esc(i.vigilance)}</td></tr>`).join('')}</tbody></table></div>`;
  const noms = (n) => esc(parNiveau(n).map((i) => i.nom).join(', '));
  pageTexte('panel-sources.html', 'Panel de sources', 'Les institutions qui servent à juger les chiffres des mesures, leurs critères et leurs limites.', '#EADDF6',
    'Qui nous aide à juger les chiffres <span aria-hidden="true">🏛️</span>',
    `Aucune institution n'est neutre à 100 %. Ce qui protège ce site, c'est la pluralité des sources, des critères identiques pour tous et une liste publique. ${PANEL.statut ? esc(PANEL.statut) + ' ' : ''}Dernière mise à jour du panel : ${dateFr(PANEL.date_maj)}.`, [
      ['principe', 'Comment un niveau est attribué', `<p>Une mesure chiffrée reçoit un niveau seulement si au moins deux institutions différentes se prononcent.</p><p>Au moins une relève du premier cercle ci-dessous, hors Cour des comptes et Haut Conseil des finances publiques, qui ne se cumulent pas. Sinon, la mesure reste « Mesure chiffrée non évaluable ». <a class="lnk" href="methode.html#chiffrage">Voir les quatre niveaux</a></p>`],
      ['niveau1', 'Premier cercle', `<p>Ces institutions comptent dans les deux sources minimales.</p>${tableau}`],
      ['niveau2', 'Cadre extérieur', `<p>${noms(2)}.</p><p>Elles servent à juger la trajectoire globale, rarement une mesure précise. Elles comptent comme source, mais jamais seules.</p>`],
      ['niveau3', 'Autres avis', `<p>Les think tanks qui assument une orientation : ${noms(3)}.</p><p>Leurs chiffrages sont affichés dans l'explication sous « Autres avis », pour l'information du visiteur, mais ne comptent jamais pour le niveau.</p>`],
      ['criteres', "Critères d'entrée et d'exclusion", `<ul><li>Indépendance statutaire, ou méthode publiée et reproductible.</li><li>Historique de publications sur les finances publiques ou l'évaluation de politiques.</li><li>Aucun lien avec un parti ou un candidat, financements déclarés.</li><li>Exclusion de toute organisation ou de tout économiste qui soutient publiquement un candidat, quel que soit son camp.</li><li>Liste, critères et historique des ajouts et retraits consultables par tous.</li></ul>`],
      ['vigilance', 'Points de vigilance', `<ul><li><strong>Cour des comptes :</strong> seuls ses rapports chiffrés et factuels sont retenus, pas ses prises de position.</li><li><strong>Haut Conseil des finances publiques :</strong> placé auprès de la Cour des comptes, il n'est pas combiné avec elle pour atteindre le seuil de deux sources.</li></ul>`],
      ['themes', 'Sources de référence par thème', `<ul>${(PANEL.themes_reference || []).map(([a, b]) => `<li>${esc(a)} : ${esc(b)}.</li>`).join('')}</ul>`],
      ['historique', 'Historique du panel', `${(PANEL.historique || []).length ? `<ul class="plus">${PANEL.historique.map((h) => `<li><strong>${dateFr(h.date)}</strong> : ${esc(h.texte)}</li>`).join('')}</ul>` : '<p>Aucun ajout ni retrait depuis la première version de la liste.</p>'}<p>Une institution manque, ou un choix vous semble contestable ? <a class="lnk" href="signaler.html">Écrivez-nous</a> : réponse sous 72 heures, et la réponse est publique.</p>`],
    ]);
}

// ---------- Export Markdown (02_themes, 03_bilan_mandat) ----------
function exportMarkdown() {
  const stamp = AUJOURDHUI.slice(0, 7).replace('-', '_');
  THEMES.forEach((t, i) => {
    const dossier = path.join(RACINE, '02_themes', `${String(i + 1).padStart(2, '0')}_${t.slug}`);
    fs.mkdirSync(dossier, { recursive: true });
    const lignes = [`# ${t.emoji} ${t.nom} : synthèse comparée`, '', `Thème : ${t.nom}`, `Date de mise à jour : ${AUJOURDHUI}`, 'Fichier généré par 05_site/build.mjs à partir de 05_site/data. Ne pas modifier à la main : modifier les JSON.', ''];
    for (const c of candidats) {
      const l = mesures[c.id]?.themes?.[t.slug] || [];
      lignes.push(`## ${nomComplet(c)} (${c.parti || 'sans parti'})`, '');
      if (!l.length) lignes.push('Non communiqué.', '');
      l.forEach((x, k) => lignes.push(`${k + 1}. ${x.texte} ${x.chiffrage ? `(${x.chiffrage})` : '(Mesure non chiffrée par le parti)'} Source : ${x.source?.titre}, ${x.source?.date || 's.d.'}, ${x.source?.url} (consulté le ${x.source?.consulte || AUJOURDHUI})`));
      if (l.length) lignes.push('');
      const id = c.id;
      const fiche = [`# ${t.nom} : ${nomComplet(c)}`, '', `Thème : ${t.nom}`, `Candidat : ${nomComplet(c)} (${c.parti || 'sans parti'})`, `Date de mise à jour : ${mesures[id]?.date_verif || AUJOURDHUI}`, `Niveau de confiance des sources : ${c.confiance || 'non évalué'}`, 'Fichier généré par 05_site/build.mjs.', '', '## Mesures clefs', ''];
      if (!l.length) fiche.push('Non communiqué.');
      l.forEach((x, k) => fiche.push(`${k + 1}. ${x.texte}`, `   Chiffrage : ${x.chiffrage || 'Mesure non chiffrée par le parti'}`, `   Source : ${x.source?.titre}, ${x.source?.date || 's.d.'}, ${x.source?.url} (consulté le ${x.source?.consulte || AUJOURDHUI})`));
      fs.writeFileSync(path.join(dossier, `${id}_${t.slug}_${stamp}.md`), fiche.join('\n') + '\n');
    }
    fs.writeFileSync(path.join(dossier, `synthese_${t.slug}_${stamp}.md`), lignes.join('\n'));
    const d = themesData[t.slug];
    if (d) {
      const b = [`# ${t.emoji} Bilan du mandat 2022-2027 : ${t.nom}`, '', `Thème : ${t.nom}`, `Date de mise à jour : ${d.date_maj}`, 'Fichier généré par 05_site/build.mjs.', '', '## En bref', '', d.en_bref, '', '## Faits', ''];
      d.faits.forEach((f, k) => { b.push(`${k + 1}. ${f.date} (${ORIGINES[f.origine] || f.origine}) : ${f.texte} Source : ${f.source?.titre}, ${f.source?.url} (consulté le ${f.source?.consulte})`); if (f.contestee) b.push(`   Source contestée : ${f.contestee.objet} Source retenue : ${f.contestee.source_retenue}. Autre analyse : ${f.contestee.autre?.url}`); });
      b.push('', '## Votes', '');
      (d.votes || []).forEach((v) => { b.push(`- ${v.titre} (${v.date}, ${v.legislature}) : ${Object.entries(v.positions || {}).map(([g, p]) => `${g} ${p ?? 'non représenté'}`).join(', ')}. ${v.scrutin?.url}`);
        for (const g of Object.keys(v.positions || {})) {
          const e = explications[t.slug]?.votes?.[v.scrutin?.url]?.[g];
          if (e?.relu && e.texte) b.push(`  - Pourquoi ${g} : ${e.texte} Source : ${e.source?.titre}, ${e.source?.url} (consulté le ${e.source?.consulte})`);
        }
      });
      fs.writeFileSync(path.join(RACINE, '03_bilan_mandat', `bilan_${t.slug}_${stamp}.md`), b.join('\n') + '\n');
    }
  });
}

// ---------- Contrôles qualité ----------
function controles() {
  const pb = [];
  for (const c of candidats) {
    const m = mesures[c.id];
    if (!m) { pb.push(`${c.id} : pas de fichier mesures`); continue; }
    for (const t of THEMES) {
      const l = m.themes?.[t.slug];
      if (!Array.isArray(l)) pb.push(`${c.id} : thème ${t.slug} absent`);
      else { if (l.length > 3) pb.push(`${c.id}/${t.slug} : plus de 3 mesures`); l.forEach((x) => { if (!/^https?:/.test(x.source?.url || '')) pb.push(`${c.id}/${t.slug} : mesure sans URL`); }); }
    }
  }
  for (const t of Object.values(themesData)) {
    if (t.faits?.length < 3 || t.faits?.length > 5) pb.push(`${t.slug} : ${t.faits?.length} faits (attendu 3 à 5)`);
    t.faits?.forEach((f) => { if (!/^https?:/.test(f.source?.url || '')) pb.push(`${t.slug} : fait sans URL`); });
    t.votes?.forEach((v) => { if (!/^https?:/.test(v.scrutin?.url || '')) pb.push(`${t.slug} : vote sans scrutin`); });
  }
  // Explications de vote
  let nRelues = 0, nBrouillons = 0, nPositions = 0;
  for (const t of Object.values(themesData)) {
    const x = explications[t.slug];
    const urls = new Set((t.votes || []).map((v) => v.scrutin?.url));
    for (const u of Object.keys(x?.votes || {})) if (!urls.has(u)) pb.push(`explications/${t.slug} : scrutin inconnu ${u}`);
    for (const v of t.votes || []) for (const [g, p] of Object.entries(v.positions || {})) {
      if (!p) continue;
      nPositions++;
      const e = x?.votes?.[v.scrutin?.url]?.[g];
      if (!e) continue;
      if (e.relu) nRelues++; else nBrouillons++;
      if ((e.texte || '').length > MAX_EXPLI) pb.push(`explications/${t.slug}/${g} : ${e.texte.length} caractères (max ${MAX_EXPLI}, texte tronqué)`);
      if (!/^https?:/.test(e.source?.url || '')) pb.push(`explications/${t.slug}/${g} : explication sans source (masquée)`);
    }
  }
  // Étiquettes de viabilité : suivi interne de la répartition des niveaux par candidat (alarme, pas objectif)
  let nChiffrees = 0;
  const repart = {};
  for (const c of candidats) for (const t of THEMES) for (const x of mesures[c.id]?.themes?.[t.slug] || []) {
    const v = viabilite(x, c.id, t.slug);
    if (!v) continue;
    nChiffrees++;
    (repart[c.id] ||= Object.fromEntries(ORDRE_NIVEAUX.map((k) => [k, 0])))[v.niveau]++;
  }
  pb.push(...pbViabilite);
  // Journal des nouveautés : fichier lisible, phrases conformes au gabarit unique
  if (!JOURNAL.ok) pb.push(`data/nouveautes.json : ${JOURNAL.erreur} (la cloche affiche un message d'erreur)`);
  for (const e of JOURNAL.entrees) for (const n of e.nouveautes) {
    const c = parId(n.candidat);
    if (c && n.phrase && n.phrase !== phrase(n.type, c)) pb.push(`nouveautes ${e.date}/${n.candidat} : phrase différente du gabarit (le gabarit est affiché)`);
  }
  console.log(`🏷️  Étiquettes de viabilité : ${nChiffrees} mesures chiffrées. Répartition par candidat (validé / discuté / non évaluable / hors cadre) :`);
  for (const [id, r] of Object.entries(repart)) console.log(`   ${id} : ${ORDRE_NIVEAUX.map((k) => r[k]).join(' / ')}`);
  console.log(`🗳️  Explications de vote : ${nRelues} relues, ${nBrouillons} brouillons à relire, ${nPositions - nRelues - nBrouillons} non disponibles (sur ${nPositions} positions).`);
  return pb;
}

// ---------- Lancement ----------
fs.mkdirSync(path.join(OUT, 'fonts'), { recursive: true });
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.html')) fs.rmSync(path.join(OUT, f));
fs.copyFileSync(path.join(ICI, 'src', 'style.css'), path.join(OUT, 'style.css'));
fs.copyFileSync(path.join(ICI, 'src', 'app.js'), path.join(OUT, 'app.js'));
fs.rmSync(path.join(OUT, 'img'), { recursive: true, force: true });
for (const d of ['photos', 'logos']) fs.cpSync(path.join(DATA, 'images', d), path.join(OUT, 'img', d), { recursive: true });
fs.copyFileSync(path.join(ICI, 'node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2'), path.join(OUT, 'fonts', 'bricolage.woff2'));
fs.copyFileSync(path.join(ICI, 'node_modules/@fontsource-variable/public-sans/files/public-sans-latin-wght-normal.woff2'), path.join(OUT, 'fonts', 'public-sans.woff2'));
accueil();
pageThemes();
THEMES.forEach(ficheTheme);
pageCandidats();
pagesTexte();
robotsEtSitemap();
if (!process.argv.includes('--sans-md')) exportMarkdown();
const pb = controles();
console.log(`✅ Site généré${PREPROD ? ' (préprod)' : ''} : ${candidats.length} candidats, ${Object.keys(themesData).length}/10 thèmes avec bilan, ${Object.keys(mesures).length} fichiers de mesures.`);
if (pb.length) console.log('⚠️  Points à vérifier :\n - ' + pb.join('\n - '));
