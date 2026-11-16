# 🗳️ Projet Elections 2027

## 🎯 Objectif
Plateforme de vulgarisation politique qui compare, thème par thème, les programmes de tous les candidats déclarés à la présidentielle 2027. Pour chaque thème : le bilan du dernier mandat, la position de chaque candidat, et les sources.

## 👩 Porteuse du projet
Anne, projet individuel. Elle ne code pas à la main : elle travaille avec Claude Code. Réponds en français, avec des smileys, et explique simplement ce que tu fais.

## ⚖️ Règle d'or : neutralité
1. Tous les candidats déclarés sont traités de la même façon : même structure, même longueur, même niveau d'exigence.
2. Aucune opinion, aucun adjectif qui juge, aucune recommandation de vote.
3. On décrit ce que le candidat propose, pas ce qu'on en pense.
4. Les faits du bilan sont chiffrés et sourcés, avec la même rigueur pour tous.
5. Si une position n'est pas connue ou pas publiée, on écrit « non communiqué » et on ne devine jamais.
6. Une mesure floue reçoit la mention « Mesure non chiffrée par le parti », sans commentaire.
7. Un bilan contesté : source la plus consensuelle, plus une ligne « Source contestée » avec le lien vers l'autre analyse.
8. Maximum 3 mesures clefs par candidat et par thème. Bilan du mandat : 3 à 5 faits par thème.

## 📚 Sources
1. Priorité aux sources primaires : programme officiel, site de campagne, déclarations publiques datées.
2. Pour le bilan : INSEE, Cour des comptes, Légifrance, data.gouv.fr, Assemblée nationale, ministères.
3. Chaque affirmation porte un lien et une date de consultation.
4. Pas de source = pas d'affirmation.
5. Les programmes évoluent : toujours noter la date de mise à jour.

## 🗂️ Organisation du dossier
00_cadrage : liste des 10 thèmes, gabarit de fiche
01_candidats : une fiche par candidat (identité, parti, statut de candidature, lien du programme)
02_themes : 10 sous dossiers, un par thème (voir 00_cadrage/themes.md, liste figée pour la V1), avec un fichier par candidat et une synthèse comparée
03_bilan_mandat : bilan du dernier mandat, thème par thème
04_sources : documents bruts (PDF de programmes, données), nommés avec la date
05_site : code de la plateforme
06_exports : versions prêtes à publier

## 📝 Conventions
Nom des fichiers : minuscules, sans accent, mots séparés par des underscores, par exemple macron_sante_2026_11.md
Chaque fichier thème commence par : thème, candidat, date de mise à jour, niveau de confiance des sources.
Langage : simple, phrases courtes, pas de jargon, termes techniques expliqués en une ligne.

## ✅ Façon de travailler
1. Avant de modifier ou de supprimer un fichier, le dire à Anne.
2. Ne jamais supprimer un document de 04_sources.
3. Pour une tâche longue, proposer d'abord un plan court.
4. À la fin, résumer en 2 ou 3 phrases ce qui a changé.
5. Signaler toute information incertaine ou contradictoire plutôt que de trancher.

## 📄 Spec de référence
Spec produit : https://claude.ai/artifact/T9rfNui1f8nKXK1VVutFqg
Candidats : tous les déclarés. Programmes publiés au fil de l'eau : mises à jour régulières, date de vérification sur chaque fiche. Mesure d'audience sans cookies. Méthode publique et signalement d'erreur.
