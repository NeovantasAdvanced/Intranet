# Base de conocimiento corporativo Neovantas

Esta primera estructura prepara el inventario de fuentes para un futuro asistente conversacional. No implementa chatbot, procesamiento documental, embeddings ni llamadas a modelos.

## Archivos

- `src/data/knowledge-categories.json`: categorías lógicas de conocimiento.
- `src/data/knowledge-inventory.json`: inventario inicial de 15 fuentes documentales.
- `src/data/structured-knowledge.json`: contenedor editable para contactos, enlaces, beneficios, preguntas frecuentes y procedimientos breves.

Los archivos JSON están separados de los componentes de React para poder actualizarlos sin cambiar la lógica de la aplicación. Ningún documento corporativo se copia al repositorio: el campo `source` queda vacío hasta confirmar la ubicación original y sus permisos.

## Estados

- `pendiente`: fuente identificada, todavía no validada.
- `validado`: solo debe usarse después de una revisión formal.
- `requiere-revision`: necesita revisión prioritaria antes de utilizarse como conocimiento normativo.
- `obsoleto`: no debe utilizarse para responder sobre la situación vigente.

Ninguna fuente del inventario está marcada como `validado`. `Facilidades y Descansos` queda como `requiere-revision`, según el inventario inicial solicitado.

## Reglas de seguridad

- No almacenar PDFs, documentos privados, credenciales ni contenido confidencial en Git.
- Mantener `source` apuntando al almacenamiento corporativo autorizado, previsiblemente SharePoint o almacenamiento privado de Azure.
- Resolver los permisos antes de entregar una fuente al futuro asistente.
- No utilizar fuentes `pendiente`, `requiere-revision` u `obsoleto` como normativa definitiva.
- Mantener los datos de usuarios y control de acceso fuera de esta base de conocimiento.

## Próximas ampliaciones

1. Completar `source`, responsable, versión, fecha y nivel de acceso sin inventar valores.
2. Validar formalmente cada documento con su responsable.
3. Incorporar en `structured-knowledge.json` únicamente contenido breve, estable y validado.
4. Crear un proceso posterior de extracción de texto desde almacenamiento privado.
5. Añadir una capa de recuperación con filtros por categoría, vigencia y permisos.
6. Incorporar búsqueda semántica o embeddings cuando el volumen y la calidad documental lo justifiquen.
