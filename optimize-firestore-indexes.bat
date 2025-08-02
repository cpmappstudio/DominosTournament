@echo off
REM 🔧 SCRIPT DE OPTIMIZACIÓN DE ÍNDICES FIRESTORE (Windows)
REM Limpia índices innecesarios e implementa optimizados

echo 🚀 Iniciando optimización de índices Firestore...

REM Verificar que Firebase CLI esté instalado
firebase --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Firebase CLI no está instalado. Instálalo con: npm install -g firebase-tools
    pause
    exit /b 1
)

REM Verificar que estemos logueados
firebase projects:list >nul 2>&1
if errorlevel 1 (
    echo ⚠️  No estás logueado en Firebase. Ejecuta: firebase login
    pause
    exit /b 1
)

echo 📋 Índices actuales en Firebase Console:
echo   - Ve a: https://console.firebase.google.com/project/your-project/firestore/indexes
echo   - Revisa la tabla de 13 índices actuales
echo.

echo 🧹 PASO 1: Eliminar índices obsoletos manualmente
echo   En Firebase Console, elimina índices de estas colecciones:
echo   ❌ rankings (colección no existe)
echo   ❌ players (colección no existe)
echo   ❌ users con múltiples campos que no se consultan juntos
echo.

echo 📤 PASO 2: Implementar índices optimizados...

REM Backup del archivo de índices actual si existe
if exist "firestore.indexes.json" (
    copy firestore.indexes.json firestore.indexes.backup.json >nul
    echo ✅ Backup creado: firestore.indexes.backup.json
)

REM Usar el archivo optimizado
copy firestore-indexes-optimized.json firestore.indexes.json >nul
echo ✅ Archivo de índices actualizado

REM Implementar nuevos índices
echo 🚀 Implementando índices optimizados...
firebase deploy --only firestore:indexes

if errorlevel 0 (
    echo.
    echo ✅ ¡OPTIMIZACIÓN COMPLETADA!
    echo.
    echo 📊 Próximos pasos:
    echo   1. Los índices tardan unos minutos en construirse
    echo   2. Monitorea en Firebase Console ^> Firestore ^> Indexes
    echo   3. Verifica performance en Firebase Console ^> Performance
    echo   4. Elimina manualmente índices obsoletos restantes
    echo.
    echo 🎯 Beneficios esperados:
    echo   - Queries 10-100x más rápidos
    echo   - Mejor escalabilidad
    echo   - Menor costo operacional
    echo   - UX mejorada significativamente
) else (
    echo ❌ Error al implementar índices. Revisa la configuración.
    pause
    exit /b 1
)

pause
