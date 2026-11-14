# Acceso documental inicial

La primera capa backend accede al contenedor privado de Azure Blob Storage sin publicar documentos ni incorporarlos al frontend.

- Módulo: `api/_shared/knowledge-blob.cjs`.
- Diagnóstico administrativo: `GET /api/admin/knowledge/diagnostics`.
- Prefijo consultado: `originals/`.
- El diagnóstico devuelve únicamente nombres, tamaños, fechas de modificación y estado de conexión.
- La descarga está limitada por el módulo al prefijo `originals/` y todavía no forma parte de la interfaz.

Variables backend necesarias en Azure Static Web Apps:

- `KNOWLEDGE_STORAGE_ACCOUNT`: nombre de la cuenta, sin secreto.
- `KNOWLEDGE_CONTAINER`: nombre del contenedor.
- `KNOWLEDGE_BLOB_SAS_TOKEN`: SAS de backend; no usar prefijo `VITE_` ni incluirlo en el frontend.

En esta fase se utiliza SAS porque el plan Free de Static Web Apps no dispone de la identidad administrada requerida. El SAS debe tener el alcance mínimo de lectura y listado sobre el contenedor y debe rotarse fuera del repositorio.
