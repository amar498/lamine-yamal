#!/usr/bin/env bash
# JARVIS — installeur Mac / Linux
#   ./install.sh                  installation complète
#   ./install.sh --sans-arsenal   sans le pack de 6 500 skills
#   ./install.sh --arsenal DOSSIER  copie le pack depuis un dossier local
set -euo pipefail

ICI="$(cd "$(dirname "$0")" && pwd)"
cd "$ICI"

SANS_ARSENAL=false
SOURCE_ARSENAL=""
while [ $# -gt 0 ]; do
    case "$1" in
        --sans-arsenal) SANS_ARSENAL=true ;;
        --arsenal) SOURCE_ARSENAL="$2"; shift ;;
    esac
    shift
done

etape() { printf '\n  \033[96m>> %s\033[0m\n' "$1"; }
ok()    { printf '     \033[92mOK\033[0m  %s\n' "$1"; }
ko()    { printf '     \033[91m!!\033[0m  %s\n' "$1"; }
demander() {
    read -r -p "     $1 (O/n) " r || r=""
    [[ -z "$r" || "$r" =~ ^[oOyY] ]]
}

echo ""
echo "  +==========================================+"
echo "  |      JARVIS — installation Mac / Linux    |"
echo "  +==========================================+"

# ── 1. Python ───────────────────────────────────────────────────────────────
etape "Python"
PY=""
for p in python3 python; do
    if command -v "$p" >/dev/null && "$p" -c 'import sys; sys.exit(sys.version_info < (3, 9))' 2>/dev/null; then
        PY="$(command -v "$p")"; break
    fi
done
if [ -z "$PY" ]; then
    ko "Python 3.9+ introuvable. Mac : brew install python — Linux : sudo apt install python3 python3-venv"
    exit 1
fi
ok "$PY"

# ── 2. Bibliothèques audio du système (Linux) ───────────────────────────────
if [ "$(uname)" = "Linux" ]; then
    etape "Bibliothèques audio (PortAudio, eSpeak)"
    if command -v apt-get >/dev/null; then
        sudo apt-get install -y -qq libportaudio2 espeak-ng alsa-utils python3-venv >/dev/null && ok "installées" || ko "échec : installe PortAudio à la main"
    elif command -v dnf >/dev/null; then
        sudo dnf install -y -q portaudio espeak-ng alsa-utils && ok "installées" || ko "échec : installe PortAudio à la main"
    elif command -v pacman >/dev/null; then
        sudo pacman -S --needed --noconfirm portaudio espeak-ng alsa-utils && ok "installées" || ko "échec : installe PortAudio à la main"
    else
        ko "Installe PortAudio et eSpeak avec ton gestionnaire de paquets."
    fi
fi

# ── 3. Claude Code ──────────────────────────────────────────────────────────
etape "Claude Code"
export PATH="$HOME/.local/bin:$PATH"
if ! command -v claude >/dev/null; then
    if demander "Claude Code n'est pas installé. L'installer maintenant ?"; then
        curl -fsSL https://claude.ai/install.sh | bash
    fi
fi
if command -v claude >/dev/null; then ok "$(command -v claude)"; else ko "Claude Code manquant : https://claude.ai/code"; fi

# ── 4. Environnement Python et dépendances ──────────────────────────────────
etape "Modules Python (micro, reconnaissance vocale, voix)"
[ -x .venv/bin/python ] || "$PY" -m venv .venv
.venv/bin/python -m pip install --quiet --upgrade pip
.venv/bin/python -m pip install --quiet -r requirements.txt
ok "modules installés"

# ── 5. Arsenal (pack de skills) ─────────────────────────────────────────────
etape "Arsenal complet (6 500 skills, 942 agents, 966 commandes)"
if $SANS_ARSENAL; then
    echo "     ignoré (--sans-arsenal)"
elif [ -n "$SOURCE_ARSENAL" ]; then
    .venv/bin/python installer_arsenal.py --source "$SOURCE_ARSENAL"
elif [ -d arsenal/.claude/skills ]; then
    ok "déjà installé"
elif demander "Télécharger l'arsenal (~190 Mo, optionnel : la voix marche sans) ?"; then
    .venv/bin/python installer_arsenal.py || true
fi

chmod +x jarvis.sh

# ── 6. Diagnostic ───────────────────────────────────────────────────────────
etape "Diagnostic"
.venv/bin/python jarvis.py --diagnostic || true

echo ""
echo "  Installation terminée."
echo "  Si Claude Code n'est pas encore connecté : tape  claude  dans un terminal et connecte-toi."
echo "  Ensuite : ./jarvis.sh  puis dis « Jarvis, quelle heure est-il ? »"
if [ "$(uname)" = "Darwin" ]; then echo "  (Mac : autorise l'accès au micro pour le Terminal si macOS le demande.)"; fi
echo ""
