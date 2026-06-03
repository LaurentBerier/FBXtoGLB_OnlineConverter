# =============================================================================
#  Sandscape · FBX <-> GLB Converter — one-shot setup (Windows)
#
#  Installs everything a fresh machine needs to run the app:
#    1. Node.js 20+            (via winget: OpenJS.NodeJS.LTS)
#    2. Blender 3.6+           (via winget: BlenderFoundation.Blender)
#    3. FBX2glTF (optional)    (downloaded to apps\api\bin — fallback engine)
#    4. JS dependencies        (npm install — also applies patch-package patches)
#    5. Local env files        (apps\api\.env, apps\web\.env.local)
#    6. Verifies with doctor
#
#  Blender drives BOTH conversion directions, so it's the only required engine.
#  Re-running this script is safe.
#
#  Usage:   double-click setup.bat,  OR  from PowerShell:
#           powershell -ExecutionPolicy Bypass -File setup.ps1
# =============================================================================
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Step($m){ Write-Host "`n==> $m" -ForegroundColor Cyan }
function Ok($m){ Write-Host "  [ok] $m" -ForegroundColor Green }
function Warn($m){ Write-Host "  [!] $m" -ForegroundColor Yellow }
function Die($m){ Write-Host "  [x] $m" -ForegroundColor Red; Read-Host 'Press Enter to exit'; exit 1 }
function Have($n){ [bool](Get-Command $n -ErrorAction SilentlyContinue) }
function Refresh-Path {
  $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' +
              [Environment]::GetEnvironmentVariable('Path','User')
}

Write-Host "Sandscape FBX <-> GLB Converter - setup (Windows)" -ForegroundColor White

# --------------------------------------------------------------------------
# 1. Node.js 20+
# --------------------------------------------------------------------------
Step 'Checking Node.js (need 20+)'
function NodeOk {
  if (-not (Have node)) { return $false }
  try { return ([int](node -p "process.versions.node.split('.')[0]")) -ge 20 } catch { return $false }
}
if (NodeOk) {
  Ok "Node $(node -v) already installed"
} else {
  Warn 'Node 20+ not found - installing via winget'
  if (Have winget) {
    winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    Refresh-Path
  } else {
    Die 'winget is unavailable. Install Node 20+ from https://nodejs.org/ (LTS), reopen the terminal, and re-run.'
  }
  if (-not (NodeOk)) { Die 'Node still not detected. Close and reopen the terminal (to refresh PATH) and re-run setup.' }
  Ok "Node $(node -v) installed"
}

# --------------------------------------------------------------------------
# 2. Blender (required - drives both FBX->GLB and GLB->FBX)
# --------------------------------------------------------------------------
Step 'Checking Blender (need 3.6+)'
function BlenderFound {
  if ($env:BLENDER_PATH -and (Test-Path $env:BLENDER_PATH)) { return $true }
  if (Have blender) { return $true }
  foreach ($base in @($env:ProgramW6432, $env:ProgramFiles, ${env:ProgramFiles(x86)}, 'C:\Program Files')) {
    if (-not $base) { continue }
    $dir = Join-Path $base 'Blender Foundation'
    if (Test-Path $dir) {
      foreach ($d in Get-ChildItem $dir -Directory -ErrorAction SilentlyContinue) {
        if (Test-Path (Join-Path $d.FullName 'blender.exe')) { return $true }
      }
    }
  }
  return $false
}
if (BlenderFound) {
  Ok 'Blender found'
} else {
  Warn 'Blender not found - installing via winget'
  if (Have winget) {
    winget install -e --id BlenderFoundation.Blender --accept-source-agreements --accept-package-agreements
    Refresh-Path
  } else {
    Warn 'winget unavailable. Install Blender 3.6+ from https://www.blender.org/download/ then re-run.'
  }
  if (BlenderFound) { Ok 'Blender installed' }
  else { Warn 'Blender still not detected (a fresh terminal may be needed). Conversions require it.' }
}

# --------------------------------------------------------------------------
# 3. FBX2glTF — optional fallback engine for FBX->GLB
# --------------------------------------------------------------------------
Step 'Fetching optional FBX2glTF fallback (best-effort)'
$binDir = Join-Path $PSScriptRoot 'apps\api\bin'
$fbxExe = Join-Path $binDir 'FBX2glTF.exe'
if (Test-Path $fbxExe) {
  Ok 'FBX2glTF.exe already present'
} else {
  try {
    New-Item -ItemType Directory -Force -Path $binDir | Out-Null
    $url = 'https://github.com/godotengine/FBX2glTF/releases/download/v0.13.1/FBX2glTF-windows-x64.exe'
    Invoke-WebRequest -Uri $url -OutFile $fbxExe -UseBasicParsing
    Ok 'Downloaded FBX2glTF.exe (fallback engine)'
  } catch {
    Warn "Could not download FBX2glTF (optional) - skipping. Blender covers FBX->GLB anyway."
  }
}

# --------------------------------------------------------------------------
# 4. JS dependencies
# --------------------------------------------------------------------------
Step 'Installing JavaScript dependencies (npm install)'
npm install
Ok 'Dependencies installed'

# --------------------------------------------------------------------------
# 5. Local env files (engine paths left blank => auto-detected)
# --------------------------------------------------------------------------
Step 'Seeding local config'
if (-not (Test-Path 'apps\api\.env')) { Copy-Item '.env.example' 'apps\api\.env'; Ok 'Created apps\api\.env' } else { Ok 'apps\api\.env already exists' }
if (-not (Test-Path 'apps\web\.env.local')) { Copy-Item 'apps\web\.env.local.example' 'apps\web\.env.local'; Ok 'Created apps\web\.env.local' } else { Ok 'apps\web\.env.local already exists' }

# --------------------------------------------------------------------------
# 6. Verify
# --------------------------------------------------------------------------
Step 'Verifying engines (npm run doctor)'
try { npm run doctor } catch { Warn 'doctor reported a problem - set BLENDER_PATH in apps\api\.env if Blender was not detected.' }

Write-Host "`nSetup complete." -ForegroundColor Green
Write-Host "Start the app with:  npm run dev   (or double-click start.bat)" -ForegroundColor White
Write-Host "Then open:           http://localhost:3000`n" -ForegroundColor White
