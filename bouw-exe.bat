@echo off
chcp 65001 >nul
echo Programma wordt gemaakt. Dit duurt enkele minuten...
where node >nul 2>nul || (echo Node.js ontbreekt. Installeer de LTS-versie van https://nodejs.org en start dit bestand opnieuw. & pause & exit /b 1)
call npm install || (echo npm install is mislukt & pause & exit /b 1)
call npm run dist || (echo Bouwen is mislukt & pause & exit /b 1)
echo.
echo Klaar. Het programma staat in de map dist: HAP-Berichtsjablonen.exe
start "" dist
pause
