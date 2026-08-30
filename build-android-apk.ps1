param(
    [ValidateSet('debug','release')]
    [string]$Variant = 'release'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
& (Join-Path $root 'android\build-android-apk.ps1') -Variant $Variant
exit $LASTEXITCODE
