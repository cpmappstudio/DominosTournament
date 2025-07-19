# Configuración de Firebase Storage para Imágenes de Perfil

## ⚠️ ERROR ACTUAL: Storage no habilitado

El error de CORS que estás viendo indica que Firebase Storage no está habilitado en tu proyecto. **DEBES seguir estos pasos para solucionarlo:**

## 🚀 Pasos OBLIGATORIOS para Habilitar Firebase Storage:

### 1. Acceder a Firebase Console
1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto `domino-federation`

### 2. **CRÍTICO**: Habilitar Firebase Storage
1. En el menú lateral, busca y haz clic en **"Storage"**
2. Si ves un botón **"Get started"** o **"Comenzar"**, haz clic en él
3. Selecciona tu región (recomendado: `us-central1` o tu región más cercana)
4. Acepta los términos y condiciones
5. Haz clic en **"Done"** cuando termine la configuración

### 3. Configurar Reglas de Seguridad
Una vez habilitado Storage, ve a la pestaña **"Rules"** y reemplaza el contenido con:

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    // Profile images - users can only read all images and write/delete their own
    match /profile-images/{userId} {
      // Allow all authenticated users to read profile images
      allow read: if request.auth != null;
      
      // Allow users to upload/update/delete only their own profile image
      allow write, delete: if request.auth != null 
                           && request.auth.uid == userId
                           && isValidImageUpload();
    }
  }
}

// Helper function to validate image uploads
function isValidImageUpload() {
  return request.resource != null
         && request.resource.size < 5 * 1024 * 1024  // 5MB max
         && request.resource.contentType.matches('image/.*');  // Only image files
}
```

4. Haz clic en **"Publish"** para aplicar las reglas

### 4. Verificar que Storage esté Funcionando
1. En la pestaña **"Files"**, deberías ver un bucket vacío
2. Si ves la interfaz de archivos, Storage está correctamente habilitado

## 🔄 Después de Habilitar Storage:

1. **Reinicia el servidor de desarrollo:**
   ```bash
   npm run dev
   ```

2. **Prueba la funcionalidad de cambio de imagen**

## 🚨 Si el Error Persiste:

### Opción A: Verificar configuración del bucket
Asegúrate de que el `storageBucket` en tu configuración de Firebase coincida:
```
storageBucket: "domino-federation.firebasestorage.app"
```

### Opción B: Usar reglas más permisivas temporalmente (solo para testing)
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## ✅ Funcionalidades Implementadas:

### 🖼️ Subir Imagen de Perfil
- Haz clic en la foto de perfil
- Selecciona una imagen (máx. 5MB)
- La imagen se sube automáticamente a Firebase Storage
- Se actualiza el perfil de Firebase Auth y Firestore

### 🗑️ Eliminar Imagen de Perfil
- Haz hover sobre la foto de perfil
- Haz clic en el ícono de basura (trash)
- La imagen se elimina de Storage y se actualiza el perfil

### 🔄 Validaciones
- Solo archivos de imagen permitidos
- Tamaño máximo: 5MB
- Mensajes de error claros
- Loading state durante la subida

## 💰 Costos Estimados (300-400 usuarios):

- **Almacenamiento**: ~$0.005 USD/mes
- **Transferencia**: Mínima (imágenes se cachean)
- **Operaciones**: ~$0.01 USD/mes

**Total estimado: < $1 USD/mes**

## 🔒 Seguridad:

- ✅ Usuarios solo pueden modificar su propia imagen
- ✅ Validación de tipo de archivo
- ✅ Límite de tamaño
- ✅ URLs de descarga seguras con autenticación
- ✅ Eliminación automática de imágenes huérfanas

## 📁 Estructura de Archivos en Storage:

```
profile-images/
├── user_uid_1
├── user_uid_2
└── user_uid_3
```

Cada usuario tendrá máximo 1 imagen en: `profile-images/{user_uid}`

## 🎯 Próximos Pasos:

1. **OBLIGATORIO**: Habilitar Firebase Storage en Console
2. Configurar las reglas de seguridad
3. Reiniciar el servidor de desarrollo
4. Probar la funcionalidad

**El error desaparecerá completamente una vez que habilites Storage en Firebase Console.**
