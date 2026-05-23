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

1. Configurar permisos y variables.
2. Ejecutar `Actions > Sync Outlook news > Run workflow`.
3. Revisar el log `Outlook news synced`.
4. Si hay cambios, revisar el commit `chore: sync Outlook news`.
