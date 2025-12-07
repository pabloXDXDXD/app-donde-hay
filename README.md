# Documentación de la App "Donde Hay"

Este documento proporciona una descripción detallada de la arquitectura, funcionalidades y tecnologías utilizadas en la aplicación web, diseñada para funcionar dentro de un WebView en Sketchware Pro.

## 1. Descripción General

La aplicación es una Single-Page Application (SPA) que permite a los usuarios gestionar un inventario de productos y el perfil de su tienda. Está diseñada con un enfoque "offline-first", priorizando la experiencia del usuario al permitir el acceso a datos cacheados incluso sin conexión a internet.

La interfaz de usuario intenta seguir los principios de **Material Design 3**, utilizando un tema oscuro personalizado.

## 2. Tecnologías Utilizadas

-   **Frontend**: HTML, CSS y JavaScript (Vanilla JS). No se utiliza ningún framework externo.
-   **Backend & Base de Datos**: **Supabase** se encarga de la autenticación de usuarios y de la base de datos (PostgreSQL).
-   **Diseño**: **Material Design 3** (principios y paleta de colores).
-   **Entorno**: La aplicación está diseñada para ser ejecutada en un **WebView** dentro de una aplicación de Android (Sketchware Pro), como lo demuestra la comunicación con la interfaz nativa `Android.showToast()`.

## 3. Arquitectura de la Aplicación

### Single-Page Application (SPA)

La aplicación completa reside en un único archivo `app.html`. La navegación entre las diferentes "vistas" (como inicio de sesión, menú principal, etc.) se gestiona dinámicamente con JavaScript, mostrando u ocultando el contenido correspondiente sin recargar la página.

### Estructura del `app.html`

1.  **`<head>`**:
    *   **Metadatos**: Configuración del viewport para diseño responsivo.
    *   **Scripts**: Carga del cliente de Supabase (`supabase.js`).
    *   **`<style>`**: Contiene todo el CSS de la aplicación:
        *   **Variables de Color (`:root`)**: Define una paleta de colores basada en Material 3 (Tema Oscuro Azul).
        *   **Estilos Globales**: Reseteo de estilos, tipografía y colores de fondo.
        *   **Componentes UI**: Estilos para vistas, botones, tarjetas, modales, menús inferiores (bottom sheets), barras de navegación, etc.

2.  **`<body>`**:
    *   **Contenedores Principales**:
        *   `#splash-screen`: Pantalla de carga inicial.
        *   `#app-container`: Contenedor donde se inyectan las vistas dinámicamente.
        *   Overlays para modales y menús.
    *   **Plantillas (`<template>`)**:
        *   Se usan las etiquetas `<template>` para definir la estructura HTML de las vistas principales (`login-view` y `menu-view`).
        *   Este enfoque es eficiente, ya que el navegador no renderiza el contenido de las plantillas hasta que se clonan y se añaden al DOM con JavaScript.
    *   **`<script>`**:
        *   Contiene toda la lógica de la aplicación.

### Lógica de JavaScript (`<script>`)

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
        *   `submitProduct()`: Crea o actualiza un producto.
        *   `deleteProduct()`: Elimina un producto.

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

-   **Página de Ajustes**:
    -   Actualmente, solo contiene la funcionalidad para cerrar sesión.

## 5. Integración con Sketchware

La comunicación entre el WebView y la aplicación nativa de Android se realiza a través de una interfaz de JavaScript.

-   **`Android.showToast(message)`**: Esta función de JavaScript invoca un método nativo de Android para mostrar un "Toast", que es una notificación nativa y no intrusiva. Esto evita el uso de `alert()`, que es más disruptivo para la experiencia de usuario.