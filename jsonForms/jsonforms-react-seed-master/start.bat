@echo off
REM Pfad zum Projekt
set PROJ=C:\Users\noura\Documents\BachelorArbeit1\jsonForms\jsonforms-react-seed-master

cd /d %PROJ%

echo === Alte Container (falls vorhanden) entfernen ===
podman rm -f my-frontend my-backend 2>nul

echo === Starte Backend in neuem Fenster ===
start "backend" cmd /k "cd /d %PROJ% && podman run --name my-backend -p 5050:5050 my-node-react npx nodemon jfs-server.js  "

echo === Starte Frontend in neuem Fenster ===
start "frontend" cmd /k "cd /d %PROJ% && podman run --name my-frontend -p 3000:3000 my-node-react npm run dev -- --host 0.0.0.0"

echo.
echo Es wurden zwei neue Fenster geoeffnet:
echo   - eins fuer Backend (Port 5050)
echo   - eins fuer Frontend (Port 3000)
echo.
echo Frontend:  http://localhost:3000
echo Backend:   http://localhost:5050
echo.
pause
