# Material Web offline

Este proyecto ya incluye los archivos necesarios para usar [Material Web](https://github.com/material-components/material-web) totalmente offline (sin CDNs ni dependencias externas).

- Código fuente local en `vendor/material-web/`
- Dependencias de `lit` en `vendor/lit/`
- Dependencias de `tslib` en `vendor/tslib/`
- El `<script type="importmap">` en `index.html` apunta a estas rutas locales.

## Cómo usar un componente

1) Importa el componente desde `@material/web/...` (gracias al import map resolvemos a los archivos locales):

```html
<script type="module">
  import '@material/web/button/filled-button.js';
  import '@material/web/textfield/outlined-text-field.js';
</script>
```

2) Úsalo en tu HTML como cualquier Web Component:

```html
<md-filled-button onclick="handleLogin()">Entrar</md-filled-button>

<md-outlined-text-field
  label="Correo"
  type="email"
  supporting-text="Usa el correo con el que te registraste">
</md-outlined-text-field>
```

Los componentes toman los tokens de color/shape ya definidos en `css/styles.css`, por lo que seguirán respetando tu tema actual sin pedir nada a internet.

## Tipografía y estilos base

Si quieres aplicar la tipografía de Material para textos no-componentes, importa el paquete de tipografía una sola vez:

```html
<script type="module">
  import '@material/web/typography/md-typescale-styles.js';
</script>
```

## Notas

- Todo se sirve desde el propio proyecto; no hay llamadas a CDNs.
- Para agregar más componentes basta con importar su módulo desde `@material/web/<componente>/...`.
- Si replicas la app en otro HTML, copia también el `importmap` de `index.html` para que las rutas sigan resolviendo en local.
