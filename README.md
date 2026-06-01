# Portal Empleado Neovantas

MVP de intranet corporativa tipo hub para empleados de Neovantas. La primera version es una web estatica preparada para Azure Static Web Apps, con React, TypeScript, Vite, Tailwind CSS, lucide-react y contenidos mock configurables desde ficheros JSON.

Repositorio GitHub: https://github.com/NeovantasAdvanced/Intranet

## Objetivo del MVP

- Centralizar accesos rapidos, documentacion SharePoint, noticias, aplicaciones internas y un bloque de gobierno y lanzamiento.
- Validar una experiencia visual moderna y corporativa con cabecera oscura, hero ejecutivo, tarjetas, buscador y badges de estado.
- Mantener el contenido desacoplado de la UI mediante JSON versionado en GitHub.
- Dejar preparada y protegida la autenticacion Microsoft 365 / Entra ID en Azure Static Web Apps.

## Estructura inicial

```txt
src/
  components/
    layout/
      AppLayout.tsx
      Header.tsx
    ui/
      Badge.tsx
      Card.tsx
      SearchBar.tsx
      SectionHeader.tsx
  data/
    apps.json
    events.json
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
npm run sync:events
```

## Contenidos

Los contenidos iniciales viven en `src/data`. Cada JSON representa una seccion del portal:

- `quickLinks.json`: accesos frecuentes.
- `news.json`: comunicaciones y novedades.
- `events.json`: agenda corporativa preparada para eventos de Outlook.
- `documents.json`: documentacion corporativa.
- `sharepointCatalog.json`: accesos a repositorios SharePoint y recursos filtrables.
- `apps.json`: aplicaciones internas.
- `roadmap.json`: bloque de gobierno minimo y lanzamiento.

## Sincronizacion SharePoint

El catalogo `src/data/sharepointCatalog.json` se puede regenerar desde SharePoint con:

```bash
npm run sync:sharepoint
```

El script consulta Microsoft Graph y guarda solo metadatos y enlaces. No copia documentos al repositorio. Los usuarios siguen accediendo a los archivos con sus permisos normales de SharePoint/Microsoft 365.

El workflow `.github/workflows/sync-sharepoint-catalog.yml` se ejecuta todos los dias a las 05:15 UTC y tambien permite ejecucion manual desde GitHub Actions. Si detecta cambios en SharePoint, hace commit de `sharepointCatalog.json`; ese push dispara el despliegue existente de Azure Static Web Apps.

La sincronizacion indexa las carpetas principales de `Carpetas equipo Neovantas` y `RP`. En `RP` tambien baja un nivel dentro de cada carpeta de cliente/proyecto para exponer fichas de proyecto y documentos finales como recursos filtrables.

El catalogo tambien expone `Herramientas_Neovantas.kdbx` como recurso descargable dentro de `Carpetas equipo Neovantas`, para que el acceso a contrasenas de herramientas quede visible en la intranet sin intentar abrir el archivo en el navegador.

Configurar estos secrets en GitHub:

- `SHAREPOINT_TENANT_ID`
- `SHAREPOINT_CLIENT_ID`
- `SHAREPOINT_CLIENT_SECRET`
- `SHAREPOINT_SITE_ID`

La app de Entra ID usada por esos secrets necesita permiso de Microsoft Graph para leer el sitio de SharePoint, por ejemplo `Sites.Read.All` con consentimiento de administrador, o `Sites.Selected` si se prefiere limitar el acceso solo al sitio `AdvancedAnalytics`.

Guia operativa: `docs/sharepoint-sync-access.md`.

## Sincronizacion de noticias Outlook

El workflow `.github/workflows/sync-outlook-news.yml` puede actualizar `src/data/news.json` leyendo correos de Outlook con Microsoft Graph. Esta integracion esta pensada para el correo diario de noticias que ya recibe el equipo.

El script ya no guarda el mensaje completo como una sola noticia. Extrae las noticias individuales del ultimo correo recibido y genera un item por tarjeta con titulo, resumen y enlace.

Configuracion actual:

- `NEWS_MAILBOX_USER_ID` en `secrets`
- `NEWS_MAIL_FOLDER=inbox/Neovantas` en `vars`
- `NEWS_SUBJECT_PREFIX=Noticias relevantes de hoy` en `vars`
- `NEWS_MAIL_FOLDER_ID` en `secrets` o `vars` solo si quieres fijar el id exacto de la carpeta
- `NEWS_HTML_FIXTURE_PATH` para probar el parser localmente con un `.mht` o HTML exportado de Outlook

El workflow usa esas variables y filtra en JavaScript para excluir correos como `Noticias People de hoy`.
En la Home, la seccion de noticias prioriza los items cuyo `source` es `Noticias relevantes de hoy`, para mostrar solo las noticias extraidas del ultimo correo diario.

Guia operativa: `docs/outlook-news-sync.md`.

## Sincronizacion de eventos Outlook

El workflow `.github/workflows/sync-outlook-events.yml` puede actualizar `src/data/events.json` leyendo correos de Outlook con Microsoft Graph. Esta integracion esta pensada para los correos mensuales con asunto similar a `Eventos de junio` y un adjunto HTML con tablas de eventos.

El script extrae eventos desde el HTML, normaliza fechas a ISO y deja campos preparados para que el frontend distinga entre proximos, pasados y eventos de hoy.

Variables y secrets:

- `EVENTS_MAILBOX_USER_ID` en `secrets`: buzon de correo a consultar. Puede ser UPN o id de Graph.
- `EVENTS_MAIL_FOLDER=inbox/Neovantas` en `vars`: ruta recomendada de la carpeta de Outlook donde llegan los correos de eventos.
- `EVENTS_SUBJECT_PREFIX=Eventos de` en `vars`: prefijo que debe tener el asunto del correo.
- `EVENTS_MAIL_FOLDER_ID` en `secrets` o `vars` solo si quieres fijar el id exacto de la carpeta.
- `EVENTS_TENANT_ID`, `EVENTS_CLIENT_ID`, `EVENTS_CLIENT_SECRET` en `secrets`: credenciales de Graph para esta automatizacion.

Si ya usas la aplicacion de Graph de noticias o SharePoint, el workflow tambien acepta fallback a `NEWS_*` y `SHAREPOINT_*` para no duplicar secretos.

En ambos sync, el log inicial muestra el valor bruto de la variable de carpeta y la carpeta efectiva despues del fallback. Si GitHub entrega una ruta interna de Graph como `/mailFolders/inbox/childFolders`, el workflow la normaliza y usa `inbox/Neovantas` como valor operativo.

Para probar el parseo sin Outlook real puedes usar la fixture local:

```bash
EVENTS_HTML_FIXTURE_PATH=scripts/fixtures/events-sample.html npm run sync:events
```

## Autenticacion Microsoft

El portal incluye rutas de acceso `/login` y `/logout` para usar la autenticacion integrada de Azure Static Web Apps con Microsoft Entra ID. El header consulta `/.auth/me` cuando la aplicacion esta desplegada en Azure para mostrar la sesion Microsoft 365 si existe.
En Azure, el acceso queda restringido por `staticwebapp.config.json`. En local, Vite sigue permitiendo probar la UI sin bloquear el login.

## Despliegue en Azure Static Web Apps

El proyecto incluye `staticwebapp.config.json` con fallback a `index.html`, necesario para una SPA. Tambien incluye `.github/workflows/azure-static-web-apps-blue-sky-015473603.yml` como workflow base de GitHub Actions.

1. Repositorio en GitHub.
2. Crear la Static Web App en Azure conectada al repositorio.
3. Configurar `AZURE_STATIC_WEB_APPS_API_TOKEN_BLUE_SKY_015473603` como secreto en GitHub.
4. El workflow activo se llama `Deploy Intranet - Azure Static Web Apps`.
5. El despliegue de produccion vigente es `https://blue-sky-015473603.7.azurestaticapps.net/`.
6. El workflow construye `dist` antes de desplegar.

## Notas de diseno tecnico

- React y componentes reutilizables para acelerar nuevas secciones.
- Tailwind CSS para iteracion visual rapida y consistente.
- JSON versionado como fuente inicial de contenido.
- Header y navegacion superior pensados para evolucionar a rutas reales.
- Buscador global con filtrado por contenidos versionados y catalogo SharePoint sincronizable.
