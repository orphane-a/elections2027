# 🗃️ Format des données du site (V0)

Tout le site est généré à partir de ces fichiers JSON (UTF-8, indentés sur 2 espaces).
Le script `build.mjs` les transforme en pages HTML dans `public/`.

Règles communes (voir CLAUDE.md à la racine du projet) :
- Pas de source = pas d'affirmation. Chaque élément porte une URL réelle, ouverte et lue.
- Dates au format AAAA-MM-JJ. `consulte` = date de consultation de la source (2026-11-09 pour cette V0).
- Aucun adjectif qui juge, aucune opinion. On décrit.
- Inconnu = on n'écrit rien (tableau vide ou `null`), on ne devine jamais.

Identifiants des thèmes (slug) : `education`, `ecologie`, `pouvoir_achat`, `travail`, `sante`, `logement`, `securite`, `immigration`, `institutions`, `europe`.

Identifiants des groupes à l'Assemblée nationale (clé `groupe_an` et clés des votes) :
`RN` (Rassemblement national), `LFI` (La France insoumise), `SOC` (Socialistes et apparentés), `ECO` (Écologiste et social / Écologiste - NUPES), `GDR` (Gauche démocrate et républicaine, dont PCF), `EPR` (Ensemble pour la République / Renaissance), `DEM` (Les Démocrates / MoDem), `HOR` (Horizons), `DR` (Droite républicaine / Les Républicains), `LIOT` (Libertés, indépendants, outre-mer et territoires), `UDR` (Union des droites pour la République, depuis 2024).

## 1. `data/candidats/<id>.json` (un par candidat, id = nom du fichier de 01_candidats sans .md)

```json
{
  "id": "attal_gabriel",
  "prenom": "Gabriel",
  "nom": "Attal",
  "parti": "Renaissance",
  "parti_sigle": "RE",
  "groupe_an": "EPR",
  "groupe_an_note": "Une phrase si le rattachement est indirect, sinon null",
  "statut": "Déclaré",
  "statut_detail": "Une phrase factuelle, ou null",
  "a_verifier": false,
  "date_declaration": "2026-05-22",
  "site_campagne": "https://... ou null",
  "programme": { "titre": "Intitulé exact", "url": "https://...", "date": "2026-10-01", "type": "PDF|page web" },
  "sources": [ { "titre": "LCP, liste des candidats", "url": "https://...", "date": "2026-10-14", "consulte": "2026-11-09" } ],
  "confiance": "Bon|Moyen|Faible",
  "date_maj": "2026-11-09"
}
```
- `groupe_an` : le groupe dans lequel siègent les députés du parti du candidat, ou `null` si le parti n'a pas de groupe (« Non représenté »).
- `programme` : `null` si aucun programme 2027 n'est publié.
- `a_verifier` : `true` si la candidature n'est confirmée que par une seule source ou par des sources divergentes.

## 2. `data/mesures/<id>.json` (un par candidat)

```json
{
  "id": "attal_gabriel",
  "date_verif": "2026-11-09",
  "programme_publie": false,
  "themes": {
    "education": [
      {
        "texte": "Phrase simple, au présent, qui décrit la proposition (25 mots max).",
        "sous_theme": "École",
        "chiffrage": "Coût annoncé : 2 Md€ par an, financé par ... (ou null)",
        "source": { "titre": "Programme de X, page 14 | Interview de X sur France Inter", "url": "https://...", "date": "2026-09-12", "type": "programme|site|declaration|presse", "consulte": "2026-11-09" }
      }
    ],
    "ecologie": [], "pouvoir_achat": [], "travail": [], "sante": [], "logement": [], "securite": [], "immigration": [], "institutions": [], "europe": []
  }
}
```
- 3 mesures maximum par thème. Les 10 clés de thème sont toujours présentes ; un tableau vide = « non communiqué ».
- `chiffrage: null` (ou un texte sans aucun nombre) → le site affiche l'étiquette « Mesure non chiffrée par le parti » (même forme que les niveaux, mais ce n'est pas un niveau).
- Sources acceptées, par ordre de priorité : programme officiel, site de campagne, déclaration publique datée (interview, discours, tribune) rapportée par un média identifié. Pas de mesure prêtée au candidat par un tiers, pas de rumeur.
- Une mesure annoncée pour la campagne 2027 (ou depuis la déclaration de candidature). Les programmes de 2022 ne comptent pas.

## 3. `data/themes/<slug>.json` (un par thème)

```json
{
  "slug": "education",
  "date_maj": "2026-11-09",
  "en_bref": "2 ou 3 phrases, 60 mots max : l'enjeu du thème, sans jugement.",
  "sous_themes": ["École", "Enseignants", "Enseignement supérieur"],
  "faits": [
    {
      "date": "2023-09",
      "texte": "Fait chiffré, phrase simple.",
      "origine": "gouvernement|parlement|exterieur",
      "source": { "titre": "INSEE, ...", "url": "https://...", "consulte": "2026-11-09" },
      "contestee": null
    }
  ],
  "votes": [
    {
      "titre": "Loi du 14 avril 2023 de financement rectificative de la sécurité sociale (réforme des retraites)",
      "phrase": "Ce que la loi change, en une phrase simple.",
      "date": "2023-03-16",
      "legislature": "XVIe législature (2022-2024)",
      "scrutin": { "titre": "Scrutin public n° 1234", "url": "https://www.assemblee-nationale.fr/dyn/16/scrutins/1234" },
      "positions": { "RN": "contre", "LFI": "contre", "SOC": "contre", "ECO": "contre", "GDR": "contre", "EPR": "pour", "DEM": "pour", "HOR": "pour", "DR": "pour", "LIOT": "contre", "UDR": null }
    }
  ],
  "liens": [ { "titre": "...", "url": "https://...", "type": "PDF|Site officiel|Site externe" } ]
}
```
- `faits` : 3 à 5. `contestee` : `null` ou `{ "objet": "objet du désaccord en une phrase", "source_retenue": "organisme", "autre": { "titre": "...", "url": "https://..." } }`.
- `votes` : 2 ou 3 grandes lois du thème votées pendant le mandat 2022-2027. Position = position majoritaire du groupe lors du scrutin public final à l'Assemblée (`pour|contre|abstention|partage`), `partage` si le groupe s'est divisé sans majorité (décompte dans `phrase`), `null` si le groupe n'existait pas lors de cette législature. Vérifiée sur la page du scrutin (assemblee-nationale.fr, onglet analyse par groupe). Si la page n'est pas vérifiable, ne pas inclure la loi.
- `liens` : 5 à 10 liens « pour aller plus loin ».

## 4. `data/explications/<slug>.json` (un par thème) : pourquoi chaque groupe a voté ainsi

```json
{
  "slug": "ecologie",
  "date_maj": "2026-11-09",
  "votes": {
    "https://www.assemblee-nationale.fr/dyn/16/scrutins/897": {
      "RN": {
        "texte": "Le groupe indique s'opposer au texte car ... (une phrase, 160 caractères max).",
        "orateur": "Prénom Nom",
        "source": { "titre": "Assemblée nationale, compte rendu de la séance du 31 janvier 2023, explications de vote", "url": "https://...", "date": "2023-01-31", "type": "compte_rendu|explication_vote|communique|declaration", "consulte": "2026-11-09" },
        "relu": false
      },
      "SOC": null
    }
  }
}
```
- Clé = l'URL exacte du scrutin (`scrutin.url` du fichier thème). Clés de groupe = celles de `positions`.
- `texte` : le motif **donné par le groupe lui-même**, reformulé de façon neutre (« Le groupe indique… », « Selon le groupe… »). Une phrase, 160 caractères max. Aucun adjectif qui juge, aucun avis.
- Source prioritaire : les explications de vote dans le compte rendu de séance de l'Assemblée nationale, juste avant le scrutin. À défaut : communiqué du groupe ou déclaration publique datée d'un député du groupe.
- Pas de source trouvée = `null` (le site affiche « Explication non disponible »). Groupe non représenté = absent ou `null`.
- `relu` : `false` à la création. Passe à `true` seulement après relecture humaine. **En production, seules les explications `relu: true` sont affichées** ; en préproduction, les brouillons s'affichent avec la mention « À relire ».

## 5. Viabilité d'une mesure chiffrée (champ `viabilite` d'une mesure, facultatif)

Spec : « Étiquette de mesure chiffrée ». Le niveau juge la solidité du chiffre, jamais l'intérêt de la mesure.
- Mesure sans `chiffrage`, ou dont le `chiffrage` ne contient aucun nombre (ex. « Coût total non indiqué ») : aucune étiquette, même si `viabilite` est rempli.
- Mesure chiffrée sans `viabilite` : le site affiche **Mesure chiffrée non évaluable** (« pas encore deux estimations indépendantes relevées »).

```json
"viabilite": {
  "niveau": "cadre_valide|discute|non_evaluable|hors_cadre",
  "raison": "1 à 3 phrases : le chiffre du candidat comparé aux estimations des sources.",
  "chiffre_annonce": "12 Md€ par an (sinon on reprend chiffrage)",
  "estimations": "15 à 18 Md€ par an",
  "sources": [ { "institution": "ipp", "titre": "Note n° 99", "url": "https://...", "date": "2027-01-15", "verdict": "Estime 15 Md€ par an.", "consulte": "2027-01-20" } ],
  "sources_divergentes": [ { "institution": "ofce", "titre": "...", "url": "https://...", "date": "...", "verdict": "..." } ],
  "autres_avis": [ { "institution": "institut_montaigne", "titre": "...", "url": "https://...", "date": "...", "verdict": "..." } ],
  "date_verif": "2027-01-20",
  "relu": false
}
```
- `institution` = un `id` de `data/panel_sources.json` (niveau 1, 2 ou 3 du panel).
- **Règle des deux sources**, vérifiée automatiquement à chaque génération : au moins 2 institutions différentes de niveau 1 ou 2 dans `sources` (deux notes de la même institution comptent pour une ; Cour des comptes + HCFP comptent pour une), dont au moins une de niveau 1 hors Cour des comptes et HCFP. Sinon le niveau est **ramené à Mesure chiffrée non évaluable** et signalé dans « Points à vérifier ».
- Les think tanks (niveau 3) vont dans `autres_avis` : affichés, jamais comptés.
- `relu` : comme pour les explications de vote. En prod, seules les étiquettes `relu: true` s'affichent (sinon Mesure chiffrée non évaluable) ; en préprod, les brouillons s'affichent avec « À relire ».
