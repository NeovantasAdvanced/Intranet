# Sincronizar noticias desde Outlook

La intranet puede regenerar `src/data/news.json` leyendo correos de Outlook con Microsoft Graph. El workflow no copia adjuntos ni guarda el cuerpo completo: solo publica asunto, resumen `bodyPreview`, fecha, enlace a Outlook y metadatos visibles en la intranet.

## Flujo

1. Llega el correo diario de noticias a un buzon o carpeta de Outlook.
2. El workflow `Sync Outlook news` se ejecuta de lunes a viernes a las 06:35 UTC o manualmente.
3. El script `scripts/sync-outlook-news.mjs` lee los mensajes recientes.
4. Se filtra por remitente, asunto o carpeta.
5. Se actualiza `src/data/news.json`.
6. Si hay cambios, GitHub Actions hace commit y se dispara el despliegue de Azure Static Web Apps.

## Configuracion recomendada

Lo mas seguro es crear una carpeta o buzon dedicado, por ejemplo:

- Buzon compartido: `intranet.news@neovantas.com`
- Carpeta: `Intranet`

Despues, crear una regla en Outlook o Exchange para mover el correo diario de noticias a esa carpeta. Asi se evita importar correos no deseados.

En la revision inicial del correo conectado se ha encontrado una carpeta candidata:

- Carpeta: `INFO-NEOVANTAS`
- Folder id: `AAMkAGZkMDc3OTI2LTFiODUtNGQyOC05YjExLTU5MGUzMmY2MGM0YwAuAAAAAADYAFAgqiUITKtkPiPJzrA6AQDgZ5BpEs7DRIQFp4o3bFPcAAAMoarGAAA=`

Esa carpeta contiene newsletters y correos comerciales mezclados. No debe usarse sin filtro; configura `NEWS_SENDER` y/o `NEWS_SUBJECT_CONTAINS`.

## Permisos Microsoft Graph

La app de Entra ID usada por el workflow necesita leer el buzon de noticias.

Opcion directa:

- Microsoft Graph > Application permission > `Mail.Read`
- Admin consent

Recomendacion de seguridad:

- Limitar el acceso de la app solo al buzon de noticias con una Application Access Policy de Exchange Online.
- Si se prefiere separar permisos, crear una app distinta para noticias y usar secrets `NEWS_*` en vez de reutilizar `SHAREPOINT_*`.

## Secrets en GitHub

Obligatorio:

- `NEWS_MAILBOX_USER_ID`: userPrincipalName o id del buzon que recibe las noticias.

Opcional si se reutiliza la app de SharePoint con permiso `Mail.Read`:

- `NEWS_TENANT_ID`
- `NEWS_CLIENT_ID`
- `NEWS_CLIENT_SECRET`

Si no se definen estos tres, el workflow intenta reutilizar:

- `SHAREPOINT_TENANT_ID`
- `SHAREPOINT_CLIENT_ID`
- `SHAREPOINT_CLIENT_SECRET`

## Variables en GitHub

Configurar en `Settings > Secrets and variables > Actions > Variables`:

- `NEWS_MAIL_FOLDER_ID`: carpeta a leer. Por defecto `inbox`.
- `NEWS_SENDER`: remitente permitido, por ejemplo `comunicacion@neovantas.com`.
- `NEWS_SUBJECT_CONTAINS`: texto que debe contener el asunto, por ejemplo `Noticias`.
- `NEWS_CATEGORY`: categoria visible en intranet. Por defecto `Comunicacion`.
- `NEWS_STATUS`: badge visible. Por defecto `Nuevo`.
- `NEWS_SOURCE`: origen visible. Por defecto `Outlook`.
- `NEWS_LOOKBACK_DAYS`: ventana de busqueda. Por defecto `14`.
- `NEWS_MAX_ITEMS`: maximo de noticias de correo. Por defecto `10`.
- `NEWS_ALLOW_UNFILTERED_INBOX`: solo usar `true` si el Inbox del buzon contiene exclusivamente noticias publicables.

El script rechaza importar todo el Inbox si no hay `NEWS_SENDER`, `NEWS_SUBJECT_CONTAINS`, carpeta dedicada o `NEWS_ALLOW_UNFILTERED_INBOX=true`.

## Prueba

Para probar sin dejar todas las variables creadas:

1. Configurar los permisos Graph y el secret `NEWS_MAILBOX_USER_ID`, o introducir el buzon en el formulario manual.
2. Ejecutar `Actions > Sync Outlook news > Run workflow`.
3. Rellenar `mailbox_user_id`, `mail_folder_id`, `sender` y/o `subject_contains`.
4. Revisar el log `Outlook news synced`.
5. Si hay cambios, revisar el commit `chore: sync Outlook news`.

Ejemplo de prueba con la carpeta candidata:

- `mailbox_user_id`: buzon que contiene `INFO-NEOVANTAS`, por ejemplo `info@neovantas.com`
- `mail_folder_id`: `AAMkAGZkMDc3OTI2LTFiODUtNGQyOC05YjExLTU5MGUzMmY2MGM0YwAuAAAAAADYAFAgqiUITKtkPiPJzrA6AQDgZ5BpEs7DRIQFp4o3bFPcAAAMoarGAAA=`
- `subject_contains`: texto estable del correo diario de noticias
- `sender`: remitente exacto si lo conocemos

Cuando el filtro este validado, guardar esos mismos valores como variables de Actions para que la sincronizacion diaria funcione sin intervencion manual.
