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

El script ya no guarda el mensaje completo como una sola noticia. Extrae las noticias individuales del ultimo correo recibido y genera un item por tarjeta con titulo, resumen y enlace. El campo `source` de cada item guarda la fuente del articulo, y `rawMeta.newsletterSource` marca el boletin de Outlook que se esta importando para que la Home solo muestre el ultimo correo procesado.

Configuracion actual:

- `NEWS_MAILBOX_USER_ID` en `secrets`
- `NEWS_MAIL_FOLDER=inbox/Neovantas` en `vars`
- `NEWS_SUBJECT_PREFIX=Noticias relevantes de hoy` en `vars`
- `NEWS_SENDER` es opcional y solo conviene usarlo si quieres fijar un remitente concreto
- `NEWS_MAIL_FOLDER_ID` en `secrets` o `vars` solo si quieres fijar el id exacto de la carpeta
- `NEWS_HTML_FIXTURE_PATH` para probar el parser localmente con un `.mht`, HTML exportado de Outlook o un texto plano del briefing

El workflow usa esas variables y filtra en JavaScript para excluir correos como `Noticias People de hoy`.
En la Home, la seccion de noticias prioriza los items cuyo `rawMeta.newsletterSource` es `Noticias relevantes de hoy`, para mostrar solo las noticias extraidas del ultimo correo diario.

Si el parseo falla, el workflow deja artefactos de depuracion en `tmp/latest-news-email.txt` y `tmp/latest-news-parsed-debug.json`.
Este sync se ejecuta cada dia a las 09:10 hora de Madrid, que en GitHub Actions corresponde a `07:10 UTC`. Tambien se puede lanzar manualmente. Ya no se dispara por `push` en `main`; se ejecuta por programacion o manualmente para evitar ciclos cuando hace commit de `news.json`.

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
Este sync tambien se ejecuta solo por programacion o manualmente, no por `push` en `main`, para evitar bucles al guardar `events.json`.

En ambos sync, el log inicial muestra el valor bruto de la variable de carpeta y la carpeta efectiva despues del fallback. Si GitHub entrega una ruta interna de Graph como `/mailFolders/inbox/childFolders`, el workflow la normaliza y usa `inbox/Neovantas` como valor operativo.

Para probar el parseo sin Outlook real puedes usar la fixture local:

```bash
EVENTS_HTML_FIXTURE_PATH=scripts/fixtures/events-sample.html npm run sync:events
```

## Autenticacion Microsoft

El portal incluye rutas de acceso `/login` y `/logout` para usar la autenticacion integrada de Azure Static Web Apps con Microsoft Entra ID. El header consulta `/.auth/me` cuando la aplicacion esta desplegada en Azure para mostrar la sesion Microsoft 365 si existe.
En Azure, el acceso queda restringido por `staticwebapp.config.json`. En local, Vite sigue permitiendo probar la UI sin bloquear el login.

## Analitica de uso privada

La pagina de analitica se publica en `/admin/usage` y no aparece en la navegacion principal. Solo pueden verla los administradores definidos por email.

Configurar en el entorno de build o en las variables de la Static Web App:

```bash
VITE_ADMIN_EMAILS=fernando.macias@neovantas.com,admin@neovantas.com
```

Reglas actuales:

- `isAdminUser(userEmail)` sigue permitiendo una lista manual de respaldo con `VITE_ADMIN_EMAILS`.
- La pagina tambien acepta los privilegios administrativos que llegan desde Microsoft 365 en `/.auth/me` si el usuario ya es administrador en el tenant, incluyendo el rol de Global Administrator.
- Si el usuario no es admin, la pagina muestra un mensaje de acceso denegado y no consulta el endpoint de metricas.
- El tracking general del portal sigue funcionando para todos los usuarios.
- La logica esta preparada para migrar en el futuro a un grupo de Microsoft Entra ID llamado `Intranet Admins`.

### Backend de analitica

La analitica ya no depende de un JSON estatizado. El portal registra accesos y clics en Azure Functions y los guarda en Azure Table Storage para poder sacar estadisticas por usuario.

Variables necesarias en Azure Static Web Apps:

- `AZURE_STORAGE_CONNECTION_STRING`: conexion al Storage Account donde se guarda el tracking.
- `USAGE_TABLE_NAME`: opcional. Nombre de la tabla; por defecto `NeovantasUsageEvents`.
- `VITE_ADMIN_EMAILS`: allowlist temporal de administradores para el build y para el backend.

Rutas internas:

- `POST /api/usage/track`: registra pageviews, secciones y enlaces.
- `GET /api/usage/summary`: devuelve totales, usuarios unicos, secciones, enlaces, actividad por dia y actividad por usuario.

Si `AZURE_STORAGE_CONNECTION_STRING` no esta configurada, la pagina privada seguira visible para administradores, pero las metricas no se podran persistir y la vista mostrara un error explicito.

Si necesitas abrir acceso de forma inmediata, añade el correo al allowlist temporal:

```bash
VITE_ADMIN_EMAILS=fmacias@neovantas.com
```

En Azure Static Web Apps:

1. Abre el recurso de la app.
2. Entra en `Configuration`.
3. Añade la variable de aplicacion `VITE_ADMIN_EMAILS`.
4. Guarda y vuelve a desplegar.
5. Cierra sesion y vuelve a entrar para refrescar `/.auth/me`.

Importante: si el despliegue compila la web en GitHub Actions, esa variable tambien debe existir en
`Settings > Secrets and variables > Actions > Variables` del repositorio GitHub, porque Vite lee
`VITE_ADMIN_EMAILS` en tiempo de build. La variable creada solo en Azure no entra en el bundle
estatico que se publica.

La pagina espera un endpoint de resumen en `/api/usage/summary` para cargar:

- accesos totales
- usuarios unicos
- secciones mas visitadas
- enlaces mas pulsados
- actividad por dia
- actividad por usuario

## Despliegue en Azure Static Web Apps

El proyecto incluye `staticwebapp.config.json` con fallback a `index.html`, necesario para una SPA. Tambien incluye el directorio `api/` para la analitica de uso y `.github/workflows/azure-static-web-apps-blue-sky-015473603.yml` como workflow base de GitHub Actions.

1. Repositorio en GitHub.
2. Crear la Static Web App en Azure conectada al repositorio.
3. Configurar `AZURE_STATIC_WEB_APPS_API_TOKEN_BLUE_SKY_015473603` como secreto en GitHub.
4. El workflow activo se llama `Deploy Intranet - Azure Static Web Apps`.
5. El despliegue de produccion vigente es `https://blue-sky-015473603.7.azurestaticapps.net/`.
6. El workflow construye `dist` antes de desplegar y publica tambien la carpeta `api/`.
7. En Azure Static Web Apps añade `AZURE_STORAGE_CONNECTION_STRING` y, si quieres, `USAGE_TABLE_NAME` para la analitica de uso.

## Notas de diseno tecnico

- React y componentes reutilizables para acelerar nuevas secciones.
- Tailwind CSS para iteracion visual rapida y consistente.
- JSON versionado como fuente inicial de contenido.
- Header y navegacion superior pensados para evolucionar a rutas reales.
- Buscador global con filtrado por contenidos versionados y catalogo SharePoint sincronizable.

## Ventanas de sincronizacion

- `news`: ejecucion diaria a las 09:10 hora de Madrid y ventana de busqueda limitada a 3 dias.
- `events`: ejecucion quincenal los dias 1 y 16 a las 06:20 UTC y ventana de busqueda limitada a 45 dias.
