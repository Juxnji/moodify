# =====================================================================
#  Moodify - installer
#  Installs Spicetify, the Moodify theme, the (patched) Marketplace and
#  the extensions Spicy Lyrics, Volume Percentage and Play Next.
#  Automatically picks the Moodify version that matches the installed
#  Spotify version (see versions.json).
#
#  Run in PowerShell (NOT as administrator):
#    iwr -useb https://raw.githubusercontent.com/Juxnji/moodify/main/install.ps1 | iex
#
#  Install a specific version:
#    $env:MOODIFY_VERSION = "v1.0.0"; iwr -useb https://raw.githubusercontent.com/Juxnji/moodify/main/install.ps1 | iex
# =====================================================================

param([string]$Version = $env:MOODIFY_VERSION)

$Repo = "Juxnji/moodify"

function Write-Step($text) { Write-Host ""; Write-Host ">> $text" -ForegroundColor Cyan }
function Write-Ok($text) { Write-Host "   $text" -ForegroundColor Green }
function Write-Note($text) { Write-Host "   $text" -ForegroundColor Yellow }
function Write-Fail($text) { Write-Host ""; Write-Host "ERROR: $text" -ForegroundColor Red; Write-Host "" }

# "1.3.4.258" -> "1.3.4"
function Get-ShortVersion([string]$v) { (($v -split '\.') | Select-Object -First 3) -join '.' }

function Test-IsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    (New-Object Security.Principal.WindowsPrincipal($identity)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Installs the Spicetify command line tool without any questions (same steps as the
# official installer: download the release, unpack it, add it to PATH).
# $PreferredVersion = "2.45.3" installs exactly that version, empty = latest version.
function Install-SpicetifyCli([string]$TargetDir, [string]$PreferredVersion) {
    $arch = switch ($env:PROCESSOR_ARCHITECTURE) { "AMD64" { "x64" } "ARM64" { "arm64" } default { "x32" } }
    $version = $PreferredVersion
    if (-not $version) {
        try { $version = (Invoke-RestMethod -UseBasicParsing "https://api.github.com/repos/spicetify/cli/releases/latest").tag_name -replace '^v', '' } catch { }
    }
    if (-not $version) { throw "Could not find out which Spicetify version to download." }
    $zip = Join-Path $env:TEMP "spicetify-$version.zip"
    Invoke-WebRequest -UseBasicParsing "https://github.com/spicetify/cli/releases/download/v$version/spicetify-$version-windows-$arch.zip" -OutFile $zip
    New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
    Expand-Archive -Path $zip -DestinationPath $TargetDir -Force
    Remove-Item $zip -Force -ErrorAction SilentlyContinue
    # Make "spicetify" available in new terminals as well
    $userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
    if (-not $userPath) { $userPath = "" }
    if (($userPath -split ';') -notcontains $TargetDir) {
        [Environment]::SetEnvironmentVariable("PATH", (($userPath.TrimEnd(';') + ";" + $TargetDir).TrimStart(';')), "User")
    }
    return $version
}

function Install-Moodify {
    Write-Host ""
    Write-Host "  ===  Moodify  ===" -ForegroundColor Magenta

    # --- 0. Not as administrator --------------------------------------------
    if (Test-IsAdmin) {
        Write-Fail ("PowerShell is running as administrator - Spicetify doesn't work like that.`n" +
            "   Close this window, open PowerShell normally (NOT 'Run as administrator') and run the line again.")
        return
    }

    # --- 1. Is Spotify installed? -------------------------------------------
    Write-Step "Checking Spotify"
    $spotifyExe = Join-Path $env:APPDATA "Spotify\Spotify.exe"
    if (-not (Test-Path $spotifyExe)) {
        Write-Fail ("Spotify was not found.`n" +
            "   Please install Spotify from https://www.spotify.com/download (NOT from the Microsoft Store),`n" +
            "   open it once and log in - then run this command again.")
        return
    }
    $spotifyVersion = (Get-Item $spotifyExe).VersionInfo.ProductVersion
    $spotifyShort = Get-ShortVersion $spotifyVersion
    Write-Ok "Found Spotify $spotifyVersion"

    # --- 2. Find the matching Moodify version -------------------------------
    Write-Step "Looking for the matching Moodify version"
    $list = @()
    try {
        $list = @((Invoke-RestMethod -UseBasicParsing "https://raw.githubusercontent.com/$Repo/main/versions.json").versions)
    } catch {
        Write-Note "Could not load the version list - using the latest version."
    }
    $entry = $null
    if ($Version) {
        $entry = $list | Where-Object { $_.moodify -eq $Version } | Select-Object -First 1
        if (-not $entry) {
            Write-Note "Version $Version is not in the list - trying it anyway."
            $entry = [pscustomobject]@{ moodify = $Version; spotify = @(); spicetify = $null }
        }
    } elseif ($list.Count -gt 0) {
        $entry = $list | Where-Object { $_.spotify -contains $spotifyShort } | Select-Object -First 1
        if (-not $entry) {
            $entry = $list | Select-Object -First 1
            Write-Note "Moodify has not been tested with Spotify $spotifyShort yet."
            Write-Note "Using the newest version ($($entry.moodify), tested with Spotify $($entry.spotify -join ', '))."
            Write-Note "If something looks off: run this again later, once there is a Moodify update."
        }
    }
    if ($entry -and $entry.spotify.Count -gt 0) {
        Write-Ok "Moodify $($entry.moodify) - tested with Spotify $($entry.spotify -join ', ')"
    } elseif ($entry) {
        Write-Ok "Moodify $($entry.moodify)"
    }

    # --- 3. Install / update Spicetify --------------------------------------
    Write-Step "Checking Spicetify"
    $spicetifyDir = Join-Path $env:LOCALAPPDATA "spicetify"
    $spicetify = Join-Path $spicetifyDir "spicetify.exe"
    if (-not (Test-Path $spicetify)) {
        # maybe installed somewhere else (e.g. with Scoop or winget)
        $found = Get-Command spicetify -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found) { $spicetify = $found.Source; $spicetifyDir = Split-Path $spicetify }
    }
    if (-not (Test-Path $spicetify)) {
        # Tested combination -> that Spicetify version, otherwise the newest one
        $preferred = if ($entry -and $entry.spicetify -and ($entry.spotify -contains $spotifyShort)) { $entry.spicetify } else { "" }
        Write-Note "Spicetify is not installed yet - installing it now ..."
        $installedCli = Install-SpicetifyCli -TargetDir $spicetifyDir -PreferredVersion $preferred
        $spicetify = Join-Path $spicetifyDir "spicetify.exe"
        if (Test-Path $spicetify) { Write-Ok "Installed Spicetify $installedCli" }
    }
    if (-not (Test-Path $spicetify)) { Write-Fail "Spicetify could not be installed."; return }
    $env:PATH = "$spicetifyDir;$env:PATH"
    if ($entry -and $entry.spicetify) {
        try {
            $have = (& $spicetify -v | Select-Object -Last 1).Trim()
            if ([version]$have -lt [version]$entry.spicetify) {
                Write-Note "Spicetify $have is older than recommended ($($entry.spicetify)) - updating ..."
                & $spicetify upgrade
            }
        } catch { }
    }
    & $spicetify config | Out-Null          # creates the config if it doesn't exist yet
    # Spicetify's settings folder: only trust an answer that is a real folder
    $userdata = Join-Path $env:APPDATA "spicetify"
    $answerPath = & $spicetify path userdata 2>$null | ForEach-Object { "$_".Trim() } | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Container -ErrorAction SilentlyContinue) } | Select-Object -Last 1
    if ($answerPath) { $userdata = $answerPath }
    Write-Ok "Spicetify is ready"

    # --- 4. Download Moodify -----------------------------------------------
    Write-Step "Downloading Moodify"
    $tmp = Join-Path $env:TEMP ("moodify-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $tmp | Out-Null
    $zip = Join-Path $tmp "moodify.zip"
    $installed = "latest"
    $downloaded = $false
    if ($entry) {
        try {
            Invoke-WebRequest -UseBasicParsing "https://github.com/$Repo/archive/refs/tags/$($entry.moodify).zip" -OutFile $zip
            $installed = $entry.moodify
            $downloaded = $true
        } catch {
            Write-Note "Version $($entry.moodify) not found - using the latest version."
        }
    }
    if (-not $downloaded) {
        Invoke-WebRequest -UseBasicParsing "https://github.com/$Repo/archive/refs/heads/main.zip" -OutFile $zip
    }
    Expand-Archive -Path $zip -DestinationPath $tmp -Force
    $src = Get-ChildItem $tmp -Directory | Select-Object -First 1
    Write-Ok "Downloaded ($installed)"

    # --- 5. Copy the files to the right places ------------------------------
    Write-Step "Copying files"
    $themeDir = Join-Path $userdata "Themes\Moodify"
    $appDir = Join-Path $userdata "CustomApps\marketplace"
    $extDir = Join-Path $userdata "Extensions"
    foreach ($d in $themeDir, $appDir, $extDir) { New-Item -ItemType Directory -Force -Path $d | Out-Null }
    Copy-Item (Join-Path $src.FullName "theme\Moodify\*") $themeDir -Force
    Copy-Item (Join-Path $src.FullName "marketplace\*") $appDir -Force
    # Extensions come straight from their authors (always up to date, their licenses apply)
    $extensions = [ordered]@{
        "spicy-lyrics.mjs"    = "https://raw.githubusercontent.com/Spikerko/spicy-lyrics/main/builds/spicy-lyrics.mjs"
        "volumePercentage.js" = "https://raw.githubusercontent.com/daksh2k/Spicetify-stuff/master/Extensions/volumePercentage.js"
        "playNext.js"         = "https://raw.githubusercontent.com/daksh2k/Spicetify-stuff/master/Extensions/playNext.js"
    }
    foreach ($name in $extensions.Keys) {
        try {
            Invoke-WebRequest -UseBasicParsing $extensions[$name] -OutFile (Join-Path $extDir $name)
        } catch {
            Write-Note "Could not download the extension $name - skipping it."
        }
    }
    Set-Content -Path (Join-Path $themeDir "installed-version.txt") -Value "$installed (Spotify $spotifyVersion, installed $(Get-Date -Format 'yyyy-MM-dd'))"
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
    Write-Ok "Theme, Marketplace and extensions copied"

    # --- 6. Configure Spicetify --------------------------------------------
    Write-Step "Configuring Spicetify"
    & $spicetify config current_theme Moodify color_scheme Base inject_css 1 replace_colors 1 inject_theme_js 1 | Out-Null
    $cfg = Get-Content ((& $spicetify path -c | Select-Object -Last 1).Trim()) -Raw
    if ($cfg -notmatch "custom_apps\s*=.*marketplace") { & $spicetify config custom_apps marketplace | Out-Null }
    foreach ($ext in "spicy-lyrics.mjs", "volumePercentage.js", "playNext.js") {
        if ($cfg -notmatch [regex]::Escape($ext)) { & $spicetify config extensions $ext | Out-Null }
    }
    Write-Ok "Configured"

    # --- 7. Apply to Spotify -----------------------------------------------
    Write-Step "Applying everything to Spotify (Spotify will restart)"
    Get-Process Spotify -ErrorAction SilentlyContinue | Stop-Process -Force
    # Is there already a Spicetify backup for exactly this Spotify version?
    # Yes -> just apply. No (first install or Spotify was updated) -> make a new backup first.
    $cfgNow = Get-Content ((& $spicetify path -c | Select-Object -Last 1).Trim()) -Raw
    $backupVersion = ""
    if ($cfgNow -match '(?ms)^\[Backup\][^\[]*?^version\s*=\s*(\S+)') { $backupVersion = $Matches[1] }
    $backupIsCurrent = $backupVersion -and $backupVersion.StartsWith($spotifyVersion)
    if ($backupIsCurrent) { & $spicetify apply } else { & $spicetify backup apply }
    if ($LASTEXITCODE -ne 0) {
        Write-Note "First attempt didn't work, trying another way ..."
        if ($backupIsCurrent) { & $spicetify restore backup apply } else { & $spicetify apply }
    }
    if ($LASTEXITCODE -ne 0) { Write-Fail "Applying didn't work. The message above shows why."; return }

    Write-Host ""
    Write-Host "  Done! Moodify $installed is installed." -ForegroundColor Green
    Write-Host "  If Spotify doesn't start by itself: just open it normally." -ForegroundColor Green
    Write-Host ""
}

[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
$previousPreference = $ErrorActionPreference
$ErrorActionPreference = "Stop"
try {
    Install-Moodify
} catch {
    Write-Fail $_.Exception.Message
} finally {
    $ErrorActionPreference = $previousPreference
}
