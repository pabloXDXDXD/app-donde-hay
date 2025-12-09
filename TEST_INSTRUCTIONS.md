# Instrucciones de Prueba - Aplicación Refactorizada

## Estructura del Proyecto

La aplicación ha sido refactorizada con la siguiente estructura:

```
app-donde-hay/
├── css/
│   └── styles.css          # Todos los estilos CSS de la aplicación (incluye Material Design 3)
├── js/
│   └── main.js            # Toda la lógica JavaScript de la aplicación
├── index.html             # HTML principal con formularios nativos HTML
└── supabase.js            # Cliente de Supabase
```

## Cambios Implementados

### 1. Estructura de Carpetas
- ✅ Creadas carpetas `css/` y `js/`
- ✅ Movidos archivos de Material 3 a `js/`

### 2. Separación de Código
- ✅ CSS extraído a `css/styles.css`
- ✅ JavaScript extraído a `js/main.js`

### 3. Formularios de Autenticación
- ✅ Implementados con elementos HTML nativos:
  - Campos de texto con animación de label flotante estilo Material Design
  - Botones con estilos Material Design 3
  - Sin dependencia de componentes web externos

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

### Material Design 3 Components
Verifica que los componentes de Material Design 3 se renderizan correctamente:
- Los campos de texto deben tener el estilo outlined de Material Design con labels flotantes
- Los botones deben tener las ondas de Material (ripple effect simulado con CSS)
- La tipografía debe seguir la escala de Material Design
- Todo funciona completamente offline sin conexión a internet

### Funcionalidad
La aplicación debe mantener toda la funcionalidad original:
- ✅ Inicio de sesión
- ✅ Registro de usuarios
- ✅ Gestión de tienda
- ✅ Gestión de productos
- ✅ Modo offline-first
- ✅ Monitor de conexión

## Notas Importantes

1. **Material Design 3**: La aplicación ahora usa CSS personalizado para implementar Material Design 3, eliminando la dependencia de CDN externos.
2. **Modo Completamente Offline**: La aplicación funciona completamente sin conexión a internet. Todos los estilos y componentes están incluidos localmente.
3. **Archivo Original**: El archivo `app.html` original se mantiene en el repositorio para referencia.

## Cambios Recientes (Diciembre 2025)

### ✅ Correcciones Aplicadas

1. **Eliminación de Dependencia de CDN**:
   - Se eliminaron los archivos `material-all.js` y `material-styles.js` que dependían de imports desde CDN.
   - Se eliminó el `importmap` que redirigía a jsDelivr CDN.
   - Se reemplazaron los componentes `<md-outlined-text-field>`, `<md-filled-button>`, y `<md-text-button>` con elementos HTML estándar.
   - Se agregaron estilos CSS personalizados para Material Design 3 (campos de texto y botones).

2. **Login y Registro**: 
   - Las funciones `handleLogin`, `handleRegister` y `showSubView` ahora están expuestas globalmente.
   - El cambio entre las vistas de login y registro funciona correctamente.
   - Los formularios de autenticación son completamente funcionales.
   - Los campos de texto ahora tienen animación de label flotante estilo Material Design.

3. **Estilos Offline**:
   - Todos los estilos CSS están incluidos localmente en `css/styles.css`.
   - La aplicación mantiene su apariencia Material Design 3 completamente offline.
   - Los datos cacheados se pueden visualizar con el estilo apropiado.
   - Se agregaron clases de tipografía Material Design 3.

4. **Documentación**:
   - README.md actualizado con información clara sobre capacidades offline.
   - Instrucciones de prueba actualizadas.
