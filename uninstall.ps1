# Moodify - uninstall
# Restores the normal Spotify (Spicetify stays installed but is switched off).
#   iwr -useb https://raw.githubusercontent.com/Juxnji/moodify/main/uninstall.ps1 | iex

$spicetify = Join-Path $env:LOCALAPPDATA "spicetify\spicetify.exe"
if (-not (Test-Path $spicetify)) { Write-Host "Spicetify is not installed - nothing to do." -ForegroundColor Yellow; return }
Get-Process Spotify -ErrorAction SilentlyContinue | Stop-Process -Force
& $spicetify restore
Write-Host ""
Write-Host "Done - Spotify is back to normal." -ForegroundColor Green
