# 🚀 Mise en ligne du site Elections 2027

Mise à jour : 2026-11-09

## Les deux environnements

| | Adresse | Accès | Moteurs de recherche |
|---|---|---|---|
| 🧪 Préprod | https://preprod.elections2027.orphane.fr | Libre (sans mot de passe) | Interdits (noindex + robots.txt) |
| 🌍 Prod | https://elections2027.orphane.fr | Public | Autorisés |

**Règle :** on publie toujours d'abord en préprod, on relit, puis on publie en prod.

## Où sont les choses

- `data/` : les contenus (candidats, mesures, bilan par thème), en JSON. Format décrit dans `data/SCHEMA.md`. **C'est ici qu'on corrige un contenu.**
- `build.mjs` : le générateur. `node build.mjs` fabrique `public/` à partir de `data/` (et les fiches Markdown de `02_themes` et `03_bilan_mandat`). Le script de publication le lance tout seul.
- `serve.mjs` : aperçu local sur http://localhost:8027 (`node serve.mjs`).
- `public/` : les fichiers du site générés, publiés tels quels. Ne pas modifier à la main.
- `deploy/deployer.sh` : le script qui publie.
- `deploy/docker-compose.*.yml` et `deploy/nginx.*.conf` : la configuration du serveur (une par environnement).

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
