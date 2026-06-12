@echo off
title KOURTI - Deploiement Netlify
cd /d "%~dp0"
echo.
echo  ================================
echo    KOURTI - Deploiement Netlify
echo  ================================
echo.
echo  Construction du projet...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo  ERREUR lors du build !
    pause
    exit /b 1
)
echo.
echo  Deploiement en ligne...
call netlify deploy --prod --dir=dist
echo.
echo  ================================
echo    Deploiement termine !
echo  ================================
pause
