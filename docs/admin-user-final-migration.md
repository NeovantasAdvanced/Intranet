# Cierre de la administración de usuarios

## Configuración

La autorización efectiva se obtiene de `NeovantasUserAccess`. En producción se debe configurar:

```text
USER_ACCESS_TABLE_NAME=NeovantasUserAccess
USER_ACCESS_LEGACY_FALLBACK=false
AZURE_STORAGE_CONNECTION_STRING=<configurado como secreto de Azure>
```

`CORPORATE_ALLOWED_USER_IDS` puede conservarse durante la transición, pero no se utiliza cuando `USER_ACCESS_LEGACY_FALLBACK=false` (valor recomendado). La tabla de preview debe usar otra cuenta y `USER_ACCESS_TABLE_NAME=NeovantasUserAccessPreview`; nunca se debe compartir la conexión con producción.

## Simulación y copia de seguridad

Desde `C:\Intranet\api`, con la conexión de la cuenta objetivo disponible solo en el entorno de ejecución:

```powershell
node scripts/reconcile-user-access.cjs --input ..\Usuarios.xlsx
```

El comando es de solo lectura y muestra el informe JSON. Para aplicar, la copia debe crearse con una ruta nueva y el comando debe incluir `--backup`:

```powershell
node scripts/reconcile-user-access.cjs --input ..\Usuarios.xlsx --backup .\backups\user-access-<fecha>.json --apply
```

El script no incorpora secretos, conserva las identidades vinculadas, usa ETag al actualizar y aborta si el resultado eliminaría al último administrador. Una segunda ejecución no recrea entidades ni vuelve a modificar registros sin diferencias. Las entidades ausentes o bloqueadas se conservan y pasan a `revoked` con permisos desactivados; nunca se borran físicamente.

## Política aplicada

- `fmacias@neovantas.com`: intranet, repositories, neo y admin activos.
- `mortiz@neovantas.com`: intranet, repositories y neo activos; sin admin.
- Resto: permisos de repositorios según el puesto; neo y admin desactivados.
- Cuenta bloqueada y cuentas ausentes: acceso revocado.

La aplicación genera auditoría en la partición `audit`. Si falla una operación, se conserva la copia previa y el informe de entidades aplicadas permite revisar cualquier progreso parcial antes de reanudar.

## Reversión

La reversión de código se realiza desplegando el commit anterior mediante el workflow de Static Web Apps. La reversión de datos se hace restaurando únicamente las entidades afectadas desde la copia mediante un procedimiento administrativo revisado; no se debe borrar la tabla ni sustituirla por los JSON antiguos. Antes de retirar la allowlist, validar un administrador, un empleado, un usuario suspendido y un usuario sin permisos en preview.
