#!/usr/bin/env bash
# Lance Jarvis (Mac / Linux). Options : --texte, --muet, --complet, --diagnostic
cd "$(dirname "$0")"
if [ ! -x .venv/bin/python ]; then
    echo "Jarvis n'est pas encore installé : lance d'abord ./install.sh"
    exit 1
fi
exec .venv/bin/python jarvis.py "$@"
