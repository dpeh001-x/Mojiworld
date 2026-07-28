# Build Mojiworld.exe (repo root) from launcher/MojiworldLauncher.cs.
# Uses the .NET Framework 4.x csc.exe that ships with Windows — no SDK needed.
# Icon: the Steam app icon (steam/build/icon.ico).
#   powershell -ExecutionPolicy Bypass -File launcher\build_launcher.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$csc = "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $csc)) { $csc = "$env:WINDIR\Microsoft.NET\Framework\v4.0.30319\csc.exe" }
& $csc /nologo /target:winexe /platform:anycpu /optimize+ `
    /out:"$root\Mojiworld.exe" `
    /win32icon:"$root\steam\build\icon.ico" `
    /win32manifest:"$root\launcher\app.manifest" `
    /r:System.Windows.Forms.dll `
    "$root\launcher\MojiworldLauncher.cs"
if ($LASTEXITCODE -eq 0) { Write-Output "built $root\Mojiworld.exe" } else { exit $LASTEXITCODE }
