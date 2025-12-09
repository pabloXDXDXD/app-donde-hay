# Documentación de la App "Donde Hay"

Este documento proporciona una descripción detallada de la arquitectura, funcionalidades y tecnologías utilizadas en la aplicación web, diseñada para funcionar dentro de un WebView en Sketchware Pro.

## 1. Descripción General

La aplicación es una Single-Page Application (SPA) que permite a los usuarios gestionar un inventario de productos y el perfil de su tienda. Está diseñada con un enfoque "offline-first", priorizando la experiencia del usuario al permitir el acceso a datos cacheados incluso sin conexión a internet.

La interfaz de usuario sigue los principios de **Material Design 3**, utilizando un tema oscuro personalizado con:
- Sistema de elevación con sombras apropiadas (3 niveles)
- State layers para feedback interactivo (hover, focus, pressed)
- Transiciones suaves con easing M3 estándar
- Design tokens para consistencia visual

## 2. Tecnologías Utilizadas

-   **Frontend**: HTML, CSS y JavaScript (Vanilla JS). No se utiliza ningún framework externo.
-   **Backend & Base de Datos**: **Supabase** se encarga de la autenticación de usuarios y de la base de datos (PostgreSQL).
-   **Diseño**: **Material Design 3** con implementación personalizada y componentes de Material Web servidos de forma local (sin dependencias externas).
-   **Entorno**: La aplicación está diseñada para ser ejecutada en un **WebView** dentro de una aplicación de Android (Sketchware Pro), como lo demuestra la comunicación con la interfaz nativa `Android.showToast()`.

## 3. Arquitectura de la Aplicación

### Single-Page Application (SPA)

La aplicación es una SPA modular con separación de responsabilidades. La navegación entre las diferentes "vistas" (como inicio de sesión, menú principal, etc.) se gestiona dinámicamente con JavaScript, mostrando u ocultando el contenido correspondiente sin recargar la página.

### Estructura de Archivos

```
app-donde-hay/
├── index.html          # Archivo HTML principal
├── css/
│   └── styles.css      # Estilos de Material Design 3
├── js/
│   └── main.js         # Lógica de la aplicación
└── supabase.js         # Cliente de Supabase
```

### Estructura del `index.html`

1.  **`<head>`**:
    *   **Metadatos**: Configuración del viewport para diseño responsivo.
    *   **Scripts**: Carga del cliente de Supabase (`supabase.js`).
    *   **Estilos**: Enlace a `css/styles.css` que contiene:
        *   **Variables de Color (`:root`)**: Paleta de colores Material 3 (Tema Oscuro Azul).
        *   **Design Tokens M3**: Elevación, state layers, y espaciado.
        *   **Estilos Globales**: Reseteo de estilos, tipografía y colores de fondo.
        *   **Componentes UI**: Estilos para vistas, botones, tarjetas, modales, bottom sheets, barras de navegación, etc.

2.  **`<body>`**:
    *   **Contenedores Principales**:
        *   `#splash-screen`: Pantalla de carga inicial.
        *   `#app-container`: Contenedor donde se inyectan las vistas dinámicamente.
        *   Overlays para modales y menús.
    *   **Plantillas (`<template>`)**:
        *   Se usan las etiquetas `<template>` para definir la estructura HTML de las vistas principales (`login-view` y `menu-view`).
        *   Este enfoque es eficiente, ya que el navegador no renderiza el contenido de las plantillas hasta que se clonan y se añaden al DOM con JavaScript.
    *   **Script**: Carga de `js/main.js` como módulo ES6.

### Lógica de JavaScript (`js/main.js`)

La lógica principal se puede dividir en las siguientes áreas:

1.  **Inicialización y Sesión**:
    *   Se inicializa el cliente de Supabase.
    *   Al cargar el DOM, se verifica el estado de la sesión del usuario con un enfoque **offline-first**:
        *   **Online**: Se contacta a Supabase para validar la sesión actual. El token se guarda en `localStorage` para uso futuro sin conexión.
        *   **Offline**: Se comprueba si existe un token de sesión en `localStorage`. Si es así, se asume que la sesión es válida y se carga la aplicación en modo offline.
    *   Un listener `onAuthStateChange` gestiona los cambios de estado (login/logout) para redirigir al usuario automáticamente.

2.  **Gestión de Vistas (Navegación)**:
    *   La función `initializeView()` se encarga de mostrar la vista de login o el menú principal según el estado de la sesión.
    *   `navigateTo()` controla la navegación entre las páginas internas del menú (Productos, Tienda, Ajustes).

3.  **Gestión de Datos (CRUD)**:
    *   **Caché**: La aplicación guarda en `localStorage` los datos de la tienda (`store_cache`) y los productos (`products_cache`) para un acceso rápido y offline.
    *   **Sincronización**: La función `refreshData()` se ejecuta cuando hay conexión para obtener los datos más recientes de Supabase y actualizar la caché local.
    *   **Funciones CRUD**:
        *   `submitStore()`: Crea o actualiza el perfil de la tienda.
        *   `deleteStore()`: Elimina permanentemente la tienda y todos los productos asociados.
        *   `submitProduct()`: Crea o actualiza un producto.
        *   `deleteProduct()`: Elimina un producto.
        *   `openProductModal()`: Abre el modal para crear o editar un producto (acepta product ID).
        *   `showProductMenu()`: Muestra el menú contextual con opciones de editar/eliminar para un producto.

4.  **Componentes UI Dinámicos**:
    *   Funciones como `openModal()`, `openBottomSheet()` y `showToast()` gestionan la aparición de elementos de interfaz interactivos.

5.  **Monitor de Red**:
    *   La función `startNetworkMonitor()` comprueba periódicamente el estado de la conexión a internet y actualiza un indicador visual en la interfaz.

## 4. Funcionalidades Principales

-   **Autenticación**:
    -   Inicio de sesión y creación de cuentas.
    -   Cierre de sesión.
    -   Persistencia de sesión (online y offline).

-   **Página de Productos**:
    -   Muestra una lista de los productos del usuario.
    -   Permite **añadir** nuevos productos a través de un FAB (Floating Action Button).
    -   Permite **editar** y **eliminar** productos existentes a través de un menú contextual (bottom sheet).
    -   Muestra estados vacíos si no hay productos o si la tienda no está aprobada.

-   **Página de Tienda**:
    -   Permite al usuario crear o editar los datos de su tienda (nombre, teléfono, etc.).
    -   Muestra el estado actual de la solicitud de la tienda (ej. pendiente, aprobada).
    -   Permite **eliminar** la tienda y todos los productos asociados desde la página de Ajustes.

-   **Página de Ajustes**:
    -   Permite **eliminar la tienda** del usuario (acción irreversible que elimina la tienda y todos sus productos).
    -   Contiene la funcionalidad para cerrar sesión.

## 5. Integración con Sketchware

La comunicación entre el WebView y la aplicación nativa de Android se realiza a través de una interfaz de JavaScript.

-   **`Android.showToast(message)`**: Esta función de JavaScript invoca un método nativo de Android para mostrar un "Toast", que es una notificación nativa y no intrusiva. Esto evita el uso de `alert()`, que es más disruptivo para la experiencia de usuario.

## 6. Notas Técnicas y Correcciones Recientes

### Gestión de Caché y Persistencia
-   **Problema resuelto**: La función `loadCache()` ahora verifica que los valores cacheados no sean la cadena `'null'` antes de cargarlos, evitando que tiendas eliminadas reaparezcan tras cerrar sesión y volver a iniciar.
-   La caché se limpia apropiadamente cuando se elimina una tienda usando `localStorage.removeItem()`.

### CRUD de Productos
-   **Problema resuelto**: Las operaciones de editar y eliminar productos ahora funcionan correctamente.
-   La función `showProductMenu()` ahora acepta un `productId` en lugar de un objeto JSON, evitando problemas de parsing en atributos onclick.
-   La función `openProductModal()` encuentra el producto correspondiente desde el array `PRODUCTS` usando el ID.
-   Se agregó verificación de propiedad en `deleteProduct()` para mejorar la experiencia de usuario (la seguridad real se maneja mediante políticas RLS de Supabase).

### Seguridad
-   Las verificaciones de propiedad del lado del cliente (en `deleteStore()` y `deleteProduct()`) son para mejorar la UX, mostrando mensajes de error apropiados antes de realizar peticiones.
-   La seguridad real se implementa a través de las políticas de Row Level Security (RLS) de Supabase en el backend.

### Login y Registro (Diciembre 2025)
-   **Problema resuelto**: Las funciones de login (`handleLogin`), registro (`handleRegister`) y cambio de vista (`showSubView`) ahora están expuestas globalmente en el objeto `window`.
-   Esto permite que los manejadores de eventos `onclick` en las plantillas HTML funcionen correctamente.
-   El flujo completo de autenticación ahora funciona sin errores en el navegador.

### Funcionalidad Offline
La aplicación tiene capacidades offline limitadas:

**✅ Funciona sin conexión:**
-   Estilos CSS locales (todos los estilos de `css/styles.css`)
-   Componentes de Material Web (`@material/web`) servidos desde `vendor/` mediante el `importmap` de `index.html`
-   Lógica JavaScript de la aplicación (`js/main.js`)
-   Navegación y gestión de caché de datos
-   Visualización de datos cacheados previamente
-   Cliente de Supabase (`supabase.js`)

**❌ Requiere conexión a internet:**
-   **Backend Supabase**: Las operaciones de base de datos y autenticación requieren conectividad.
