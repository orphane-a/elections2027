# 🔔 Tâche planifiée : mise à jour des informations (ticket 90)

Ce fichier contient la planification et le prompt de la tâche planifiée Claude Code qui met le site à jour
chaque lundi et chaque jeudi à 9h, heure de Paris. Elle tourne avec l'abonnement Claude Code :
aucune clé `ANTHROPIC_API_KEY`, aucun appel à l'API Claude payante.

## Planification

- Dépôt : `orphane-a/elections2027`.
- Déclencheur : cron `0 7,8 * * 1,4` en UTC (lundi et jeudi, 7h et 8h UTC).
- Pourquoi deux heures : 9h à Paris vaut 8h UTC en hiver et 7h UTC en été. La tâche commence par
  `node 05_site/maj/moment.mjs`, qui ne laisse passer que le déclenchement qui tombe à 9h à Paris.
  L'autre s'arrête aussitôt, sans rien faire. La mise à jour se lance donc une seule fois.
- Si l'outil de planification accepte un fuseau horaire, on peut aussi utiliser `0 9 * * 1,4`
  avec le fuseau `Europe/Paris` : la garde horaire laisse alors passer le seul déclenchement.
- Run manqué (panne, quota) : pas de relance automatique, le run suivant rattrape.

## Prompt de la tâche

> Tu fais la mise à jour programmée du site « Demandez le programme » (dépôt orphane-a/elections2027).
>
> 1. Lance `node 05_site/maj/moment.mjs`. Si le code de sortie n'est pas 0, arrête toi sans rien faire.
> 2. Lis `CLAUDE.md` et `05_site/data/SCHEMA.md` et respecte toutes leurs règles (neutralité, sources, 3 mesures maximum, « non communiqué »).
> 3. Crée la branche `claude/maj-<date du jour>` depuis la branche par défaut. Ne pousse jamais sur la branche par défaut.
> 4. Vérifie, avec la même méthode et dans le même run pour tous :
>    - chaque candidat de `05_site/data/candidats` : statut, site de campagne, programme officiel ;
>    - chaque candidat et chaque thème : les mesures de `05_site/data/mesures` ;
>    - les nouveaux déclarés, en partant de `01_candidats/00_pretendants_non_declares.md`, de LCP, de Public Sénat et des sources primaires.
>    Chaque information a un lien, une date de publication et une date de consultation. Ne touche pas au bilan (`data/themes`, `data/explications`).
> 5. Nouveau candidat : crée `data/candidats/<id>.json`, `data/mesures/<id>.json` (10 thèmes, voir `squeletteMesures` dans `maj/lib.mjs`),
>    la fiche `01_candidats/<id>.md`, ajoute le dans `00_liste_candidats.md` et retire le de `00_pretendants_non_declares.md`.
>    Une seule source, ou des sources qui se contredisent : `a_verifier: true`, et la contradiction va dans le rapport, sans trancher.
> 6. Programme publié (document présenté par le candidat ou son parti comme son programme 2027, pas un livret partiel) :
>    remplis le champ `programme` (titre, lien, date, type).
> 7. Écris les grandes nouveautés dans un fichier JSON, et seulement celles-ci (jamais une petite évolution de mesure) :
>    `[{ "type": "candidat_declare" | "programme_publie" | "candidat_retire", "candidat": "<id>", "source": { "titre", "url", "date" } }]`.
>    Une candidature `a_verifier` qui devient confirmée n'est pas une nouveauté.
> 8. Lance depuis `05_site` :
>    `node maj/maj.mjs --nouveautes <fichier> --echecs <ids dont la vérification a échoué> --contradictions <fichier>`.
>    Le script met la date du jour sur toutes les fiches vérifiées, garde l'ancienne date des fiches en échec,
>    ajoute l'entrée dans `data/nouveautes.json` (même vide) et régénère le site. Puis lance `npm test`.
> 9. Si le run ne peut pas aller au bout (quota atteint, source principale en panne, tests rouges) :
>    ne lance pas `maj.mjs`, ne commite rien, ne pousse rien, et signale l'échec à Anne. Aucune date ne change.
> 10. Sinon, commite, pousse la branche et ouvre une pull request en brouillon vers la branche par défaut,
>     avec le rapport affiché par `maj.mjs`. La branche passe par la préprod ; la prod n'est publiée qu'après validation d'Anne.
> 11. Termine par le rapport court : candidats ajoutés, programmes publiés, fiches en échec, contradictions repérées.

## Mise en route

1. Créer la tâche planifiée dans Claude Code (claude.ai/code, tâches planifiées) sur le dépôt `orphane-a/elections2027`,
   avec le cron et le prompt ci-dessus. Ne définir aucune variable `ANTHROPIC_API_KEY`.
2. Vérifier la garde horaire : `node 05_site/maj/moment.mjs --instant 2026-11-19T08:00:00Z` affiche « c'est le moment ».
3. Essai à blanc, sans rien écrire : `cd 05_site && node maj/maj.mjs --essai`.
