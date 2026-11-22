#!/bin/sh
# Mesure d'audience de la PROD (ticket 95) : affiche les visiteurs uniques, en français.
# Se connecte au serveur en SSH (comme deployer.sh), lit les totaux anonymes de
# /srv/elections2027-prod/stats et les met en forme avec stats/visiteurs.mjs.
# Usage (depuis le dossier 05_site) :
#   sh deploy/visiteurs.sh                          -> la veille
#   sh deploy/visiteurs.sh 2026-11-30               -> un jour
#   sh deploy/visiteurs.sh 2026-11-01 2026-11-30    -> une période
#   sh deploy/visiteurs.sh --comparer semaine       -> cette semaine et la précédente (ou : mois)
#   sh deploy/visiteurs.sh 2026-11-01 2026-11-30 --json
# Codes de sortie : 0 succès, 1 pas de données ou dates invalides, 2 serveur injoignable.
SERVEUR="${VISITEURS_SERVEUR:-ubuntu@148.113.144.242}"
DOSSIER="/srv/elections2027-prod/stats"
cd "$(dirname "$0")/.." || exit 1

# 1. Dates vérifiées avant toute connexion
INFO=$(node stats/visiteurs.mjs --verifier "$@" 2>&1)
CODE=$?
if [ "$CODE" -ne 0 ]; then printf '%s\n' "$INFO"; exit "$CODE"; fi

# 2. Lecture des totaux anonymes (jamais les journaux bruts)
echo "Connexion au serveur de prod…" >&2
[ -n "$INFO" ] && printf '%s\n' "$INFO" >&2
DONNEES=$(ssh -o BatchMode=yes -o ConnectTimeout=10 "$SERVEUR" \
  "cd $DOSSIER 2>/dev/null || exit 0; for f in 2*.json; do [ -f \"\$f\" ] && printf '%s\t%s\n' \"\$f\" \"\$(tr -d '\n' < \"\$f\")\"; done; exit 0")
if [ $? -ne 0 ]; then
  case " $* " in *" --json "*) echo '{"erreur":"Serveur injoignable : la connexion SSH a échoué."}'; exit 2 ;; esac
  echo "Serveur injoignable : la connexion SSH a échoué."
  echo "Vérifiez la connexion internet et la clé SSH, puis relancez."
  exit 2
fi

# 3. Mise en forme
printf '%s\n' "$DONNEES" | node stats/visiteurs.mjs "$@"
