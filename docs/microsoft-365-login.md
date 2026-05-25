# Login Microsoft 365

La intranet usa la autenticacion integrada de Azure Static Web Apps con Microsoft Entra ID.

## Configuracion en el repo

- `/login` redirige a `/.auth/login/aad`.
- `/logout` redirige a `/.auth/logout`.
- Todas las rutas de la intranet requieren el rol integrado `authenticated`.
- Si un usuario anonimo abre la intranet, Azure devuelve `401` y se redirige automaticamente al login de Microsoft.
- El frontend consulta `/.auth/me` para mostrar el usuario conectado en la cabecera.

Esta configuracion esta en `staticwebapp.config.json`.

## Prueba en Azure

1. Desplegar `main` en Azure Static Web Apps.
2. Abrir la URL publica en una ventana privada.
3. Comprobar que redirige al login de Microsoft.
4. Entrar con una cuenta de Neovantas.
5. Comprobar que la cabecera muestra el usuario conectado.
6. Pulsar el icono de salida o abrir `/logout`.
7. Confirmar que al volver a entrar pide autenticacion.

## Prueba local

Con `npm run dev`, Vite no emula `/.auth/me` ni las reglas de `staticwebapp.config.json`. En local la app se puede abrir sin login, pero el flujo real queda validado al desplegar en Azure Static Web Apps.

Para emularlo en local haria falta usar Azure Static Web Apps CLI y configurar autenticacion local.
