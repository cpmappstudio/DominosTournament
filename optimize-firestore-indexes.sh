#!/bin/bash

# 🔧 SCRIPT DE OPTIMIZACIÓN DE ÍNDICES FIRESTORE
# Limpia índices innecesarios e implementa optimizados

echo "🚀 Iniciando optimización de índices Firestore..."

# Verificar que Firebase CLI esté instalado
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI no está instalado. Instálalo con: npm install -g firebase-tools"
    exit 1
fi

# Verificar que estemos logueados
if ! firebase projects:list &> /dev/null; then
    echo "⚠️  No estás logueado en Firebase. Ejecuta: firebase login"
    exit 1
fi

echo "📋 Índices actuales en Firebase Console:"
echo "  - Ve a: https://console.firebase.google.com/project/your-project/firestore/indexes"
echo "  - Revisa la tabla de 13 índices actuales"
echo ""

echo "🧹 PASO 1: Eliminar índices obsoletos manualmente"
echo "  En Firebase Console, elimina índices de estas colecciones:"
echo "  ❌ rankings (colección no existe)"
echo "  ❌ players (colección no existe)" 
echo "  ❌ users con múltiples campos que no se consultan juntos"
echo ""

echo "📤 PASO 2: Implementar índices optimizados..."

# Backup del archivo de índices actual si existe
if [ -f "firestore.indexes.json" ]; then
    cp firestore.indexes.json firestore.indexes.backup.json
    echo "✅ Backup creado: firestore.indexes.backup.json"
fi

# Usar el archivo optimizado
cp firestore-indexes-optimized.json firestore.indexes.json
echo "✅ Archivo de índices actualizado"

# Implementar nuevos índices
echo "🚀 Implementando índices optimizados..."
firebase deploy --only firestore:indexes

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ ¡OPTIMIZACIÓN COMPLETADA!"
    echo ""
    echo "📊 Próximos pasos:"
    echo "  1. Los índices tardan unos minutos en construirse"
    echo "  2. Monitorea en Firebase Console > Firestore > Indexes"
    echo "  3. Verifica performance en Firebase Console > Performance"
    echo "  4. Elimina manualmente índices obsoletos restantes"
    echo ""
    echo "🎯 Beneficios esperados:"
    echo "  - Queries 10-100x más rápidos"
    echo "  - Mejor escalabilidad"
    echo "  - Menor costo operacional"
    echo "  - UX mejorada significativamente"
else
    echo "❌ Error al implementar índices. Revisa la configuración."
    exit 1
fi
