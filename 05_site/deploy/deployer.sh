#!/bin/sh
# Publie le dossier public/ sur la préprod ou la prod.
# Usage (depuis le dossier 05_site) :
#   sh deploy/deployer.sh preprod   -> https://preprod.demandez-le-programme.fr (non indexée)
#   sh deploy/deployer.sh prod      -> https://demandez-le-programme.fr (demande confirmation)
set -e
SERVEUR="ubuntu@148.113.144.242"
ENV="$1"

case "$ENV" in
  preprod) URL="https://preprod.demandez-le-programme.fr" ;;
  prod)    URL="https://demandez-le-programme.fr" ;;
  *) echo "Usage : sh deploy/deployer.sh preprod|prod"; exit 1 ;;
esac
DOSSIER="/srv/elections2027-$ENV"
cd "$(dirname "$0")/.."

# 0. Génération du site à partir de data/ (bandeau « préproduction » en préprod)
if [ "$ENV" = "preprod" ]; then node build.mjs --preprod; else node build.mjs; fi

# Version publiée, lue par le kanban Spec to prod pour vérifier la mise en ligne.
git rev-parse HEAD > public/version.txt 2>/dev/null || echo "local" > public/version.txt

if [ "$ENV" = "prod" ] && [ "$2" != "--oui" ]; then
  printf "Publier sur le site PUBLIC %s ? Tape OUI pour confirmer : " "$URL"
  read -r REPONSE
  [ "$REPONSE" = "OUI" ] || { echo "Annulé, rien n'a été publié."; exit 1; }
fi

# 1. Dossiers sur le serveur
ssh "$SERVEUR" "sudo mkdir -p $DOSSIER/site.new && sudo chown ubuntu:ubuntu $DOSSIER $DOSSIER/site.new"

# 2. Envoi des fichiers, puis bascule d'un coup (l'ancienne version est gardée dans site.old)
tar -czf - -C public . | ssh "$SERVEUR" "tar -xzf - -C $DOSSIER/site.new && rm -rf $DOSSIER/site.old && { [ -d $DOSSIER/site ] && mv $DOSSIER/site $DOSSIER/site.old || true; } && mv $DOSSIER/site.new $DOSSIER/site && chmod -R a+rX $DOSSIER/site"

# 2 bis. PROD seulement : mesure d'audience (ticket 95). Dossier des journaux écrit par Nginx
# (utilisateur 101 dans l'image nginx:alpine), script d'agrégation et tâche planifiée de la nuit.
if [ "$ENV" = "prod" ]; then
  ssh "$SERVEUR" "sudo mkdir -p $DOSSIER/logs $DOSSIER/stats $DOSSIER/outils && sudo chown 101:101 $DOSSIER/logs && sudo chmod 750 $DOSSIER/logs && sudo chown ubuntu:ubuntu $DOSSIER/outils"
  scp stats/agreger.mjs "$SERVEUR:$DOSSIER/outils/agreger.mjs"
  scp deploy/visites.cron "$SERVEUR:/tmp/elections2027-visites"
  ssh "$SERVEUR" "sudo install -o root -g root -m 644 /tmp/elections2027-visites /etc/cron.d/elections2027-visites && rm -f /tmp/elections2027-visites"
fi

# 3. Configuration Docker + Nginx, puis (re)démarrage
scp "deploy/docker-compose.$ENV.yml" "$SERVEUR:$DOSSIER/docker-compose.yml"
scp "deploy/nginx.$ENV.conf" "$SERVEUR:$DOSSIER/nginx.conf"
ssh "$SERVEUR" "cd $DOSSIER && sudo docker compose -p elections2027-$ENV up -d --force-recreate && sleep 2 && sudo docker exec elections2027-$ENV nginx -t"

echo "Publié sur $URL"
