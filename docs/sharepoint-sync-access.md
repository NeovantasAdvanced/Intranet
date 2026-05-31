# Configurar acceso de sincronizacion SharePoint

Este portal sincroniza un catalogo de SharePoint mediante Microsoft Graph y guarda solo metadatos en `src/data/sharepointCatalog.json`. Los documentos siguen viviendo en SharePoint y los usuarios acceden con sus permisos normales de Microsoft 365.

La intranet usa ese catalogo para mostrar:

- `Carpetas equipo Neovantas`
- `RP`
- recursos filtrables por carpeta, fichero, ficha de proyecto y documento final
- `Herramientas_Neovantas.kdbx` como descarga visible para los empleados

## Datos del sitio

- Tenant SharePoint: `neovantas.sharepoint.com`
- Sitio: `/sites/AdvancedAnalytics`
- Site ID: `neovantas.sharepoint.com,f1130fe7-22f6-4409-9ecd-dbfb72847b77,91e2fcfd-8e6e-4132-9ef5-4fdf69a7fafc`
- Carpetas sincronizadas:
  - `Carpetas equipo Neovantas`
  - `RP`

La sincronizacion lista las carpetas principales de ambos repositorios. Para `RP`, tambien lee un nivel adicional dentro de cada carpeta de cliente/proyecto y anade los archivos encontrados como recursos filtrables, por ejemplo fichas de proyecto y documentos finales.
En `Carpetas equipo Neovantas` tambien expone la base KeePass `Herramientas_Neovantas.kdbx` para que aparezca en la portada como acceso descargable.

## Opcion recomendada: Sites.Selected

Usar `Sites.Selected` limita la app de sincronizacion al sitio `AdvancedAnalytics`, en vez de darle lectura a todo SharePoint.

1. Crear una aplicacion en Microsoft Entra ID.
   - Nombre sugerido: `Intranet SharePoint Catalog Sync`
   - Tipo: single tenant.

2. Crear un client secret.
   - Guardar el valor del secret una sola vez.
   - Usar una caducidad controlada y poner recordatorio de rotacion.

3. Anadir permiso de API Microsoft Graph.
   - Tipo: Application permission.
   - Permiso: `Sites.Selected`.
   - Conceder admin consent.

4. Conceder permiso de lectura de la app sobre el sitio.
   - Site ID:

```txt
neovantas.sharepoint.com,f1130fe7-22f6-4409-9ecd-dbfb72847b77,91e2fcfd-8e6e-4132-9ef5-4fdf69a7fafc
```

   - Llamada Graph:

```http
POST https://graph.microsoft.com/v1.0/sites/{site-id}/permissions
Content-Type: application/json

{
  "roles": ["read"],
  "grantedToIdentities": [
    {
      "application": {
        "id": "{client-id}",
        "displayName": "Intranet SharePoint Catalog Sync"
      }
    }
  ]
}
```

Esta llamada debe ejecutarla una identidad con permisos suficientes, por ejemplo SharePoint Administrator o superior.

## Secrets en GitHub

Configurar en `NeovantasAdvanced/Intranet` > Settings > Secrets and variables > Actions:

- `SHAREPOINT_TENANT_ID`: directory tenant id de Entra ID.
- `SHAREPOINT_CLIENT_ID`: application/client id de la app creada.
- `SHAREPOINT_CLIENT_SECRET`: valor del client secret.
- `SHAREPOINT_SITE_ID`: `neovantas.sharepoint.com,f1130fe7-22f6-4409-9ecd-dbfb72847b77,91e2fcfd-8e6e-4132-9ef5-4fdf69a7fafc`

## Verificacion

1. En GitHub Actions, abrir `Sync SharePoint catalog`.
2. Ejecutar `Run workflow`.
3. Confirmar que el job termina correctamente.
4. Si SharePoint ha cambiado, el workflow hace commit de `src/data/sharepointCatalog.json`.
5. Ese commit dispara el workflow de despliegue de Azure Static Web Apps.

## Comprobacion rapida

Si la sincronizacion esta bien, en la portada de la intranet deberian verse:

- el bloque `Repositorios SharePoint`
- el filtro de `Equipo` y `Proyectos`
- la descarga `Herramientas_Neovantas.kdbx` dentro de `Carpetas equipo Neovantas`
- fichas y documentos finales visibles dentro de `RP`

Si falta algun elemento, revisar primero el `sharepointCatalog.json` y despues el log del workflow para ver si el `siteId` y los permisos Graph siguen siendo correctos.

## Opcion alternativa: Sites.Read.All

Si se prefiere una configuracion mas rapida, se puede conceder a la app `Sites.Read.All` como Application permission con admin consent. En ese caso `SHAREPOINT_SITE_ID` sigue siendo valido, pero la app tendra lectura de todos los sitios del tenant, por lo que no es la opcion recomendada.
