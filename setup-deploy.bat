@echo off
REM 🚀 One-Click Deploy Setup for USA Domino Federation
REM Este script automatiza la configuración inicial para GitHub Pages

echo 🎯 Configurando deploy para GitHub Pages...

REM 1. Verificar dependencias
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Error: npm no está instalado
    pause
    exit /b 1
)

where git >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Error: git no está instalado
    pause
    exit /b 1
)

echo ✅ Dependencias verificadas

REM 2. Instalar gh-pages si no existe
npm list gh-pages --depth=0 >nul 2>nul
if %errorlevel% neq 0 (
    echo 📦 Instalando gh-pages...
    npm install --save-dev gh-pages --legacy-peer-deps
)

REM 3. Build de prueba
echo 🔨 Probando build de producción...
npm run build

if %errorlevel% neq 0 (
    echo ❌ Error en el build. Revisa los errores y vuelve a intentar.
    pause
    exit /b 1
)

echo ✅ Build exitoso

REM 4. Deploy manual (opcional)
set /p deploy="¿Quieres hacer un deploy manual ahora? (y/N): "
if /i "%deploy%"=="y" (
    echo 🚀 Desplegando a GitHub Pages...
    npm run deploy
)

echo.
echo 🎉 ¡Configuración completada!
echo.
echo 📋 PRÓXIMOS PASOS:
echo 1. Configura los secrets en GitHub:
echo    - Ve a Settings → Secrets and variables → Actions
echo    - Agrega todas las variables VITE_FIREBASE_*
echo.
echo 2. Configura GitHub Pages:
echo    - Ve a Settings → Pages
echo    - Selecciona 'GitHub Actions' como source
echo.
echo 3. Haz push a main para deploy automático:
echo    git add .
echo    git commit -m "Setup GitHub Pages deployment"
echo    git push origin main
echo.
echo 🌐 Tu app estará disponible en:
echo    https://TU_USUARIO.github.io/DominosTournament/
echo.
pause
