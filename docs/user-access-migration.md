# Migración masiva de usuarios

La migración prepara entidades en `NeovantasUserAccess` a partir de
`api/data/organization-users.json`. El importador es idempotente: por cada
correo normalizado crea una entidad solo si no existe otra entidad para ese
correo. Nunca modifica una entidad existente, por lo que conserva estados
`suspended`/`revoked`, identidades vinculadas y permisos administrados.

## Ejecución

Desde `api/`, con `AZURE_STORAGE_CONNECTION_STRING` (o
`AzureWebJobsStorage`) configurada únicamente en el entorno seguro de
ejecución:

```text
node scripts/migrate-user-access.cjs
node scripts/migrate-user-access.cjs --apply
```

La primera orden genera un informe de solo lectura. La segunda crea únicamente
los registros preparados. El informe incluye empleados detectados, preparados,
ya existentes, duplicados e inconsistencias; no imprime credenciales. Validar
el informe antes de usar `--apply` y conservarlo como evidencia operativa.

Las nuevas entidades quedan `active` con `intranet: true`. Los permisos de
repositorios proceden de `access-control.json`; los permisos actuales de
administración y Neo se conservan para las identidades administrativas ya
definidas en la configuración heredada. Una entidad existente nunca se
sobrescribe.

## Vinculación del primer acceso

Cuando un usuario corporativo autenticado por `aad` accede, el backend busca
primero su identidad vinculada y, si aún no existe, localiza la entidad
precargada por correo y registra una sola vez `staticWebAppsUserId` e
`identityProvider`. El frontend no puede proporcionar estos valores.

Una identidad con estado `pending`, `suspended` o `revoked` no se activa por
este flujo. Si el correo no está en el censo o no hay entidad migrada, se
mantiene el fallback temporal de `CORPORATE_ALLOWED_USER_IDS`; Table Storage
prevalece para cualquier entidad encontrada. Los errores de Table Storage
deniegan el acceso y no activan ese fallback.

## Limitación pendiente

El proveedor gestionado de Static Web Apps no proporciona en el principal
actual todos los claims de tenant necesarios para una verificación fuerte. La
vinculación automática se limita a `aad`, `userId` y correo corporativo y no
concede privilegios administrativos nuevos. Mantener revisión de altas,
bajas y posibles cuentas invitadas hasta disponer de una verificación de
tenant más fuerte.

Para revertir la migración sin borrar datos, detener el paso `--apply` y
restaurar la versión anterior de la aplicación. No eliminar entidades ni
reutilizar una identidad vinculada automáticamente.
