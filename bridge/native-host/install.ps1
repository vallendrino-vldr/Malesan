param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-p]{32}$')]
  [string]$ExtensionId
)
$ErrorActionPreference = 'Stop'
$NodeVersion = 'v24.8.0'
$YtDlpVersion = '2025.08.27'
$Root = Join-Path $env:LOCALAPPDATA 'Malesan\BridgeHost'
$Runtime = Join-Path $Root 'runtime'
$Tools = Join-Path $Root 'tools'
$Temp = Join-Path $env:TEMP ('malesan-bridge-' + [guid]::NewGuid())
New-Item -ItemType Directory -Force $Root,$Runtime,$Tools,$Temp | Out-Null
try {
  Copy-Item (Join-Path $PSScriptRoot 'src') $Root -Recurse -Force
  Copy-Item (Join-Path $PSScriptRoot 'malesan-bridge.cmd') $Root -Force

  $NodeCmd = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($NodeCmd -and (Test-Path $NodeCmd.Source)) {
    Copy-Item $NodeCmd.Source (Join-Path $Runtime 'node.exe') -Force
  } else {
    $NodeZip = Join-Path $Temp 'node.zip'
    Invoke-WebRequest "https://nodejs.org/dist/$NodeVersion/node-$NodeVersion-win-x64.zip" -OutFile $NodeZip
    Expand-Archive $NodeZip $Temp -Force
    Copy-Item (Join-Path $Temp "node-$NodeVersion-win-x64\node.exe") $Runtime -Force
  }

  $YtDlp = Join-Path $Tools 'yt-dlp.exe'
  $Checksum = Join-Path $Temp 'SHA2-256SUMS'
  Invoke-WebRequest "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" -OutFile $YtDlp
  Invoke-WebRequest "https://github.com/yt-dlp/yt-dlp/releases/latest/download/SHA2-256SUMS" -OutFile $Checksum
  $Expected = ((Select-String -Path $Checksum -Pattern '^[0-9a-f]{64}\s+yt-dlp\.exe$').Line -split '\s+')[0]
  $Actual = (Get-FileHash $YtDlp -Algorithm SHA256).Hash.ToLowerInvariant()
  if (!$Expected -or $Actual -ne $Expected) { throw 'Checksum yt-dlp gak cocok. Instalasi dihentikan.' }

  $FfmpegCmd = Get-Command ffmpeg.exe -ErrorAction SilentlyContinue
  if ($FfmpegCmd -and (Test-Path $FfmpegCmd.Source)) {
    Copy-Item $FfmpegCmd.Source (Join-Path $Tools 'ffmpeg.exe') -Force
  } else {
    $FfmpegZip = Join-Path $Temp 'ffmpeg.zip'
    Invoke-WebRequest 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip' -OutFile $FfmpegZip
    Expand-Archive $FfmpegZip $Temp -Force
    $Ffmpeg = Get-ChildItem $Temp -Filter ffmpeg.exe -Recurse | Select-Object -First 1
    if (!$Ffmpeg) { throw 'ffmpeg.exe gak ditemukan di paket resmi.' }
    Copy-Item $Ffmpeg.FullName $Tools -Force
  }

  $HostPath = (Join-Path $Root 'malesan-bridge.cmd').Replace('\','\\')
  $ManifestPath = Join-Path $Root 'com.malesan.bridge.json'
  $Manifest = (Get-Content (Join-Path $PSScriptRoot 'com.malesan.bridge.json') -Raw).Replace('__HOST_PATH__',$HostPath).Replace('__EXTENSION_ID__',$ExtensionId)
  [IO.File]::WriteAllText($ManifestPath, $Manifest, [Text.UTF8Encoding]::new($false))
  $RegPaths = @(
    'HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.malesan.bridge',
    'HKCU:\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.malesan.bridge',
    'HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\com.malesan.bridge',
    'HKCU:\Software\Chromium\NativeMessagingHosts\com.malesan.bridge',
    'HKCU:\Software\Vivaldi\NativeMessagingHosts\com.malesan.bridge'
  )
  foreach ($p in $RegPaths) {
    New-Item -Path $p -Force | Out-Null
    Set-ItemProperty -Path $p -Name '(default)' -Value $ManifestPath
  }
  Write-Host 'Malesan Bridge terpasang untuk Chrome, Brave, Edge, & Chromium! Restart browser lo untuk mulai pakai.' -ForegroundColor Green
} finally { Remove-Item $Temp -Recurse -Force -ErrorAction SilentlyContinue }
