@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM ============================================================================
REM Konfiguration
REM ============================================================================
set "PROJ=C:\Users\noura\Documents\BachelorArbeit1\jsonForms\jsonforms-react-seed-master"
set "IMAGE=my-node-react"
set "FRONT=my-frontend"
set "BACK=my-backend"
set "CF=Containerfile"

REM Backend-Entry liegt im Projekt-Root
set "BACKEND_ENTRY=jfs-server.js"

REM Persistente Daten auf dem Host (JSON-Dateien)
set "DATAHOST=%PROJ%\data"

cd /d "%PROJ%" || (
  echo [FEHLER] Projektpfad nicht gefunden: "%PROJ%"
  pause
  exit /b 1
)

echo ============================================================================
echo 0) Voraussetzung pruefen
echo ============================================================================
if not exist "%CF%" (
  echo [FEHLER] "%CF%" nicht gefunden in "%PROJ%"
  pause
  exit /b 1
)

if not exist "%BACKEND_ENTRY%" (
  echo [FEHLER] Backend-Entry nicht gefunden: "%BACKEND_ENTRY%"
  pause
  exit /b 1
)

echo ============================================================================
echo 1) Datenordner vorbereiten (persistente Writes)
echo ============================================================================
if not exist "%DATAHOST%" mkdir "%DATAHOST%" 2>nul
if not exist "%DATAHOST%\Zuarbeit" mkdir "%DATAHOST%\Zuarbeit" 2>nul
if not exist "%DATAHOST%\Dozenten" mkdir "%DATAHOST%\Dozenten" 2>nul

echo ============================================================================
echo 2) Alte Container entfernen
echo ============================================================================
podman rm -f "%FRONT%" "%BACK%" 2>nul

echo ============================================================================
echo 3) Image neu bauen (ohne Cache, damit Code sicher aktuell ist)
echo ============================================================================
podman build --no-cache -t "%IMAGE%" -f "%CF%" .

if errorlevel 1 (
  echo [FEHLER] Build fehlgeschlagen.
  pause
  exit /b 1
)

echo ============================================================================
echo 4) Backend starten (DATA_ROOT=/app/data + Volume Mount)
echo ============================================================================
start "backend" cmd /k ^
  "cd /d ""%PROJ%"" && podman run --pull=never --name ""%BACK%"" -p 5050:5050 -e DATA_ROOT=/app/data -v ""%DATAHOST%:/app/data"" ""%IMAGE%"" npx nodemon ""%BACKEND_ENTRY%"""

echo ============================================================================
echo 5) Frontend starten
echo ============================================================================
start "frontend" cmd /k ^
  "cd /d ""%PROJ%"" && podman run --pull=never --name ""%FRONT%"" -p 3000:3000 ""%IMAGE%"" npm run dev -- --host 0.0.0.0 --port 3000"

echo.
echo ============================================================================
echo Frontend:       http://localhost:3000
echo Backend:        http://localhost:5050
echo Backend Health: http://localhost:5050/__health  (falls du das im Server hast)
echo ============================================================================
echo.

pause
endlocal
