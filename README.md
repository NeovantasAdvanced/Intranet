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
```

## Contenidos

Los contenidos iniciales viven en `src/data`. Cada JSON representa una seccion del portal:

- `quickLinks.json`: accesos frecuentes.
- `assistants.json`: GPTs y asistentes internos.
- `news.json`: comunicaciones y novedades.
- `documents.json`: documentacion corporativa.
- `apps.json`: aplicaciones internas.
- `roadmap.json`: evolucion prevista, incluida Mesa IA y autenticacion futura.

## Autenticacion futura

No hay login real en este MVP. La integracion recomendada para la siguiente fase es:

- Usar autenticacion integrada de Azure Static Web Apps con proveedor Microsoft Entra ID.
- Proteger rutas mediante `staticwebapp.config.json` y roles.
- Leer identidad de usuario desde `/.auth/me` cuando la aplicacion se ejecute en Azure.
- Crear una capa `src/auth` en la siguiente iteracion para encapsular usuario, roles y estados de sesion.
- Mantener este MVP funcionando localmente sin dependencia de Microsoft 365.

## Despliegue en Azure Static Web Apps

El proyecto incluye `staticwebapp.config.json` con fallback a `index.html`, necesario para una SPA. El flujo esperado es GitHub + Azure Static Web Apps:

1. Repositorio en GitHub.
2. Workflow de Azure Static Web Apps apuntando al build de Vite.
3. `app_location: "/"`.
4. `output_location: "dist"`.

## Notas de diseno tecnico

- React y componentes reutilizables para acelerar nuevas secciones.
- Tailwind CSS para iteracion visual rapida y consistente.
- JSON versionado como fuente inicial de contenido.
- Sidebar y header pensados para evolucionar a navegacion real con rutas.
- Buscador visual preparado; la logica de filtrado global queda para una iteracion posterior.
