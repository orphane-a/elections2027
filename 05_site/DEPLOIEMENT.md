# 🚀 Mise en ligne du site Elections 2027

Mise à jour : 2026-11-22

## Les deux environnements

| | Adresse | Accès | Moteurs de recherche |
|---|---|---|---|
| 🧪 Préprod | https://preprod.demandez-le-programme.fr | Libre (sans mot de passe) | Interdits (noindex + robots.txt) |
| 🌍 Prod | https://demandez-le-programme.fr | Public | Autorisés |

Redirections permanentes (301), qui gardent le chemin de la page :
- `www.demandez-le-programme.fr` et l'ancienne adresse `elections2027.orphane.fr` → https://demandez-le-programme.fr
- l'ancienne adresse `preprod.elections2027.orphane.fr` → https://preprod.demandez-le-programme.fr

Le site génère lui-même `robots.txt` et `sitemap.xml`, et chaque page porte une balise `canonical` (son adresse officielle).

**Règle :** on publie toujours d'abord en préprod, on relit, puis on publie en prod.

## Où sont les choses

- `data/` : les contenus (candidats, mesures, bilan par thème), en JSON. Format décrit dans `data/SCHEMA.md`. **C'est ici qu'on corrige un contenu.**
- `build.mjs` : le générateur. `node build.mjs` fabrique `public/` à partir de `data/` (et les fiches Markdown de `02_themes` et `03_bilan_mandat`). Le script de publication le lance tout seul.
- `serve.mjs` : aperçu local sur http://localhost:8027 (`node serve.mjs`).
- `public/` : les fichiers du site générés, publiés tels quels. Ne pas modifier à la main.
- `deploy/deployer.sh` : le script qui publie.
- `deploy/docker-compose.*.yml` et `deploy/nginx.*.conf` : la configuration du serveur (une par environnement).
- `stats/` et `deploy/visiteurs.sh` : la mesure d'audience de la prod (voir plus bas).

Sur le serveur OVH (148.113.144.242) :
- `/srv/elections2027-preprod` et `/srv/elections2027-prod`, avec dans chacun le dossier `site/` en ligne et `site.old/`, la version d'avant.
- Chaque environnement est un petit serveur web Nginx (le programme qui envoie les pages), branché sur le Traefik de Coolify. Traefik s'occupe du HTTPS (certificat Let's Encrypt automatique).

## Les commandes (depuis le dossier `05_site`)

Publier en préprod :
```bash
sh deploy/deployer.sh preprod
```

Publier en prod (le script demande de taper OUI) :
```bash
sh deploy/deployer.sh prod
```

⚠️ La préprod est ouverte à toute personne qui connaît son adresse. Elle n'apparaît pas sur Google, mais ce n'est pas une protection : n'y publie rien de confidentiel.

## Revenir en arrière

La version précédente est gardée dans `site.old/` sur le serveur. Pour la remettre, demander à Claude de « restaurer la version précédente de la prod » (ou de la préprod).

## 📊 Mesure d'audience (prod uniquement)

Les visites sont comptées à partir des journaux du serveur Nginx de la prod (les lignes qu'il écrit à chaque page demandée). Aucun cookie, aucun script dans les pages, aucun service tiers, donc pas de bandeau cookie. La préprod n'est pas mesurée.

### Consulter les chiffres (depuis le dossier `05_site`, sur le poste qui a la clé SSH du serveur)

```bash
sh deploy/visiteurs.sh                          # la veille
sh deploy/visiteurs.sh 2026-11-30               # un jour
sh deploy/visiteurs.sh 2026-11-01 2026-11-30    # une période
sh deploy/visiteurs.sh --comparer semaine       # cette semaine et la précédente (ou : --comparer mois)
sh deploy/visiteurs.sh 2026-11-01 2026-11-30 --json   # sortie JSON
```

La commande affiche les visites uniques par jour, le total de la période, les pages vues, les 10 pages les plus lues, les sources de visite (moteur de recherche, réseau social, autre site, accès direct) et la part téléphone ou ordinateur.
Codes de sortie : 0 succès, 1 pas de données ou dates mal écrites, 2 serveur injoignable.

### Phrases à dire à Claude

« Combien de visiteurs uniques hier ? », « Combien de visiteurs uniques cette semaine, comparé à la semaine dernière ? », « Quelles pages sont les plus lues ce mois ci ? ».
Claude lance la commande ci dessus et recopie ses chiffres, sans rien calculer ni inventer. S'il n'y a pas de données, il le dit.

### Comment lire les chiffres

- Un visiteur unique = une même adresse de connexion et un même navigateur, sur une journée.
- Sur une semaine ou un mois, on parle de **visites uniques par jour, cumulées** : une même personne venue trois jours compte trois fois. C'est voulu, pour ne jamais pouvoir suivre quelqu'un d'un jour à l'autre.
- Ne sont pas comptés : les robots (Google, outils de supervision, vérification de version du kanban), les fichiers techniques (styles, scripts, polices, images, `robots.txt`, `sitemap.xml`, `version.txt`), les erreurs (404, 500…) et les navigateurs qui demandent à ne pas être suivis (signaux « Do Not Track » et « Global Privacy Control »).
- Les journées sont découpées en temps universel (minuit à Paris = 23h ou 22h en temps universel). Les chiffres d'un jour sont disponibles le lendemain matin, après le calcul de 2h.

### Comment ça marche

1. Nginx (`deploy/nginx.prod.conf`) écrit un journal par jour dans `/srv/elections2027-prod/logs/acces-AAAA-MM-JJ.log` : date, adresse du visiteur (lue dans l'en tête `X-Forwarded-For` envoyé par Traefik, seulement depuis le réseau Docker), page demandée sans paramètres, code de réponse, navigateur, domaine du site d'où vient le visiteur (jamais l'adresse complète).
2. Chaque nuit à 2h, la tâche planifiée `/etc/cron.d/elections2027-visites` (copie de `deploy/visites.cron`) lance `stats/agreger.mjs` dans un conteneur Node jetable. Le script calcule une empreinte de chaque visiteur (hachage SHA 256 de l'adresse, du navigateur et d'un sel tiré au hasard, jamais écrit sur le disque et effacé à la fin), compte les empreintes différentes, puis écrit les totaux anonymes dans `/srv/elections2027-prod/stats/AAAA-MM-JJ.json`. Son compte rendu est dans `/srv/elections2027-prod/agreger.log`.
3. `deploy/deployer.sh prod` installe tout cela (dossiers, script, tâche planifiée) à chaque publication en prod.

Relancer le calcul d'un jour à la main (sur le serveur) :
```bash
sudo docker run --rm --network none -v /srv/elections2027-prod/logs:/logs -v /srv/elections2027-prod/stats:/stats -v /srv/elections2027-prod/outils:/outils:ro node:22-alpine node /outils/agreger.mjs --journaux /logs --stats /stats --date 2026-11-24
```

### Conservation

- Journaux bruts (avec les adresses IP) : 7 jours, puis suppression automatique par le calcul de la nuit.
- Totaux anonymes par jour : 25 mois au plus, puis suppression automatique. Ils ne sont pas publiés.
