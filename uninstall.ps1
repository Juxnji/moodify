# =====================================================================
#  Moodify - uninstall
#  Restores the normal Spotify and deletes everything Moodify installed:
#  the theme, the extensions (Spicy Lyrics, Volume Percentage, Play Next)
#  and the patched Marketplace. At the end it asks whether Spicetify itself
#  should be removed as well.
#
#  Run in PowerShell (NOT as administrator):
#    iwr -useb https://raw.githubusercontent.com/Juxnji/moodify/main/uninstall.ps1 | iex
#
#  Without the question (e.g. for scripts):
#    $env:MOODIFY_REMOVE_SPICETIFY = "yes"   # or "no"
# =====================================================================

function Write-Step($text) { Write-Host ""; Write-Host ">> $text" -ForegroundColor Cyan }
function Write-Ok($text) { Write-Host "   $text" -ForegroundColor Green }
function Write-Note($text) { Write-Host "   $text" -ForegroundColor Yellow }

function Remove-IfThere([string]$Path) {
    if (Test-Path $Path) {
        Remove-Item $Path -Recurse -Force -ErrorAction SilentlyContinue
        if (Test-Path $Path) { Write-Note "Could not delete $Path (is Spotify still open?)" } else { Write-Ok "Deleted $Path" }
    }
}

function Uninstall-Moodify {
    Write-Host ""
    Write-Host "  ===  Uninstall Moodify  ===" -ForegroundColor Magenta

    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    if ((New-Object Security.Principal.WindowsPrincipal($identity)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-Host ""
        Write-Host "ERROR: PowerShell is running as administrator. Close this window, open PowerShell" -ForegroundColor Red
        Write-Host "       normally (NOT 'Run as administrator') and run the line again." -ForegroundColor Red
        return
    }

    # Where is Spicetify?
    $spicetifyDir = Join-Path $env:LOCALAPPDATA "spicetify"
    $spicetify = Join-Path $spicetifyDir "spicetify.exe"
    if (-not (Test-Path $spicetify)) {
        $found = Get-Command spicetify -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found) { $spicetify = $found.Source; $spicetifyDir = Split-Path $spicetify }
    }
    $hasSpicetify = Test-Path $spicetify
    # Spicetify's settings folder: ask Spicetify, but only trust an answer that is a real
    # folder (it may print an error message instead)
    $userdata = Join-Path $env:APPDATA "spicetify"
    if ($hasSpicetify) {
        try {
            $answerPath = & $spicetify path userdata 2>$null | ForEach-Object { "$_".Trim() } | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Container -ErrorAction SilentlyContinue) } | Select-Object -Last 1
            if ($answerPath) { $userdata = $answerPath }
        } catch { }
    }

    # --- 1. Normal Spotify back ---------------------------------------------
    Write-Step "Restoring the normal Spotify"
    Get-Process Spotify -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 1
    if ($hasSpicetify) {
        & $spicetify restore
        if ($LASTEXITCODE -eq 0) { Write-Ok "Spotify restored" } else { Write-Note "Spicetify couldn't restore Spotify (maybe it was already normal)." }
    } else {
        Write-Note "Spicetify not found - Spotify is probably normal already."
    }

    # --- 2. Delete everything Moodify installed -----------------------------
    Write-Step "Deleting Moodify"
    Remove-IfThere (Join-Path $userdata "Themes\Moodify")
    foreach ($ext in "spicy-lyrics.mjs", "volumePercentage.js", "playNext.js") { Remove-IfThere (Join-Path $userdata "Extensions\$ext") }
    Remove-IfThere (Join-Path $userdata "CustomApps\marketplace")

    # ... and take it out of Spicetify's settings
    $config = Join-Path $userdata "config-xpui.ini"
    if (Test-Path $config) {
        $text = [IO.File]::ReadAllText($config)
        $text = [regex]::Replace($text, '(?m)^(current_theme\s*=)\s*Moodify\s*$', '$1 ')
        $text = [regex]::Replace($text, '(?m)^(color_scheme\s*=)\s*Base\s*$', '$1 ')
        $text = [regex]::Replace($text, '(?m)^(extensions\s*=)(.*)$', {
            param($m)
            $left = ($m.Groups[2].Value -split '\|') | ForEach-Object { $_.Trim() } | Where-Object { $_ -and $_ -notin @("spicy-lyrics.mjs", "volumePercentage.js", "playNext.js") }
            $m.Groups[1].Value + " " + ($left -join "|")
        })
        $text = [regex]::Replace($text, '(?m)^(custom_apps\s*=)(.*)$', {
            param($m)
            $left = ($m.Groups[2].Value -split '\|') | ForEach-Object { $_.Trim() } | Where-Object { $_ -and $_ -ne "marketplace" }
            $m.Groups[1].Value + " " + ($left -join "|")
        })
        [IO.File]::WriteAllText($config, $text, (New-Object Text.UTF8Encoding $false))
        Write-Ok "Removed Moodify from Spicetify's settings"
    }

    # --- 3. Spicetify too? ----------------------------------------------------
    if (-not $hasSpicetify -and -not (Test-Path $userdata)) { Write-Host ""; Write-Host "  Done - Moodify is gone and Spotify is back to normal." -ForegroundColor Green; return }
    $answer = $env:MOODIFY_REMOVE_SPICETIFY
    if (-not $answer) {
        Write-Host ""
        Write-Host "   Spicetify is the tool Moodify runs on. Other themes or extensions may use it too." -ForegroundColor Gray
        $choices = [System.Management.Automation.Host.ChoiceDescription[]] @(
            (New-Object System.Management.Automation.Host.ChoiceDescription "&No", "Keep Spicetify installed."),
            (New-Object System.Management.Automation.Host.ChoiceDescription "&Yes", "Remove Spicetify completely.")
        )
        $answer = if ($Host.UI.PromptForChoice("", "Remove Spicetify completely as well?", $choices, 0) -eq 1) { "yes" } else { "no" }
    }
    if ($answer -match '^(y|yes|j|ja)$') {
        Write-Step "Removing Spicetify"
        # Safety: only delete folders that really are Spicetify's own ("...\spicetify").
        # If it was installed with Scoop/winget, its folder is shared with other programs.
        $ownFolder = { param($p) $p -and ((Split-Path $p -Leaf) -eq "spicetify") -and (Test-Path $p) }
        if (& $ownFolder $userdata) { Remove-IfThere $userdata }
        if (& $ownFolder $spicetifyDir) {
            Remove-IfThere $spicetifyDir
            # Take it out of PATH again
            $userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
            if ($userPath) {
                $parts = ($userPath -split ';') | Where-Object { $_ -and ($_.TrimEnd('\') -ne $spicetifyDir.TrimEnd('\')) }
                [Environment]::SetEnvironmentVariable("PATH", ($parts -join ';'), "User")
                Write-Ok "Removed Spicetify from PATH"
            }
        } elseif ($hasSpicetify) {
            Write-Note "Spicetify was installed with another tool ($spicetifyDir) - please uninstall it there (e.g. 'scoop uninstall spicetify-cli')."
        }
    } else {
        Write-Ok "Spicetify stays installed"
    }

    Write-Host ""
    Write-Host "  Done - Moodify is gone and Spotify is back to normal." -ForegroundColor Green
    Write-Host "  Just open Spotify again." -ForegroundColor Green
    Write-Host ""
}

Uninstall-Moodify
