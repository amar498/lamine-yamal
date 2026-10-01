# JARVIS — assistant vocal

Tu dis « **Jarvis**, … » au micro, il te répond à voix haute. Le cerveau, c'est
**Claude Code** : Jarvis peut chercher sur le web, retient le fil de la conversation
et peut charger l'arsenal complet de 6 500 skills.

## Installation

Il te faut une connexion Internet et un compte Claude (abonnement Pro/Max ou clé API).
L'installeur s'occupe du reste : Python, Claude Code, les modules audio, l'arsenal et
un raccourci.

**Windows** : double-clic sur **`installer.bat`**.
Ensuite, double-clic sur **Jarvis** sur le Bureau.

**Mac / Linux** :
```bash
cd jarvis
./install.sh
./jarvis.sh
```

Si Claude Code n'a jamais été utilisé sur l'ordinateur, ouvre un terminal, tape
`claude` et connecte-toi une fois. L'installeur termine par un diagnostic qui te dit
ce qui marche ou pas.

## Utilisation

| Tu dis | Jarvis |
|---|---|
| « Jarvis, quelle heure est-il ? » | répond à voix haute |
| « Jarvis » (seul) | « Oui monsieur ? », puis écoute ta demande |
| … puis une autre question dans les 10 s | pas besoin de redire « Jarvis » |
| « Jarvis, nouvelle conversation » | oublie la conversation en cours |
| « Jarvis, mode complet » / « mode léger » | charge ou décharge l'arsenal |
| « Jarvis, stop » | ne fait rien et attend |
| « Jarvis, au revoir » | s'éteint |

**Ctrl+C** pendant qu'il parle lui coupe la parole. Ctrl+C pendant qu'il écoute ferme
Jarvis.

Options de lancement (`Jarvis.bat …` ou `./jarvis.sh …`) :

- `--texte` : tu tapes au clavier, il répond à voix haute (pratique sans micro)
- `--muet` : réponses écrites seulement
- `--complet` : démarre directement avec l'arsenal complet
- `--diagnostic` : vérifie l'installation

## Réglages (`config.json`)

| Clé | Par défaut | Rôle |
|---|---|---|
| `voix` | `fr-FR-HenriNeural` | voix masculine grave. Autres : `fr-FR-RemyMultilingualNeural`, `fr-FR-DeniseNeural`, `fr-CA-AntoineNeural`, `fr-BE-GerardNeural` |
| `vitesse_voix` | `+8%` | débit de la voix (`-10%`, `+20%`…) |
| `modele` | `sonnet` | `sonnet` est rapide ; `opus` est plus fort mais plus lent ; `haiku` est le plus rapide |
| `mode` | `leger` | `complet` charge l'arsenal à chaque question |
| `mot_cle_obligatoire` | `true` | `false` : Jarvis répond à tout ce qu'il entend |
| `fenetre_conversation_s` | `10` | secondes pendant lesquelles on peut enchaîner sans redire « Jarvis » |
| `autoriser_actions` | `false` | `true` : Jarvis peut lancer des commandes et modifier des fichiers sur ton PC. À n'activer qu'en connaissance de cause |

## Comment ça marche

```
micro ─► détection de phrase ─► Google Speech (texte) ─► « Jarvis » ? ─► Claude Code ─► voix Edge ─► haut-parleur
```

- **Écoute** : `sounddevice` capte le micro. Une phrase commence quand le son dépasse
  le bruit ambiant (calibré au démarrage) et se termine après un court silence. Le
  micro est coupé pendant que Jarvis parle, pour qu'il ne s'entende pas lui-même.
- **Reconnaissance** : Google Speech, gratuit, sans clé, en français.
- **Cerveau** : `claude -p` lancé dans `cerveau/` (mode léger) ou `arsenal/` (mode
  complet). La personnalité est dans `cerveau/CLAUDE.md`. La conversation continue
  d'une question à l'autre grâce à `--resume`.
- **Voix** : voix neuronale Microsoft Edge (gratuite, en ligne). Sans Internet, Jarvis
  bascule sur la voix du système.

### Mode léger ou complet ?

Le pack complet ajoute environ **160 000 tokens** à *chaque* question : c'est la liste
de tous les skills et agents. Mesuré : environ 2 fois plus lent, et environ 0,64 $ par
question en API (contre 0,04 $) ou une grosse part de ton quota d'abonnement. Le mode
léger suffit pour discuter, chercher et répondre. Passe en complet pour un besoin
précis (« Jarvis, mode complet »), ou ouvre le dossier `arsenal/` dans Claude Code pour
travailler à l'écrit avec tout l'arsenal (`@jarvis`, `/jarvis`, `/code-review`…).

### Sécurité

Le `settings.json` d'origine autorisait **tout** sans confirmation (`Bash(*)`,
`Write(*)`…). Ici, Jarvis peut seulement lire et chercher. Pour qu'il agisse sur le PC,
mets `autoriser_actions` à `true`. Dans le dossier `arsenal/`, Claude Code te demande
la permission avant toute modification.

## Fichiers

```
jarvis/
  installer.bat / install.ps1   installeur Windows
  install.sh                    installeur Mac / Linux
  Jarvis.bat / jarvis.sh        lanceurs
  jarvis.py                     l'assistant vocal
  installer_arsenal.py          télécharge le pack de skills dans arsenal/
  cerveau/CLAUDE.md             personnalité de Jarvis
  config.json                   réglages
  arsenal/                      (créé à l'installation, non versionné)
```

## Crédits

L'arsenal de skills, d'agents et de commandes vient de
[dfnine9/jarvis-ai-assistant](https://github.com/dfnine9/jarvis-ai-assistant)
(licence MIT). Il est téléchargé à l'installation, pas copié dans ce dépôt.
