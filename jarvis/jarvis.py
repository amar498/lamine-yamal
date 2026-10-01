#!/usr/bin/env python3
"""JARVIS — assistant vocal propulsé par Claude Code.

Écoute le micro, attend le mot « Jarvis », envoie la demande à Claude Code
et lit la réponse à voix haute.

    python jarvis.py               mode vocal (micro + voix)
    python jarvis.py --texte       on tape au clavier, Jarvis répond à voix haute
    python jarvis.py --muet        pas de voix, réponses écrites seulement
    python jarvis.py --complet     charge l'arsenal complet (6 500 skills, lent et coûteux)
    python jarvis.py --diagnostic  vérifie que tout est en place
"""

import argparse
import asyncio
import collections
import datetime
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import unicodedata
from pathlib import Path

ICI = Path(__file__).resolve().parent
DOSSIER_LEGER = ICI / "cerveau"
DOSSIER_COMPLET = ICI / "arsenal"

CONFIG_DEFAUT = {
    "langue": "fr-FR",
    "voix": "fr-FR-HenriNeural",
    "vitesse_voix": "+8%",
    "modele": "sonnet",
    "mode": "leger",
    "mot_cle_obligatoire": True,
    "mots_cles": ["jarvis", "jarviss", "jarvice", "jarvisse", "djarvis", "jervis", "jarvi"],
    "fenetre_conversation_s": 10,
    "autoriser_actions": False,
    "outils_lecture": ["WebSearch", "WebFetch", "Read", "Glob", "Grep"],
    "outils_actions": ["Bash", "Write", "Edit"],
    "delai_reponse_s": 240,
    "max_caracteres_lus": 900,
}

# ─────────────────────────────── affichage ────────────────────────────────

if os.name == "nt":
    os.system("")  # active les couleurs ANSI dans la console Windows
for flux in (sys.stdout, sys.stderr):
    try:
        flux.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass

CYAN, BLEU, VERT, JAUNE, ROUGE, GRIS, GRAS, RAZ = (
    "\033[96m", "\033[94m", "\033[92m", "\033[93m", "\033[91m", "\033[90m", "\033[1m", "\033[0m")

BANNIERE = rf"""{CYAN}{GRAS}
       ██╗ █████╗ ██████╗ ██╗   ██╗██╗███████╗
       ██║██╔══██╗██╔══██╗██║   ██║██║██╔════╝
       ██║███████║██████╔╝██║   ██║██║███████╗
  ██   ██║██╔══██║██╔══██╗╚██╗ ██╔╝██║╚════██║
  ╚█████╔╝██║  ██║██║  ██║ ╚████╔╝ ██║███████║
   ╚════╝ ╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚═╝╚══════╝{RAZ}
  {GRIS}Just A Rather Very Intelligent System — propulsé par Claude Code{RAZ}
"""


def info(msg):
    print(f"{GRIS}  {msg}{RAZ}", flush=True)


def erreur(msg):
    print(f"{ROUGE}  ✗ {msg}{RAZ}", flush=True)


class Indicateur:
    """Petite animation pendant que Jarvis réfléchit."""

    def __init__(self, texte):
        self.texte = texte
        self._stop = threading.Event()
        self._fil = threading.Thread(target=self._tourner, daemon=True)

    def _tourner(self):
        motifs = "◐◓◑◒"
        i = 0
        debut = time.time()
        while not self._stop.wait(0.15):
            print(f"\r{CYAN}  {motifs[i % 4]} {self.texte} {int(time.time() - debut)}s{RAZ}  ",
                  end="", flush=True)
            i += 1

    def __enter__(self):
        self._fil.start()
        return self

    def __exit__(self, *exc):
        self._stop.set()
        self._fil.join()
        print("\r" + " " * 60 + "\r", end="", flush=True)


# ─────────────────────────────── configuration ────────────────────────────

def charger_config():
    cfg = dict(CONFIG_DEFAUT)
    fichier = ICI / "config.json"
    if fichier.exists():
        try:
            cfg.update(json.loads(fichier.read_text(encoding="utf-8")))
        except json.JSONDecodeError as e:
            erreur(f"config.json illisible ({e}) — valeurs par défaut utilisées.")
    return cfg


# ─────────────────────────────── texte ────────────────────────────────────

def sans_accents(texte):
    """Minuscules sans accents, en gardant une lettre pour une lettre (indices alignés)."""
    return "".join(unicodedata.normalize("NFD", c)[0].lower() for c in texte)


def extraire_mot_cle(texte, mots_cles):
    """Renvoie (trouvé, demande sans le mot-clé)."""
    norme = sans_accents(texte)
    motif = r"\b(?:" + "|".join(re.escape(m) for m in sorted(mots_cles, key=len, reverse=True)) + r")\b"
    m = re.search(motif, norme)
    if not m:
        return False, texte.strip()
    reste = (texte[:m.start()] + " " + texte[m.end():]).strip()
    reste = re.sub(r"^(?:dis|eh|hey|h[eé]|ok|bon|salut|alors)\b[\s,]*", "", reste, flags=re.I)
    reste = re.sub(r"\s+([?!.,])", r"\1", re.sub(r"\s{2,}", " ", reste))
    reste = reste.strip(" ,.;:")
    return True, "" if re.fullmatch(r"[\W_]*", reste) else reste


def pour_oral(texte, max_caracteres):
    """Nettoie une réponse Markdown pour qu'elle soit agréable à écouter."""
    a_code = "```" in texte
    t = re.sub(r"```.*?(```|$)", " ", texte, flags=re.S)
    t = re.sub(r"`([^`]*)`", r"\1", t)
    t = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", t)
    t = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", t)
    t = re.sub(r"https?://\S+", "le lien affiché à l'écran", t)
    t = re.sub(r"^\s{0,3}#{1,6}\s*", "", t, flags=re.M)
    t = re.sub(r"^\s*[-*+•]\s+", "", t, flags=re.M)
    t = re.sub(r"^\s*\|.*\|\s*$", "", t, flags=re.M)
    t = re.sub(r"[*_~>#|]", "", t)
    t = re.sub(r"[\U0001F000-\U0001FAFF☀-➿️]", "", t)
    t = re.sub(r"\s*\n\s*", ". ", t.strip())
    t = re.sub(r"\.\s*\.", ".", t)
    t = re.sub(r"\s{2,}", " ", t)
    t = re.sub(r"\s+([.,!?])", r"\1", t).strip(" .")
    t = t if t.endswith(("!", "?")) else t + "."
    if a_code:
        t += " J'ai affiché le code à l'écran."
    if len(t) > max_caracteres:
        coupe = t[:max_caracteres]
        fin = max(coupe.rfind(". "), coupe.rfind("! "), coupe.rfind("? "))
        t = (coupe[:fin + 1] if fin > 200 else coupe) + " Le reste est affiché à l'écran."
    return t


def salutation():
    h = datetime.datetime.now().hour
    moment = "Bonjour" if 5 <= h < 18 else "Bonsoir"
    return f"{moment} monsieur. Tous les systèmes sont opérationnels. Dites Jarvis quand vous avez besoin de moi."


# ─────────────────────────────── cerveau (Claude Code) ────────────────────

class ErreurCerveau(Exception):
    pass


def trouver_claude():
    chemin = shutil.which("claude")
    if chemin:
        return chemin
    candidats = [
        Path.home() / ".local" / "bin" / "claude",
        Path.home() / ".local" / "bin" / "claude.exe",
        Path.home() / ".claude" / "local" / "claude",
        Path(os.environ.get("APPDATA", "")) / "npm" / "claude.cmd",
    ]
    return next((str(c) for c in candidats if c.is_file()), None)


class Cerveau:
    """Envoie les demandes à Claude Code (`claude -p`) en gardant la conversation."""

    def __init__(self, cfg, complet=False):
        self.cfg = cfg
        self.claude = trouver_claude()
        self.session = None
        self.regler_mode(complet)

    def regler_mode(self, complet):
        if complet and not (DOSSIER_COMPLET / ".claude" / "skills").is_dir():
            raise ErreurCerveau("L'arsenal complet n'est pas installé. Relance l'installeur.")
        self.complet = complet
        self.dossier = DOSSIER_COMPLET if complet else DOSSIER_LEGER
        self.session = None

    def nouvelle_conversation(self):
        self.session = None

    def demander(self, demande, vocal=True):
        if not self.claude:
            raise ErreurCerveau("Claude Code est introuvable. Installe-le puis relance Jarvis.")
        outils = list(self.cfg["outils_lecture"])
        if self.cfg["autoriser_actions"]:
            outils += self.cfg["outils_actions"]
        cmd = [self.claude, "-p", "--output-format", "json"]
        if self.cfg.get("modele"):
            cmd += ["--model", self.cfg["modele"]]
        if self.session:
            cmd += ["--resume", self.session]
        cmd += ["--allowedTools", *outils]  # en dernier : l'option prend plusieurs valeurs

        # La demande passe par l'entrée standard : aucun souci de guillemets sous Windows.
        message = ("[VOCAL] " if vocal else "") + demande
        try:
            fini = subprocess.run(cmd, input=message, capture_output=True, text=True,
                                  encoding="utf-8", errors="replace", cwd=self.dossier,
                                  timeout=self.cfg["delai_reponse_s"])
        except subprocess.TimeoutExpired:
            raise ErreurCerveau("Claude Code a mis trop de temps à répondre.")
        except OSError as e:
            raise ErreurCerveau(f"Impossible de lancer Claude Code : {e}")

        try:
            donnees = json.loads(fini.stdout.strip().splitlines()[-1])
        except (json.JSONDecodeError, IndexError):
            detail = (fini.stderr or fini.stdout).strip()[-400:]
            if re.search(r"log ?in|auth|api key|/login", detail, re.I):
                raise ErreurCerveau("Claude Code n'est pas connecté. Ouvre un terminal, tape claude, et connecte-toi.")
            if self.session and re.search(r"session|conversation", detail, re.I):
                self.session = None  # conversation perdue : on repart à zéro
                return self.demander(demande, vocal)
            raise ErreurCerveau(f"Réponse inattendue de Claude Code : {detail or 'vide'}")

        self.session = donnees.get("session_id") or self.session
        if donnees.get("is_error"):
            raise ErreurCerveau(str(donnees.get("result") or "erreur inconnue"))
        return (donnees.get("result") or "").strip() or "Je n'ai rien à ajouter, monsieur."


# ─────────────────────────────── voix (synthèse) ──────────────────────────

class Voix:
    """Voix neuronale Microsoft Edge (en ligne), avec repli sur la voix du système."""

    def __init__(self, cfg, muet=False):
        self.cfg = cfg
        self.muet = muet
        self.neuronale_ok = True
        self._moteur_local = None

    def dire(self, texte_affiche, texte_oral=None):
        print(f"{CYAN}{GRAS}  JARVIS ›{RAZ} {texte_affiche}\n", flush=True)
        if self.muet:
            return
        texte_oral = texte_oral or pour_oral(texte_affiche, self.cfg["max_caracteres_lus"])
        try:
            if self.neuronale_ok:
                try:
                    self._dire_neuronale(texte_oral)
                    return
                except KeyboardInterrupt:
                    raise
                except Exception as e:
                    self.neuronale_ok = False
                    info(f"Voix neuronale indisponible ({type(e).__name__}) — voix du système utilisée.")
            self._dire_locale(texte_oral)
        except KeyboardInterrupt:
            self.arreter()
            info("(voix interrompue)")

    def _dire_neuronale(self, texte):
        import edge_tts
        import miniaudio
        import numpy as np
        import sounddevice as sd

        async def synthese():
            audio = bytearray()
            com = edge_tts.Communicate(texte, self.cfg["voix"], rate=self.cfg["vitesse_voix"])
            async for morceau in com.stream():
                if morceau["type"] == "audio":
                    audio.extend(morceau["data"])
            return bytes(audio)

        mp3 = asyncio.run(synthese())
        if not mp3:
            raise RuntimeError("aucun son reçu")
        son = miniaudio.decode(mp3, output_format=miniaudio.SampleFormat.SIGNED16,
                               nchannels=1, sample_rate=24000)
        sd.play(np.frombuffer(son.samples, dtype=np.int16), 24000)
        sd.wait()

    def _dire_locale(self, texte):
        if self._moteur_local is None:
            import pyttsx3
            self._moteur_local = pyttsx3.init()
            langue = self.cfg["langue"].split("-")[0].lower()
            for v in self._moteur_local.getProperty("voices"):
                etiquettes = " ".join([v.id, v.name or ""] + [str(l) for l in (v.languages or [])]).lower()
                if langue in etiquettes or "french" in etiquettes or "fran" in etiquettes:
                    self._moteur_local.setProperty("voice", v.id)
                    break
            self._moteur_local.setProperty("rate", 185)
        self._moteur_local.say(texte)
        self._moteur_local.runAndWait()

    def arreter(self):
        try:
            import sounddevice as sd
            sd.stop()
        except Exception:
            pass
        if self._moteur_local is not None:
            try:
                self._moteur_local.stop()
            except Exception:
                pass


# ─────────────────────────────── oreille (micro) ──────────────────────────

class Decoupeur:
    """Détecte une phrase dans le flux du micro : début quand le son dépasse le bruit
    ambiant, fin après un court silence."""

    def __init__(self, debit=16000, trame_ms=30, silence_fin_ms=900, avant_ms=300,
                 max_s=20, min_parole_ms=300, seuil_min=350.0, facteur=3.0):
        self.trame_ms = trame_ms
        self.fin = silence_fin_ms // trame_ms
        self.max_trames = int(max_s * 1000 / trame_ms)
        self.min_trames = min_parole_ms // trame_ms
        self.avant = collections.deque(maxlen=avant_ms // trame_ms)
        self.seuil_min = seuil_min
        self.facteur = facteur
        self.bruit = seuil_min / facteur
        self._raz()

    def _raz(self):
        self.en_parole = False
        self.tampon = []
        self.silence = 0
        self.debut = 0
        self.parole = 0

    @property
    def seuil(self):
        return max(self.seuil_min, self.bruit * self.facteur)

    def ajouter(self, trame):
        """trame : numpy int16. Renvoie les octets d'une phrase complète, sinon None."""
        import numpy as np
        niveau = float(np.sqrt(np.mean(trame.astype(np.float32) ** 2)))
        if not self.en_parole:
            self.avant.append(trame)
            if niveau > self.seuil:
                self.debut += 1
                if self.debut >= 3:
                    self.en_parole = True
                    self.tampon = list(self.avant)
                    self.parole = self.debut
            else:
                self.debut = 0
                self.bruit = 0.95 * self.bruit + 0.05 * niveau
            return None

        self.tampon.append(trame)
        if niveau < self.seuil * 0.8:
            self.silence += 1
        else:
            self.silence = 0
            self.parole += 1
        if self.silence >= self.fin or len(self.tampon) >= self.max_trames:
            phrase = b"".join(t.tobytes() for t in self.tampon) if self.parole >= self.min_trames else None
            self._raz()
            self.avant.clear()
            return phrase
        return None


class Oreille:
    DEBIT = 16000
    TRAME = 480  # 30 ms

    def __init__(self, cfg):
        import sounddevice as sd
        import speech_recognition as sr
        self.sd = sd
        self.sr = sr
        self.cfg = cfg
        self.reconnaisseur = sr.Recognizer()
        self.decoupeur = Decoupeur(debit=self.DEBIT)
        sd.query_devices(kind="input")  # lève une erreur claire s'il n'y a pas de micro
        self._calibrer()

    def _calibrer(self):
        import numpy as np
        info("Calibrage du micro, silence une seconde…")
        son = self.sd.rec(self.DEBIT, samplerate=self.DEBIT, channels=1, dtype="int16")
        self.sd.wait()
        niveaux = [float(np.sqrt(np.mean(t.astype(np.float32) ** 2)))
                   for t in np.array_split(son[:, 0], self.DEBIT // self.TRAME)]
        self.decoupeur.bruit = float(np.median(niveaux)) or self.decoupeur.bruit

    def ecouter(self):
        """Bloque jusqu'à une phrase entendue ; renvoie le texte reconnu (ou None)."""
        import numpy as np
        import queue
        file = queue.Queue()

        def rappel(donnees, _n, _t, _statut):
            file.put(donnees[:, 0].copy())

        # Le flux n'est ouvert que pendant l'écoute : Jarvis ne s'entend pas parler.
        with self.sd.InputStream(samplerate=self.DEBIT, channels=1, dtype="int16",
                                 blocksize=self.TRAME, callback=rappel):
            print(f"\r{BLEU}  🎙  J'écoute…{RAZ}  ", end="", flush=True)
            while True:
                phrase = self.decoupeur.ajouter(file.get())
                if phrase:
                    break
        print("\r" + " " * 40 + "\r", end="", flush=True)

        audio = self.sr.AudioData(phrase, self.DEBIT, 2)
        try:
            return self.reconnaisseur.recognize_google(audio, language=self.cfg["langue"])
        except self.sr.UnknownValueError:
            return None
        except self.sr.RequestError as e:
            erreur(f"Reconnaissance vocale injoignable ({e}). Vérifie ta connexion Internet.")
            time.sleep(2)
            return None


# ─────────────────────────────── commandes locales ────────────────────────

def commande_locale(demande):
    n = sans_accents(demande).strip(" .!?")
    if re.match(r"^(au revoir|bonne nuit|eteins[- ]toi|arrete[- ]toi|quitte|desactive[- ]toi)\b", n):
        return "quitter"
    if re.search(r"\b(nouvelle conversation|oublie tout|on recommence)\b", n):
        return "nouvelle"
    if re.search(r"\bmode complet\b", n):
        return "complet"
    if re.search(r"\bmode leger\b", n):
        return "leger"
    if re.match(r"^(tais[- ]toi|silence|stop|rien|laisse tomber|annule)$", n):
        return "rien"
    return None


# ─────────────────────────────── boucle principale ────────────────────────

def boucle(cfg, args):
    print(BANNIERE)
    voix = Voix(cfg, muet=args.muet)
    try:
        cerveau = Cerveau(cfg, complet=args.complet or cfg["mode"] == "complet")
    except ErreurCerveau as e:
        erreur(str(e))
        cerveau = Cerveau(cfg, complet=False)
    if not cerveau.claude:
        erreur("Claude Code est introuvable. Lance l'installeur ou installe-le depuis https://claude.ai/code")
        return 1

    oreille = None
    if not args.texte:
        try:
            oreille = Oreille(cfg)
        except Exception as e:
            erreur(f"Micro indisponible ({e}). Passage en mode clavier.")
    clavier = oreille is None

    info(f"Mode {'COMPLET (arsenal chargé)' if cerveau.complet else 'léger'} · modèle {cfg['modele'] or 'par défaut'}"
         f" · actions sur le PC {'autorisées' if cfg['autoriser_actions'] else 'désactivées'}")
    if clavier:
        info("Tape ta demande puis Entrée. « au revoir » pour quitter.")
    else:
        mot = "Commence tes phrases par « Jarvis »." if cfg["mot_cle_obligatoire"] else "Parle librement."
        info(f"{mot} Ctrl+C coupe la voix ; Ctrl+C pendant l'écoute quitte.")
    print()
    voix.dire(salutation())

    libre_jusqu_a = 0.0
    while True:
        try:
            if clavier:
                texte = input(f"{VERT}{GRAS}  Vous ›{RAZ} ").strip()
                besoin_mot = False
            else:
                texte = oreille.ecouter()
                besoin_mot = cfg["mot_cle_obligatoire"] and time.time() > libre_jusqu_a
        except (KeyboardInterrupt, EOFError):
            print()
            break
        if not texte:
            continue

        trouve, demande = extraire_mot_cle(texte, cfg["mots_cles"])
        if not clavier:
            print(f"{VERT}  Vous ›{RAZ} {texte}" if trouve or not besoin_mot else f"{GRIS}  (ignoré) {texte}{RAZ}")
        if besoin_mot and not trouve:
            continue
        if not demande:
            voix.dire("Oui monsieur ?")
            libre_jusqu_a = time.time() + cfg["fenetre_conversation_s"]
            continue

        action = commande_locale(demande)
        if action == "quitter":
            voix.dire("À votre service, monsieur. Bonne journée.")
            break
        if action == "rien":
            libre_jusqu_a = 0
            continue
        if action == "nouvelle":
            cerveau.nouvelle_conversation()
            voix.dire("Mémoire de conversation effacée. Je vous écoute.")
            continue
        if action in ("complet", "leger"):
            try:
                cerveau.regler_mode(action == "complet")
                voix.dire("Arsenal complet chargé. Mes réponses seront plus lentes." if cerveau.complet
                          else "Mode léger activé.")
            except ErreurCerveau as e:
                voix.dire(str(e))
            continue

        try:
            with Indicateur("Jarvis réfléchit…"):
                reponse = cerveau.demander(demande)
        except ErreurCerveau as e:
            voix.dire(f"Désolé monsieur, un problème est survenu. {e}")
            continue
        except KeyboardInterrupt:
            info("(demande annulée)")
            continue
        voix.dire(reponse)
        libre_jusqu_a = time.time() + cfg["fenetre_conversation_s"]
    return 0


# ─────────────────────────────── diagnostic ───────────────────────────────

def diagnostic(cfg):
    print(BANNIERE)
    ok_total = True

    def ligne(ok, quoi, detail="", optionnel=False):
        nonlocal ok_total
        ok_total = ok_total and (ok or optionnel)
        marque = f"{VERT}✓" if ok else f"{ROUGE}✗"
        print(f"  {marque} {quoi}{RAZ} {GRIS}{detail}{RAZ}")

    ligne(sys.version_info >= (3, 9), "Python", sys.version.split()[0])

    claude = trouver_claude()
    ligne(bool(claude), "Claude Code", claude or "introuvable — https://claude.ai/code")
    if claude:
        try:
            with Indicateur("Test de Claude Code…"):
                r = Cerveau(cfg).demander("Réponds seulement le mot : opérationnel", vocal=False)
            ligne(True, "Connexion à Claude", f"réponse : {r[:40]}")
        except ErreurCerveau as e:
            ligne(False, "Connexion à Claude", str(e))

    arsenal = (DOSSIER_COMPLET / ".claude" / "skills").is_dir()
    ligne(arsenal, "Arsenal complet", "installé" if arsenal else "absent — seul le mode léger est disponible",
          optionnel=True)

    try:
        import sounddevice as sd
        micro = sd.query_devices(kind="input")
        ligne(True, "Micro", micro["name"])
    except Exception as e:
        ligne(False, "Micro", f"{e} (le mode --texte reste possible)", optionnel=True)
    try:
        import speech_recognition  # noqa: F401
        ligne(True, "Reconnaissance vocale", "Google (en ligne)")
    except ImportError as e:
        ligne(False, "Reconnaissance vocale", str(e))

    voix = Voix(cfg)
    try:
        voix._dire_neuronale("Diagnostic terminé. Je suis prêt, monsieur.")
        ligne(True, "Voix neuronale", cfg["voix"])
    except Exception as e:
        ligne(False, "Voix neuronale", f"{type(e).__name__}: {e}"[:120])
        try:
            voix._dire_locale("Diagnostic terminé. Je suis prêt.")
            ligne(True, "Voix de secours (système)", "pyttsx3")
        except Exception as e2:
            ligne(False, "Voix de secours (système)", f"{e2}"[:120])
    print()
    return 0 if ok_total else 1


def main():
    p = argparse.ArgumentParser(description="JARVIS — assistant vocal propulsé par Claude Code")
    p.add_argument("--texte", action="store_true", help="taper au clavier au lieu de parler")
    p.add_argument("--muet", action="store_true", help="ne pas lire les réponses à voix haute")
    p.add_argument("--complet", action="store_true", help="charger l'arsenal complet de skills")
    p.add_argument("--diagnostic", action="store_true", help="vérifier l'installation")
    args = p.parse_args()
    cfg = charger_config()
    if args.diagnostic:
        return diagnostic(cfg)
    return boucle(cfg, args)


if __name__ == "__main__":
    sys.exit(main())
