# Runs tests/npv-layouts.html for every sidebar layout in headless Edge and prints what
# Moodify marked; also saves a screenshot per layout into tests\out\.
$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = Join-Path $here "out"
New-Item -ItemType Directory -Force -Path $out | Out-Null
$page = "file:///" + ((Join-Path $here "npv-layouts.html") -replace '\\', '/')
$common = @("--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files", "--virtual-time-budget=6000", "--window-size=1000,560")
foreach ($layout in "a", "b", "b-video") {
    $url = "${page}?layout=$layout"
    $domFile = Join-Path $out "dom-$layout.html"
    Start-Process -FilePath $edge -ArgumentList ($common + @("--dump-dom", $url)) -RedirectStandardOutput $domFile -NoNewWindow -Wait
    $dom = [IO.File]::ReadAllText($domFile, [Text.Encoding]::UTF8)
    if ($dom -match '<body[^>]*data-result="([^"]*)"') {
        Write-Output ("[$layout] " + [System.Net.WebUtility]::HtmlDecode($Matches[1]))
    } else {
        Write-Output "[$layout] no result"
    }
    Start-Process -FilePath $edge -ArgumentList ($common + @("--screenshot=$out\layout-$layout.png", $url)) -NoNewWindow -Wait
}
