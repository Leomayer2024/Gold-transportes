@echo off
echo =================================
echo  Build Automatico - SEG
echo =================================
echo.

cd frontend
echo [1/3] Instalando dependencias...
call npm install

echo.
echo [2/3] Compilando frontend...
call npm run build

echo.
echo [3/3] Concluido!
echo.
echo Pasta criada: frontend\dist\
echo.
pause
