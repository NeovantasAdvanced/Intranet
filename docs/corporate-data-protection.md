# Protección de datos corporativos en Static Web Apps Free

Esta fase retira del bundle frontend los catálogos corporativos y los sirve mediante
`GET /api/portal-data`, protegido por el principal de Azure Static Web Apps.

## Configuración backend obligatoria

Configurar en Azure Static Web Apps la variable de backend:

`CORPORATE_ALLOWED_USER_IDS`

Debe contener una lista separada por comas de los `userId` estables obtenidos de
`/.auth/me` para empleados autorizados. No se debe rellenar con emails ni con
valores proporcionados por el navegador.

La validación exige simultáneamente:

- `identityProvider` igual a `aad`.
- `userId` presente en la lista backend.
- Una identidad con email `@neovantas.com` como comprobación adicional.

El proveedor gestionado no entrega `tenantId`, `issuer` ni `userType`; por tanto,
esta capa no demuestra criptográficamente el tenant ni distingue por sí sola un
invitado. La configuración de Entra y el alta de usuarios deben mantenerse
controladas por los administradores de Azure.

## Datos

Los JSON corporativos se encuentran bajo `api/data/` y no se importan desde React.
Los usuarios reciben únicamente el catálogo de portal. `scope=admin` devuelve los
datos administrativos y exige además `isAdminPrincipal`.

Los PDFs e índices documentales continúan en contenedores Blob privados.

## GitHub

La ruta `/.auth/login/github` se bloquea con una regla específica. Debe probarse
en Azure porque existe un `responseOverrides.404`; el resultado esperado es que
la entrada GitHub no permita iniciar sesión y que los endpoints sigan rechazando
principales que no sean `aad`.

## Limitación conocida

El frontend estático y su código siguen siendo accesibles para usuarios que puedan
obtener una sesión de Static Web Apps. La protección de esta fase se centra en
datos y APIs corporativos. El backend no confía en la identidad enviada por React.
