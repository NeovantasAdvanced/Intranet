# Portal Empleado Neovantas

MVP de intranet corporativa tipo hub para empleados de Neovantas. La primera version es una web estatica preparada para Azure Static Web Apps, con React, TypeScript, Vite, Tailwind CSS, lucide-react y contenidos mock configurables desde ficheros JSON.

Repositorio GitHub: https://github.com/NeovantasAdvanced/Intranet

## Objetivo del MVP

- Centralizar accesos rapidos, GPTs/asistentes, noticias, documentacion, aplicaciones internas y roadmap de Mesa IA.
- Validar una experiencia visual moderna y corporativa con sidebar oscuro, fondo claro, tarjetas, buscador y badges de estado.
- Mantener el contenido desacoplado de la UI mediante JSON versionado en GitHub.
- Dejar preparada la evolucion a autenticacion Microsoft 365 / Entra ID sin implementar login real en esta fase.

## Estructura inicial

```txt
src/
  components/
    layout/
      AppLayout.tsx
      Header.tsx
      Sidebar.tsx
    ui/
      Badge.tsx
      Card.tsx
      SearchBar.tsx
      SectionHeader.tsx
  data/
    apps.json
    assistants.json
    documents.json
    news.json
    quickLinks.json
    roadmap.json
    sharepointCatalog.json
  pages/
    HomeDashboard.tsx
  types/
    content.ts
  App.tsx
  main.tsx
  index.css
```

## Scripts

```bash
npm install
npm run dev
npm run build
npm run sync:sharepoint
npm run sync:news
```

## Contenidos

Los contenidos iniciales viven en `src/data`. Cada JSON representa una seccion del portal:

- `quickLinks.json`: accesos frecuentes.
- `assistants.json`: GPTs y asistentes internos.
- `news.json`: comunicaciones y novedades.
- `documents.json`: documentacion corporativa.
- `sharepointCatalog.json`: accesos a repositorios SharePoint y recursos filtrables.
- `apps.json`: aplicaciones internas.
- `roadmap.json`: evolucion prevista, incluida Mesa IA y autenticacion futura.

## Sincronizacion SharePoint

El catalogo `src/data/sharepointCatalog.json` se puede regenerar desde SharePoint con:

```bash
npm run sync:sharepoint
```

El script consulta Microsoft Graph y guarda solo metadatos y enlaces. No copia documentos al repositorio. Los usuarios siguen accediendo a los archivos con sus permisos normales de SharePoint/Microsoft 365.

El workflow `.github/workflows/sync-sharepoint-catalog.yml` se ejecuta todos los dias a las 05:15 UTC y tambien permite ejecucion manual desde GitHub Actions. Si detecta cambios en SharePoint, hace commit de `sharepointCatalog.json`; ese push dispara el despliegue existente de Azure Static Web Apps.

La sincronizacion indexa las carpetas principales de `Carpetas equipo Neovantas` y `RP`. En `RP` tambien baja un nivel dentro de cada carpeta de cliente/proyecto para exponer fichas de proyecto y documentos finales como recursos filtrables.

Configurar estos secrets en GitHub:

- `SHAREPOINT_TENANT_ID`
- `SHAREPOINT_CLIENT_ID`
- `SHAREPOINT_CLIENT_SECRET`
- `SHAREPOINT_SITE_ID`

La app de Entra ID usada por esos secrets necesita permiso de Microsoft Graph para leer el sitio de SharePoint, por ejemplo `Sites.Read.All` con consentimiento de administrador, o `Sites.Selected` si se prefiere limitar el acceso solo al sitio `AdvancedAnalytics`.

Guia operativa: `docs/sharepoint-sync-access.md`.

## Sincronizacion de noticias Outlook

El workflow `.github/workflows/sync-outlook-news.yml` puede actualizar `src/data/news.json` leyendo correos de Outlook con Microsoft Graph. Esta integracion esta pensada para el correo diario de noticias que ya recibe el equipo.

El script guarda solo asunto, resumen, fecha, enlace a Outlook y metadatos. No copia adjuntos ni cuerpos completos de correo.

Guia operativa: `docs/outlook-news-sync.md`.

## Autenticacion futura

El portal incluye rutas de acceso `/login` y `/logout` para usar la autenticacion integrada de Azure Static Web Apps con Microsoft Entra ID. El header consulta `/.auth/me` cuando la aplicacion esta desplegada en Azure para mostrar la sesion Microsoft 365 si existe.

La siguiente fase recomendada es restringir el acceso completo al portal a usuarios Neovantas:

- Configurar proveedor Microsoft Entra ID ligado al tenant Neovantas si se quiere evitar que cualquier cuenta Microsoft autenticada acceda al portal.
- Proteger rutas mediante `staticwebapp.config.json` y roles.
- Leer identidad de usuario desde `/.auth/me` cuando la aplicacion se ejecute en Azure.
- Crear una capa `src/auth` en la siguiente iteracion para encapsular usuario, roles y estados de sesion.
- Mantener este MVP funcionando localmente sin dependencia de Microsoft 365.

## Despliegue en Azure Static Web Apps

El proyecto incluye `staticwebapp.config.json` con fallback a `index.html`, necesario para una SPA. Tambien incluye `.github/workflows/azure-static-web-apps.yml` como workflow base de GitHub Actions.

1. Repositorio en GitHub.
2. Crear la Static Web App en Azure conectada al repositorio.
3. Configurar el secreto `AZURE_STATIC_WEB_APPS_API_TOKEN` en GitHub si Azure no lo crea automaticamente.
4. `app_location: "/"`.
5. `output_location: "dist"`.

## Notas de diseno tecnico

- React y componentes reutilizables para acelerar nuevas secciones.
- Tailwind CSS para iteracion visual rapida y consistente.
- JSON versionado como fuente inicial de contenido.
- Sidebar y header pensados para evolucionar a navegacion real con rutas.
- Buscador global con filtrado por contenidos versionados y catalogo SharePoint sincronizable.
