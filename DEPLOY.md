# 🚀 Deploy Guide - USA Domino Federation

Esta guía te ayudará a desplegar la aplicación en GitHub Pages.

## 📋 Prerrequisitos

1. ✅ Firebase project configurado y funcionando
2. ✅ Square payment integration configurada  
3. ✅ Repositorio en GitHub
4. ✅ Node.js 18+ instalado

## 🔧 Configuración GitHub Pages

### 1. Configurar GitHub Repository

1. Ve a tu repositorio en GitHub
2. Ir a **Settings** → **Pages**
3. En **Source** selecciona **GitHub Actions**

### 2. Configurar Variables de Entorno (Secrets)

Ve a **Settings** → **Secrets and variables** → **Actions** y agrega:

#### Repository Secrets (obligatorios):
```
VITE_FIREBASE_API_KEY=tu_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto-id
VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_messaging_sender_id
VITE_FIREBASE_APP_ID=tu_firebase_app_id
VITE_FIREBASE_MEASUREMENT_ID=tu_measurement_id
```

#### Repository Variables (opcional):
```
VITE_MAX_QUERY_LIMIT=50
VITE_ENABLE_ANALYTICS=true
```

### 3. Firebase Security Rules

Asegúrate de que tu Firebase project permita requests desde el dominio de GitHub Pages:

```javascript
// Firestore Security Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Tus reglas existentes...
  }
}
```

En Firebase Console → Authentication → Settings → Authorized domains:
- Agrega: `tu-usuario.github.io`

## 🚢 Despliegue

### Automático (Recomendado)
Simplemente haz push a la rama `main` o `master`:

```bash
git add .
git commit -m "Deploy to production"
git push origin main
```

El GitHub Action se ejecutará automáticamente y desplegará la app.

### Manual
```bash
npm run deploy
```

## 🌐 URL de Producción

Después del despliegue, tu app estará disponible en:
```
https://tu-usuario.github.io/DominosTournament/
```

## ✅ Verificación Post-Deploy

1. **Authentication**: Prueba login con Google
2. **Firebase Connection**: Verifica que los datos se cargan
3. **Square Payments**: Confirma que los pagos funcionan  
4. **Routing**: Navega por todas las páginas
5. **Responsive**: Prueba en móvil y desktop

## 🛠️ Troubleshooting

### Error: "Firebase API key not found"
- Verifica que todos los secrets estén configurados en GitHub
- Confirma que los nombres de las variables coincidan exactamente

### Error: "404 on page refresh"
- ✅ Ya configurado: El archivo `404.html` maneja SPA routing

### Error: "CORS Firebase"
- Agrega el dominio de GitHub Pages a Firebase authorized domains

### Error: "Build fails"
- Revisa los logs en GitHub Actions
- Verifica que todas las dependencias se instalen correctamente

## 📊 Monitoreo

### GitHub Actions
- Ve a **Actions** tab en tu repo para ver el estado de los deploys
- Los builds toman ~3-5 minutos

### Firebase Analytics
- Configura Firebase Analytics para monitorear el uso
- Los eventos se trackean automáticamente

## 🔄 Actualizaciones

Para futuras actualizaciones:

1. Desarrolla en rama `development`
2. Prueba localmente
3. Merge a `main`
4. El deploy es automático

## 📱 Custom Domain (Opcional)

Si tienes un dominio personalizado:

1. Crea archivo `CNAME` en `/public/` con tu dominio
2. Configura DNS records en tu proveedor
3. Actualiza Firebase authorized domains

## 🔒 Seguridad

- ✅ Variables sensibles en GitHub Secrets
- ✅ Firebase rules configuradas  
- ✅ HTTPS enabled by default
- ✅ Square production credentials

## 📞 Soporte

Si encuentras problemas:
1. Revisa los logs de GitHub Actions
2. Verifica la configuración de Firebase
3. Confirma que Square esté en modo producción
