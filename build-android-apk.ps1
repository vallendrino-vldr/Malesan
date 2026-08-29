$ErrorActionPreference = "Stop"

$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot"
$env:PATH = "$env:JAVA_HOME\bin;" + $env:PATH

$AndroidSdk = "C:\Users\Administrator\AppData\Local\Android\Sdk"
$BuildTools = Join-Path $AndroidSdk "build-tools\36.0.0"
$PlatformJar = Join-Path $AndroidSdk "platforms\android-35\android.jar"
$JavaBin = "$env:JAVA_HOME\bin"
$Javac = Join-Path $JavaBin "javac.exe"
$Jar = Join-Path $JavaBin "jar.exe"

$Aapt2 = Join-Path $BuildTools "aapt2.exe"
$D8 = Join-Path $BuildTools "d8.bat"
$Zipalign = Join-Path $BuildTools "zipalign.exe"
$Apksigner = Join-Path $BuildTools "apksigner.bat"

$Keystore = "android\keystore\malesan-release.keystore"
$StorePass = "malesan2026pro"
$KeyPass = "malesan2026pro"
$Alias = "malesan"

$Work = "android\build"
if (Test-Path $Work) { Remove-Item $Work -Recurse -Force }
New-Item -ItemType Directory -Force $Work, "$Work\compiled_res", "$Work\classes", "$Work\gen" | Out-Null

Write-Host "[1/6] Compiling Android resources with AAPT2..." -ForegroundColor Cyan
& $Aapt2 compile --dir "android\app\src\main\res" -o "$Work\compiled_res.zip"

Write-Host "[2/6] Linking Android resources & generating R.java..." -ForegroundColor Cyan
& $Aapt2 link `
    -I $PlatformJar `
    --manifest "android\app\src\main\AndroidManifest.xml" `
    --java "$Work\gen" `
    -o "$Work\base.apk" `
    "$Work\compiled_res.zip"

Write-Host "[3/6] Compiling Java classes with javac..." -ForegroundColor Cyan
$JavaSources = Get-ChildItem -Path "android\app\src\main\java", "$Work\gen" -Filter "*.java" -Recurse | Select-Object -ExpandProperty FullName
& $Javac -encoding UTF-8 `
    -cp $PlatformJar `
    -d "$Work\classes" `
    --release 8 `
    $JavaSources

Write-Host "[4/6] Converting classes to DEX with D8..." -ForegroundColor Cyan
$ClassFiles = Get-ChildItem -Path "$Work\classes" -Filter "*.class" -Recurse | Select-Object -ExpandProperty FullName
& cmd.exe /c "$D8 --lib $PlatformJar --output $Work $ClassFiles"

Write-Host "[5/6] Adding classes.dex to APK package..." -ForegroundColor Cyan
Push-Location $Work
& $Jar uf "base.apk" "classes.dex"
Pop-Location

Write-Host "[6/6] Zipalign and signing APK with V2+V3 Keystore..." -ForegroundColor Cyan
$AlignedApk = "$Work\malesan-aligned.apk"
& $Zipalign -f -p 4 "$Work\base.apk" $AlignedApk

$FinalApk = "public\malesan.apk"
& cmd.exe /c "$Apksigner sign --ks $Keystore --ks-pass pass:$StorePass --key-pass pass:$KeyPass --ks-key-alias $Alias --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true --out $FinalApk $AlignedApk"

Write-Host "Verifying APK Signature..." -ForegroundColor Cyan
& cmd.exe /c "$Apksigner verify --verbose $FinalApk"

$ApkSize = (Get-Item $FinalApk).Length / 1MB
Write-Host "=====================================================" -ForegroundColor Green
Write-Host "✅ MALESAN STANDALONE ANDROID APK BUILD SUCCESSFUL!" -ForegroundColor Green
Write-Host "📦 Output: $FinalApk ($([math]::Round($ApkSize, 2)) MB)" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
