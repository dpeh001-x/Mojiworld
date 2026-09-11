# Build Mojiworld.exe (repo root) from tools/launcher/MojiworldLauncher.cs.
# Uses the .NET Framework 4.x csc.exe that ships with Windows — no SDK needed.
# Icon: the Steam app icon (steam/build/icon.ico).
#   powershell -ExecutionPolicy Bypass -File tools\launcher\build_launcher.ps1
#
# NOTE: the produced exe is UNSIGNED, so Windows 11 machines with Smart App
# Control enforced refuse to run it (no override exists). Mojiworld.cmd is the
# SAC-safe launcher; signing this exe with a trusted-CA cert is the real fix.
#
# v0.30.589 - the exe is no longer in the repo root (it was a trap for every SAC
# machine, the owner's included). This script now builds to tools\launcher\out\
# and stops there. To reinstate it: build, SIGN the output (see
# docs/guides/CODE_SIGNING.md - signtool + Azure Trusted Signing or an OV cert),
# verify with Get-AuthenticodeSignature (Status must be Valid), then copy it to
# the root and commit. -AllowUnsignedInRoot exists for a machine WITHOUT SAC that
# wants the old behaviour, and says so loudly.
param([switch]$AllowUnsignedInRoot)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$outDir = Join-Path $PSScriptRoot 'out'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
$out = if ($AllowUnsignedInRoot) { Join-Path $root 'Mojiworld.exe' } else { Join-Path $outDir 'Mojiworld.exe' }
$csc = "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $csc)) { $csc = "$env:WINDIR\Microsoft.NET\Framework\v4.0.30319\csc.exe" }
& $csc /nologo /target:winexe /platform:anycpu /optimize+ `
    /out:"$out" `
    /win32icon:"$root\steam\build\icon.ico" `
    /win32manifest:"$root\tools\launcher\app.manifest" `
    /r:System.Windows.Forms.dll `
    "$root\tools\launcher\MojiworldLauncher.cs"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Output "built $out"
$sig = Get-AuthenticodeSignature $out
if ($sig.Status -ne 'Valid') {
  Write-Warning "$out is UNSIGNED - Smart App Control will refuse it. Sign it before it goes anywhere near the repo root (docs/guides/CODE_SIGNING.md)."
  if ($AllowUnsignedInRoot) { Write-Warning "You asked for it in the root anyway (-AllowUnsignedInRoot). Do not commit it." }
}
