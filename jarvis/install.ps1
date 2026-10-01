# JARVIS — installeur Windows
# Lancé par installer.bat (double-clic). Options :
#   -SansArsenal          n'installe pas le pack de 6 500 skills
#   -Arsenal <dossier>    copie le pack depuis un dossier local au lieu de GitHub
param(
    [switch]$SansArsenal,
    [string]$Arsenal = ""
)

$ErrorActionPreference = "Stop"
$Ici = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Ici

function Etape($msg) { Write-Host ""; Write-Host "  >> $msg" -ForegroundColor Cyan }
function Ok($msg)    { Write-Host "     OK  $msg" -ForegroundColor Green }
function Ko($msg)    { Write-Host "     !!  $msg" -ForegroundColor Red }
function Demander($question) {
    $r = Read-Host "     $question (O/n)"
    return ($r -eq "" -or $r -match "^[oOyY]")
}

Write-Host ""
Write-Host "  +==========================================+" -ForegroundColor Cyan
Write-Host "  |        JARVIS — installation Windows      |" -ForegroundColor Cyan
Write-Host "  +==========================================+" -ForegroundColor Cyan

# ── 1. Python ───────────────────────────────────────────────────────────────
Etape "Python"
function Trouver-Python {
    foreach ($essai in @(@("py", "-3"), @("python"), @("python3"))) {
        $exe = $essai[0]
        if (-not (Get-Command $exe -ErrorAction SilentlyContinue)) { continue }
        $args_ = @($essai | Select-Object -Skip 1) + @("-c", "import sys; print(sys.executable) if sys.version_info >= (3, 9) else sys.exit(1)")
        try {
            $chemin = & $exe @args_ 2>$null
            if ($LASTEXITCODE -eq 0 -and $chemin) { return $chemin.Trim() }
        } catch { }
    }
    foreach ($v in @("313", "312", "311", "310")) {
        $p = Join-Path $env:LOCALAPPDATA "Programs\Python\Python$v\python.exe"
        if (Test-Path $p) { return $p }
    }
    return $null
}

$Python = Trouver-Python
if (-not $Python) {
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Host "     Python est absent : installation via winget…"
        winget install -e --id Python.Python.3.12 --scope user --silent --accept-package-agreements --accept-source-agreements
        $Python = Trouver-Python
    }
    if (-not $Python) {
        Ko "Python 3.9+ introuvable. Installe-le depuis https://www.python.org/downloads/ (coche « Add to PATH »), puis relance."
        exit 1
    }
}
Ok $Python

# ── 2. Claude Code ──────────────────────────────────────────────────────────
Etape "Claude Code"
function Trouver-Claude {
    $c = Get-Command claude -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
    $p = Join-Path $env:USERPROFILE ".local\bin\claude.exe"
    if (Test-Path $p) { return $p }
    return $null
}
$Claude = Trouver-Claude
if (-not $Claude) {
    if (Demander "Claude Code n'est pas installé. L'installer maintenant ?") {
        Invoke-RestMethod https://claude.ai/install.ps1 | Invoke-Expression
        $env:Path = "$env:USERPROFILE\.local\bin;$env:Path"
        $Claude = Trouver-Claude
    }
}
if ($Claude) {
    Ok $Claude
} else {
    Ko "Claude Code manquant : https://claude.ai/code — Jarvis ne pourra pas répondre sans lui."
}

# ── 3. Environnement Python et dépendances ──────────────────────────────────
Etape "Modules Python (micro, reconnaissance vocale, voix)"
if (-not (Test-Path ".venv\Scripts\python.exe")) {
    & $Python -m venv .venv
}
$VenvPy = Join-Path $Ici ".venv\Scripts\python.exe"
& $VenvPy -m pip install --quiet --upgrade pip
& $VenvPy -m pip install --quiet -r requirements.txt
if ($LASTEXITCODE -ne 0) { Ko "L'installation des modules a échoué."; exit 1 }
Ok "modules installés"

# ── 4. Arsenal (pack de skills) ─────────────────────────────────────────────
Etape "Arsenal complet (6 500 skills, 942 agents, 966 commandes)"
if ($SansArsenal) {
    Write-Host "     ignoré (-SansArsenal)"
} elseif ($Arsenal) {
    & $VenvPy installer_arsenal.py --source $Arsenal
} elseif (Test-Path "arsenal\.claude\skills") {
    Ok "déjà installé"
} elseif (Demander "Télécharger l'arsenal (~190 Mo, optionnel : la voix marche sans) ?") {
    & $VenvPy installer_arsenal.py
}

# ── 5. Raccourci sur le Bureau ──────────────────────────────────────────────
Etape "Raccourci sur le Bureau"
try {
    $Bureau = [Environment]::GetFolderPath("Desktop")
    $Shell = New-Object -ComObject WScript.Shell
    $Lien = $Shell.CreateShortcut((Join-Path $Bureau "Jarvis.lnk"))
    $Lien.TargetPath = Join-Path $Ici "Jarvis.bat"
    $Lien.WorkingDirectory = $Ici
    $Lien.IconLocation = "$env:SystemRoot\System32\SHELL32.dll,138"
    $Lien.Description = "JARVIS — assistant vocal"
    $Lien.Save()
    Ok "Jarvis.lnk créé sur le Bureau"
} catch {
    Ko "Raccourci non créé ($_). Lance Jarvis.bat directement."
}

# ── 6. Diagnostic ───────────────────────────────────────────────────────────
Etape "Diagnostic"
& $VenvPy jarvis.py --diagnostic

Write-Host ""
Write-Host "  Installation terminée." -ForegroundColor Green
Write-Host "  Si Claude Code n'est pas encore connecté : ouvre un terminal, tape  claude  et connecte-toi."
Write-Host "  Ensuite : double-clic sur « Jarvis » sur le Bureau, puis dis « Jarvis, quelle heure est-il ? »"
Write-Host ""
