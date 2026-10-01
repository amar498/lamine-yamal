#!/usr/bin/env python3
"""Télécharge le pack de skills Jarvis (dfnine9/jarvis-ai-assistant) dans arsenal/.

    python installer_arsenal.py                 télécharge depuis GitHub
    python installer_arsenal.py --source DOSSIER  utilise un dossier local qui contient .claude/

Les skills restent dans arsenal/ (ce projet seulement) : ton ~/.claude n'est pas touché.
"""

import argparse
import io
import json
import os
import stat
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path

ICI = Path(__file__).resolve().parent
ARSENAL = ICI / "arsenal"
URL_DEPOT = "https://github.com/dfnine9/jarvis-ai-assistant"
URL_ZIP = URL_DEPOT + "/archive/refs/heads/master.zip"
DOSSIERS = ("skills", "agents", "commands")

# Lecture et recherche autorisées sans question ; tout le reste demande ta permission.
REGLAGES = {
    "permissions": {
        "allow": ["Read", "Glob", "Grep", "WebSearch", "WebFetch"],
        "deny": ["Read(./.env)", "Read(./.env.*)"],
    },
    "env": {"JARVIS_PROJECT": "true"},
}

INTRO_ARSENAL = """

## Arsenal

Ce dossier contient l'arsenal complet : des milliers de skills, d'agents et de
commandes (`.claude/skills`, `.claude/agents`, `.claude/commands`). Quand une tâche
correspond à l'un d'eux, utilise-le. L'agent `@jarvis` connaît l'index complet et
`/jarvis <tâche>` recommande les meilleurs outils.
"""


def telecharger(destination):
    """Clone avec git s'il est installé, sinon télécharge l'archive zip."""
    if shutil.which("git"):
        print("  Téléchargement du pack avec git (environ 190 Mo)…", flush=True)
        cible = Path(destination) / "pack"
        fini = subprocess.run(["git", "clone", "--depth", "1", "--quiet", URL_DEPOT, str(cible)])
        if fini.returncode == 0:
            return cible / ".claude"
        print("  git a échoué, essai avec l'archive zip…", flush=True)
        shutil.rmtree(cible, ignore_errors=True)
    print("  Téléchargement du pack (environ 60 Mo)…", flush=True)
    with urllib.request.urlopen(URL_ZIP, timeout=120) as reponse:
        total = int(reponse.headers.get("Content-Length") or 0)
        tampon = io.BytesIO()
        recu = 0
        while True:
            bloc = reponse.read(1 << 20)
            if not bloc:
                break
            tampon.write(bloc)
            recu += len(bloc)
            suivi = f"{recu * 100 // total} %" if total else f"{recu >> 20} Mo"
            print(f"\r  … {suivi}   ", end="", flush=True)
    print("\r  Extraction…        ", flush=True)
    with zipfile.ZipFile(tampon) as z:
        z.extractall(destination)
    racine = next(p for p in Path(destination).iterdir() if p.is_dir())
    return racine / ".claude"


def installer(source_claude):
    for d in DOSSIERS:
        if not (source_claude / d).is_dir():
            sys.exit(f"  ✗ {source_claude / d} introuvable.")
    cible = ARSENAL / ".claude"
    cible.mkdir(parents=True, exist_ok=True)
    for d in DOSSIERS:
        print(f"  Copie de {d}…", flush=True)
        shutil.rmtree(cible / d, ignore_errors=True)
        shutil.copytree(source_claude / d, cible / d)
    (cible / "settings.json").write_text(json.dumps(REGLAGES, indent=2), encoding="utf-8")
    personnalite = (ICI / "cerveau" / "CLAUDE.md").read_text(encoding="utf-8")
    (ARSENAL / "CLAUDE.md").write_text(personnalite + INTRO_ARSENAL, encoding="utf-8")

    skills = sum(1 for p in (cible / "skills").iterdir() if p.is_dir())
    agents = sum(1 for _ in (cible / "agents").glob("*.md"))
    commandes = sum(1 for _ in (cible / "commands").glob("*.md"))
    print(f"  ✓ Arsenal installé : {skills} skills, {agents} agents, {commandes} commandes")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--source", help="dossier local contenant .claude/ (ou le dossier .claude lui-même)")
    args = p.parse_args()
    if args.source:
        src = Path(args.source).expanduser().resolve()
        installer(src if src.name == ".claude" else src / ".claude")
        return
    tmp = tempfile.mkdtemp(prefix="jarvis-")
    try:
        installer(telecharger(tmp))
    except OSError as e:
        sys.exit(f"\n  ✗ Téléchargement impossible ({e}). Jarvis marche quand même en mode léger.")
    finally:
        # Sous Windows, git laisse des fichiers en lecture seule : on les déverrouille.
        shutil.rmtree(tmp, onerror=lambda f, chemin, _e: (os.chmod(chemin, stat.S_IWRITE), f(chemin)))


if __name__ == "__main__":
    main()
