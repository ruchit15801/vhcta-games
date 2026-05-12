# A23Games - Air Battle Mission COMPLETE Recovery Script
$base = "https://play11.apkdownloads.net/games/airbattlemission"
$projectRoot = "c:\Users\princ\Downloads\game-portal"
$gameDest = "$projectRoot\games\airbattlemission"
$thumbDest = "$projectRoot\assets\thumbs"

Write-Host "--- A23Games Asset Downloader (v2.1) ---" -ForegroundColor Cyan

# 1. Ensure Directories
New-Item -ItemType Directory -Path "$gameDest\images" -Force | Out-Null
New-Item -ItemType Directory -Path "$gameDest\media" -Force | Out-Null
New-Item -ItemType Directory -Path "$thumbDest" -Force | Out-Null

# 2. Download Core Files (Mandatory)
$coreFiles = @("data.js", "icon-256.png", "jquery-2.1.1.min.js", "c2runtime.js")
foreach ($f in $coreFiles) {
    Write-Host "Downloading core file: $f..."
    try { 
        Invoke-WebRequest -Uri "$base/$f" -OutFile "$gameDest\$f" -UseBasicParsing -ErrorAction Stop
        Write-Host "  OK" -ForegroundColor Green
    } catch { 
        Write-Host "  FAILED: $f is missing on source!" -ForegroundColor Red 
    }
}

# 2b. Download Optional Core Files (May not exist on all servers)
$optFiles = @("sw.js", "offline.json")
foreach ($f in $optFiles) {
    Write-Host "Checking optional file: $f..."
    try { 
        Invoke-WebRequest -Uri "$base/$f" -OutFile "$gameDest\$f" -UseBasicParsing -ErrorAction SilentlyContinue
        Write-Host "  OK (Found)" -ForegroundColor Gray
    } catch {
        Write-Host "  Skipped (Not found, but game will still run)" -ForegroundColor DarkGray
    }
}

# 3. Download Thumbnail for Gallery
Write-Host "Downloading Gallery Thumbnail..."
try { 
    Invoke-WebRequest -Uri "$base/icon-256.png" -OutFile "$thumbDest\airbattle.png" -UseBasicParsing
    Write-Host "  Success: Created assets/thumbs/airbattle.png" -ForegroundColor Green
} catch {}

# 4. Download Graphics (Complete List)
$images = @(
    "btnmusic-sheet0.png","btnmusic-sheet1.png","btnsound-sheet0.png","btnsound-sheet1.png",
    "background1-sheet0.png","btnplay-sheet0.png","sunlight-sheet0.png","loadingfont.png",
    "btnrestart-sheet0.png","btnpause-sheet0.png","btnpause-sheet1.png","cursor-sheet0.png",
    "cursorhover-sheet0.png","player-sheet0.png","player-sheet1.png","player-sheet2.png",
    "enemy1-sheet0.png","enemy1-sheet1.png","enemy1-sheet2.png","enemy2-sheet0.png",
    "enemy2-sheet1.png","enemy2-sheet2.png","enemy3-sheet0.png","enemy3-sheet1.png",
    "enemy4-sheet0.png","enemy4-sheet1.png","enemy5-sheet0.png","enemy5-sheet1.png","enemy5-sheet2.png",
    "enemy6-sheet0.png","enemy6-sheet1.png","enemy6-sheet2.png",
    "rocket-sheet0.png","explosion-sheet0.png","explosion-sheet1.png","cloud1-sheet0.png",
    "cloud2-sheet0.png","cloud3-sheet0.png","cloud4-sheet0.png","collision-sheet0.png",
    "star-sheet0.png","score100-sheet0.png","score125-sheet0.png","score250-sheet0.png",
    "score500-sheet0.png","joystick-sheet0.png","joystickbase-sheet0.png","joystickstick-sheet0.png",
    "joystickarea-sheet0.png","playercollision-sheet0.png","background2-sheet0.png",
    "backgroundsback.png","frame-sheet0.png","addammo-sheet0.png","addfuel-sheet0.png",
    "addlife-sheet0.png","addrocket-sheet0.png","ammobar-sheet0.png","fuelbar-sheet0.png",
    "lifebar-sheet0.png","rocketbar-sheet0.png","barbackground-sheet0.png","lifebarline-sheet0.png",
    "ammobarline-sheet0.png","fuelbarline-sheet0.png","rocketbarline-sheet0.png","bullet-sheet0.png",
    "enemy1menu-sheet0.png","enemy2menu-sheet0.png","enemy3menu-sheet0.png","gamelogo-sheet0.png",
    "arrowup-sheet0.png","arrowdown-sheet0.png","arrowleft-sheet0.png","arrowright-sheet0.png"
)

foreach ($img in $images) {
    Write-Host "Downloading images/$img..."
    try { Invoke-WebRequest -Uri "$base/images/$img" -OutFile "$gameDest\images\$img" -UseBasicParsing -ErrorAction SilentlyContinue } catch {}
}

# 5. Download Sound Effects & Music
$media = @(
    "explosion1.ogg","explosion2.ogg","explosion3.ogg","gamemusic.ogg","shoot.ogg",
    "explosion1.m4a","explosion2.m4a","explosion3.m4a","gamemusic.m4a","shoot.m4a"
)

foreach ($m in $media) {
    Write-Host "Downloading media/$m..."
    try { Invoke-WebRequest -Uri "$base/media/$m" -OutFile "$gameDest\media\$m" -UseBasicParsing -ErrorAction SilentlyContinue } catch {}
}

Write-Host "`nAll assets retrieved! Run this script, then push to Git." -ForegroundColor Green
