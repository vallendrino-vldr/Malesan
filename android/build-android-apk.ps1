param(
    [ValidateSet('debug','release')]
    [string]$Variant = 'release'
)
$ErrorActionPreference = 'Stop'
$android = Split-Path -Parent $MyInvocation.MyCommand.Path
$task = if ($Variant -eq 'release') { 'assembleRelease' } else { 'assembleDebug' }
& (Join-Path $android 'gradlew.bat') $task
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Get-ChildItem (Join-Path $android "app\build\outputs\apk\$Variant") -Filter '*.apk' | Select-Object FullName, Length, LastWriteTime
