# Autorizacion hibrida temporal

Las APIs privadas consultan primero `NeovantasUserAccess`. Si existe una entidad,
solo el estado `active` y sus permisos explicitos autorizan; `pending`,
`suspended` y `revoked` deniegan aunque la identidad siga en
`CORPORATE_ALLOWED_USER_IDS`.

Si no existe entidad, la allowlist se usa unicamente como compatibilidad temporal.
Los fallos de Table Storage deniegan y no activan ese fallback.

Para inicializar al administrador actual, mantener temporalmente su `userId` en
`CORPORATE_ALLOWED_USER_IDS` y crear su entidad `active` con los permisos
aprobados. No se importan empleados automaticamente como `active`.

La retirada de la allowlist requiere migrar y verificar todas las identidades.
La reversión conserva la allowlist, pero nunca debe reactivar una entidad marcada
como `suspended` o `revoked` sin una revisión administrativa explícita.
