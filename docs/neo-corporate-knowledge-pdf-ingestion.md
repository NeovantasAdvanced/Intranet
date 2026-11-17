# Integración local de la base de conocimiento corporativo de Neo

Este paquete prepara seis documentos internos en PDF para el pipeline existente. No incluye `07_criterios_respuesta_neo.md`: contiene instrucciones de comportamiento y la fuente de verdad para la personalidad de Neo sigue siendo `api/_shared/neo-persona.cjs`.

## Archivos preparados

Los PDFs están en `docs/neo-knowledge-pdfs/`:

`01_identidad_y_propuesta_valor.pdf`, `02_economia_conductual.pdf`, `03_analitica_conversacional.pdf`, `04_participantes_sinteticos.pdf`, `05_ia_aplicada_y_soluciones.pdf` y `06_casos_uso_banca_seguros_telco.pdf`.

Se validaron localmente con `pdf-parse` y `buildDocumentIndex`. Los seis generan texto, páginas y fragmentos utilizables. Los contenidos de casos de uso son conceptuales y no deben presentarse como proyectos ejecutados, clientes, cifras ni resultados acreditados.

## Incorporación controlada

1. Revisar internamente los seis PDFs y aprobar las afirmaciones corporativas antes de subirlos.
2. En el contenedor privado de originales, subirlos bajo `originals/neo-knowledge/`. No subir el documento 07.
3. Como administrador, indexar cada archivo mediante `POST /api/knowledge-index` con, por ejemplo:

   `{"document":"originals/neo-knowledge/01_identidad_y_propuesta_valor.pdf"}`

   Repetir para los seis nombres. El endpoint obtiene el ETag del PDF y escribe el índice con creación condicional; no editar índices a mano.
4. Ejecutar `POST /api/knowledge-publish` como administrador. La publicación valida todos los originales e índices y actualiza `knowledge-index/current.json` de forma condicionada. No editar `current.json` manualmente.
5. Verificar con `GET /api/knowledge-search` y pruebas de `knowledge-ask` que las referencias proceden de los fragmentos recuperados.

El publicador interno valida el conjunto de originales del contenedor. Por ello, los seis nuevos PDFs deben estar indexados y los documentos internos existentes deben conservar sus índices antes de publicar; si falta uno, la publicación se detiene y mantiene el manifiesto anterior.

## Revisión y límites

La incorporación debe hacerse primero en un entorno aislado con sus propios blobs y SAS. Este cambio no sube archivos ni modifica Azure. Las afirmaciones sensibles (capacidades, metodologías, sectores y ejemplos) requieren validación corporativa antes de cualquier publicación.
