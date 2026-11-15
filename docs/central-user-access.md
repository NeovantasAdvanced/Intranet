# Registro central de usuarios y permisos

La Fase 1 añade un registro privado en Azure Table Storage, sin activar todavía
la autorización efectiva de la intranet ni de Neo.

## Variables de backend

- `USER_ACCESS_TABLE_NAME` (opcional; por defecto `NeovantasUserAccess`).
- `AZURE_STORAGE_CONNECTION_STRING`, `AzureWebJobsStorage` o `AZURE_WEBJOBS_STORAGE`.

La cuenta debe permitir crear tablas y leer/escribir entidades. Nunca se expone
esta configuración al frontend.

## Flujo

`POST /api/access-request` crea una solicitud `pending` únicamente si el
principal es `aad` y su email/UPN coincide con `organization-users.json`.
La coincidencia no activa el acceso.

`GET/POST /api/user-access-admin` permite a un administrador revisar y cambiar
el estado y permisos de las solicitudes. La aprobación se realiza en backend y
no acepta un `userId` enviado libremente por el navegador.

Durante la migración debe mantenerse `CORPORATE_ALLOWED_USER_IDS`. El proveedor
gestionado de Static Web Apps no entrega `tenantId`, `issuer` ni `userType`; por
ello la vinculación sigue requiriendo aprobación administrativa y no constituye
por sí sola una prueba criptográfica del tenant.

La Fase 2 conectará `portal-data`, Neo y las demás APIs a este registro, después
de validar la cobertura y preparar una reversión a la allowlist existente.
