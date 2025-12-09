# Instrucciones de Prueba - Aplicación Refactorizada

## Estructura del Proyecto

La aplicación ha sido refactorizada con la siguiente estructura:

```
app-donde-hay/
├── css/
│   └── styles.css          # Todos los estilos CSS de la aplicación
├── js/
│   ├── main.js            # Toda la lógica JavaScript de la aplicación
│   ├── material-all.js     # Componentes de Material 3 Web Components
│   └── material-styles.js  # Estilos de tipografía de Material 3
├── index.html             # HTML principal con Material 3 components
├── supabase.js            # Cliente de Supabase
└── app.html               # Archivo original (mantenido para referencia)
```

## Cambios Implementados

### 1. Estructura de Carpetas
- ✅ Creadas carpetas `css/` y `js/`
- ✅ Movidos archivos de Material 3 a `js/`

### 2. Separación de Código
- ✅ CSS extraído a `css/styles.css`
- ✅ JavaScript extraído a `js/main.js`

### 3. Material 3 Web Components
- ✅ Implementados en `index.html`:
  - `<md-outlined-text-field>` para campos de texto
  - `<md-filled-button>` para botones primarios
  - `<md-text-button>` para botones secundarios

### 4. Tipografía Material 3
- ✅ Clases aplicadas en todo el código:
  - `md-typescale-headline-medium` - Títulos principales
  - `md-typescale-title-large` - Títulos de páginas
  - `md-typescale-title-medium` - Subtítulos
  - `md-typescale-body-large` - Texto de cuerpo grande
  - `md-typescale-body-medium` - Texto de cuerpo medio
  - `md-typescale-body-small` - Texto de cuerpo pequeño
  - `md-typescale-label-medium` - Etiquetas
  - `md-typescale-label-small` - Etiquetas pequeñas

## Cómo Probar

### Opción 1: Servidor HTTP Simple (Python)

```bash
# En la raíz del proyecto
python3 -m http.server 8000
```

Luego abre en tu navegador: `http://localhost:8000/index.html`

### Opción 2: Servidor HTTP Simple (Node.js)

```bash
# Instalar http-server globalmente (solo una vez)
npm install -g http-server

# En la raíz del proyecto
http-server -p 8000
```

Luego abre en tu navegador: `http://localhost:8000/index.html`

### Opción 3: Live Server (VS Code)

1. Instala la extensión "Live Server" en VS Code
2. Abre `index.html`
3. Haz clic derecho y selecciona "Open with Live Server"

## Verificaciones

### Material 3 Components
Verifica que los componentes de Material 3 se renderizan correctamente:
- Los campos de texto deben tener el estilo de Material Design
- Los botones deben tener las ondas de Material (ripple effect)
- La tipografía debe seguir la escala de Material Design

### Funcionalidad
La aplicación debe mantener toda la funcionalidad original:
- ✅ Inicio de sesión
- ✅ Registro de usuarios
- ✅ Gestión de tienda
- ✅ Gestión de productos
- ✅ Modo offline-first
- ✅ Monitor de conexión

## Notas Importantes

1. **Material 3 Web Components**: Los archivos de Material 3 (`material-all.js` y `material-styles.js`) dependen de imports desde CDN de jsDelivr mediante un import map.
2. **Conexión a Internet**: Se requiere conexión a internet para que los componentes de Material 3 funcionen correctamente en la primera carga.
3. **Modo Offline**: El CSS y la lógica JavaScript funcionan offline. Los datos previamente cacheados se pueden visualizar sin conexión.
4. **Archivo Original**: El archivo `app.html` original se mantiene en el repositorio para referencia.

## Cambios Recientes (Diciembre 2025)

### ✅ Correcciones Aplicadas

1. **Login y Registro**: 
   - Las funciones `handleLogin`, `handleRegister` y `showSubView` ahora están expuestas globalmente.
   - El cambio entre las vistas de login y registro funciona correctamente.
   - Los formularios de autenticación son completamente funcionales.

2. **Estilos Offline**:
   - Los estilos CSS (`css/styles.css`) se cargan correctamente sin conexión.
   - La aplicación mantiene su apariencia visual incluso sin Material Web Components.
   - Los datos cacheados se pueden visualizar con el estilo apropiado.

3. **Documentación**:
   - README.md actualizado con información clara sobre capacidades offline.
   - Instrucciones de prueba actualizadas.
