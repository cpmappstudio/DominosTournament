#!/bin/bash

# 🚀 One-Click Deploy Setup for USA Domino Federation
# Este script automatiza la configuración inicial para GitHub Pages

echo "🎯 Configurando deploy para GitHub Pages..."

# 1. Verificar dependencias
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm no está instalado"
    exit 1
fi

if ! command -v git &> /dev/null; then
    echo "❌ Error: git no está instalado"
    exit 1
fi

echo "✅ Dependencias verificadas"

# 2. Instalar gh-pages si no existe
if ! npm list gh-pages --depth=0 &> /dev/null; then
    echo "📦 Instalando gh-pages..."
    npm install --save-dev gh-pages --legacy-peer-deps
fi

# 3. Build de prueba
echo "🔨 Probando build de producción..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Error en el build. Revisa los errores y vuelve a intentar."
    exit 1
fi

echo "✅ Build exitoso"

# 4. Deploy manual (opcional)
read -p "¿Quieres hacer un deploy manual ahora? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Desplegando a GitHub Pages..."
    npm run deploy
fi

echo ""
echo "🎉 ¡Configuración completada!"
echo ""
echo "📋 PRÓXIMOS PASOS:"
echo "1. Configura los secrets en GitHub:"
echo "   - Ve a Settings → Secrets and variables → Actions"
echo "   - Agrega todas las variables VITE_FIREBASE_*"
echo ""
echo "2. Configura GitHub Pages:"
echo "   - Ve a Settings → Pages"
echo "   - Selecciona 'GitHub Actions' como source"
echo ""
echo "3. Haz push a main para deploy automático:"
echo "   git add ."
echo "   git commit -m 'Setup GitHub Pages deployment'"
echo "   git push origin main"
echo ""
echo "🌐 Tu app estará disponible en:"
echo "   https://TU_USUARIO.github.io/DominosTournament/"
echo ""
