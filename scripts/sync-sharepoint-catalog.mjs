import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const graphBaseUrl = 'https://graph.microsoft.com/v1.0';
const outputPath = path.resolve('src/data/sharepointCatalog.json');

const sharePointConfig = {
  hostname: process.env.SHAREPOINT_HOSTNAME ?? 'neovantas.sharepoint.com',
  sitePath: process.env.SHAREPOINT_SITE_PATH ?? '/sites/AdvancedAnalytics',
  siteId: process.env.SHAREPOINT_SITE_ID,
  repositories: [
    {
      id: 'equipo-neovantas',
      title: 'Carpetas equipo Neovantas',
      description: 'Documentacion operativa y recursos compartidos para el equipo Advanced Analytics.',
      owner: 'Advanced Analytics',
      folderPath: 'Carpetas equipo Neovantas',
      scope: 'team',
      status: 'Equipo',
      tone: 'success',
      tags: ['documentacion', 'equipo', 'politicas', 'seguridad'],
      excludeExtensions: ['.kdbx'],
    },
    {
      id: 'rp-proyectos',
      title: 'Repositorio de proyectos (RP)',
      description: 'Documentos finales, fichas y carpetas de proyectos realizados para consulta del equipo.',
      owner: 'Knowledge',
      folderPath: 'RP',
      scope: 'projects',
      status: 'Proyectos',
      tone: 'info',
      tags: ['proyectos', 'fichas', 'documentos finales', 'clientes'],
      excludeNames: ['RP'],
      includeChildFiles: true,
    },
  ],
};

function readEnv(...names) {
  return names.map((name) => process.env[name]).find(Boolean);
}

function normalizeSearch(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function encodeDrivePath(value) {
  return value.split('/').map(encodeURIComponent).join('/');
}

function toDateOnly(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function latestResourceDate(resources, fallbackItems) {
  const timestamps = resources
    .map((item) => item.updatedAt)
    .concat(fallbackItems.map((item) => item.lastModifiedDateTime ?? item.createdDateTime).filter(Boolean))
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) {
    return toDateOnly();
  }

  return toDateOnly(new Date(Math.max(...timestamps)).toISOString());
}

function getFileExtension(item) {
  return item.file?.fileExtension ?? path.extname(item.name);
}

function shouldIncludeItem(item, repository) {
  const excludedNames = new Set(repository.excludeNames ?? []);
  const excludedExtensions = new Set(repository.excludeExtensions ?? []);
  const extension = getFileExtension(item).toLowerCase();

  return !excludedNames.has(item.name) && !excludedExtensions.has(extension);
}

function teamMetadata(item) {
  const key = normalizeSearch(item.name);

  if (key.includes('politica')) {
    return {
      category: 'Politicas',
      description: 'Politicas corporativas disponibles para consulta del equipo.',
      tone: 'critical',
      tags: ['politicas', 'rrhh', 'cumplimiento'],
    };
  }

  if (key.includes('sgsi')) {
    return {
      category: 'Seguridad',
      description: 'Repositorio publico del SGSI con controles y evidencias de seguridad.',
      tone: 'critical',
      tags: ['sgsi', 'seguridad', 'cumplimiento'],
    };
  }

  if (key.includes('prevencion') || key.includes('riesgos')) {
    return {
      category: 'Personas',
      description: 'Documentacion de prevencion, seguridad y salud laboral.',
      tone: 'warning',
      tags: ['prl', 'prevencion', 'personas'],
    };
  }

  if (key.includes('reunion')) {
    return {
      category: 'Comunicacion',
      description: 'Actas, materiales y contenidos de reuniones de oficina.',
      tone: 'info',
      tags: ['reuniones', 'oficina', 'comunicacion'],
    };
  }

  if (key.includes('calendario')) {
    return {
      category: 'Equipo',
      description: 'Calendarios y planificacion interna del equipo.',
      tone: 'neutral',
      tags: ['calendario', 'planificacion', 'equipo'],
    };
  }

  if (key.includes('reporting') || key.includes('irecursos')) {
    return {
      category: 'Herramientas',
      description: 'Materiales de reporting y recursos asociados a iRecursos.',
      tone: 'neutral',
      tags: ['reporting', 'irecursos', 'herramientas'],
    };
  }

  if (key.includes('rsc') || key.includes('voluntariado')) {
    return {
      category: 'Cultura',
      description: 'Iniciativas de responsabilidad social corporativa y voluntariado.',
      tone: 'neutral',
      tags: ['rsc', 'voluntariado', 'cultura'],
    };
  }

  if (key.includes('retorno')) {
    return {
      category: 'Personas',
      description: 'Recursos para retorno, organizacion y trabajo presencial.',
      tone: 'neutral',
      tags: ['retorno', 'oficina', 'personas'],
    };
  }

  if (key.includes('codigo')) {
    return {
      category: 'Normativa',
      description: 'Normas y pautas internas de uso para el equipo.',
      tone: 'neutral',
      tags: ['normativa', 'uso interno', 'equipo'],
    };
  }

  return {
    category: item.folder ? 'Cliente' : 'Archivo',
    description: item.folder
      ? `Carpeta compartida del equipo para documentacion de ${item.name}.`
      : `Archivo compartido del equipo: ${item.name}.`,
    tone: 'neutral',
    tags: ['documentacion', 'equipo'],
  };
}

function projectMetadata(item) {
  const key = normalizeSearch(item.name);

  if (item.file) {
    const extension = getFileExtension(item).replace('.', '').toUpperCase();
    const isProjectSheet = key.includes('ficha proyecto') || key.includes('ficha de proyecto');
    const isFinalDocument =
      key.startsWith('doc ') ||
      key.startsWith('doc -') ||
      key.includes('documento final') ||
      key.includes('entregable final');
    const category = extension === 'XLSX'
      ? 'Indice'
      : isProjectSheet
        ? 'Ficha proyecto'
        : isFinalDocument
          ? 'Documento final'
          : 'Archivo';
    const status = isProjectSheet ? 'Ficha' : isFinalDocument ? 'Doc final' : extension || 'Archivo';
    const tone = extension === 'XLSX'
      ? 'success'
      : isProjectSheet
        ? 'info'
        : isFinalDocument
          ? 'success'
          : 'neutral';

    return {
      category,
      description:
        extension === 'XLSX'
          ? 'Indice maestro de proyectos realizados en el repositorio RP.'
          : isProjectSheet
            ? `Ficha del proyecto ${item.parentName ?? ''}.`.trim()
            : isFinalDocument
              ? `Documento final del proyecto ${item.parentName ?? ''}.`.trim()
              : `Archivo del repositorio de proyectos: ${item.name}.`,
      status,
      tone,
      tags: [
        ...(extension === 'XLSX' ? ['indice'] : []),
        ...(isProjectSheet ? ['ficha'] : []),
        ...(isFinalDocument ? ['documento final'] : []),
        'proyecto',
        'clientes',
        ...(item.parentName ? [item.parentName] : []),
      ],
    };
  }

  return {
    category: 'Proyecto realizado',
    description: `Carpeta con fichas y entregables del proyecto para ${item.name}.`,
    status: 'Proyecto',
    tone: 'neutral',
    tags: ['proyecto', 'ficha', 'documento final', 'cliente'],
  };
}

function slugify(value, prefix) {
  const slug = normalizeSearch(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${prefix}-${slug || 'item'}`;
}

function toResource(item, repository, parentItem) {
  const itemType = item.folder ? 'folder' : 'file';
  const enrichedItem = parentItem ? { ...item, parentName: parentItem.name } : item;
  const metadata = repository.scope === 'team' ? teamMetadata(enrichedItem) : projectMetadata(enrichedItem);
  const parentTitle = parentItem?.name;

  return {
    id: slugify(parentTitle ? `${parentTitle}-${item.name}` : item.name, repository.scope === 'team' ? 'team' : 'project'),
    title: item.name,
    description: metadata.description,
    repository: repository.title,
    scope: repository.scope,
    category: metadata.category,
    itemType,
    ...(parentTitle ? { parentTitle, path: `${parentTitle} / ${item.name}` } : {}),
    ...(item.folder ? { itemCount: item.folder.childCount ?? 0 } : {}),
    updatedAt: toDateOnly(item.lastModifiedDateTime ?? item.createdDateTime),
    href: item.webUrl,
    status: metadata.status ?? (item.folder ? 'Carpeta' : 'Archivo'),
    tone: metadata.tone,
    tags: metadata.tags,
  };
}

async function getAccessToken() {
  const existingToken = readEnv('GRAPH_ACCESS_TOKEN', 'MS_GRAPH_ACCESS_TOKEN');

  if (existingToken) {
    return existingToken;
  }

  const tenantId = readEnv('SHAREPOINT_TENANT_ID', 'AZURE_TENANT_ID', 'TENANT_ID');
  const clientId = readEnv('SHAREPOINT_CLIENT_ID', 'AZURE_CLIENT_ID', 'CLIENT_ID');
  const clientSecret = readEnv('SHAREPOINT_CLIENT_SECRET', 'AZURE_CLIENT_SECRET', 'CLIENT_SECRET');

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      'Missing Graph credentials. Set SHAREPOINT_TENANT_ID, SHAREPOINT_CLIENT_ID and SHAREPOINT_CLIENT_SECRET.',
    );
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
    scope: 'https://graph.microsoft.com/.default',
  });

  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    throw new Error(`Graph auth failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  return payload.access_token;
}

async function graphRequest(accessToken, url) {
  const requestUrl = url.startsWith('https://') ? url : `${graphBaseUrl}${url}`;
  const response = await fetch(requestUrl, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Graph request failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function graphCollection(accessToken, url) {
  const items = [];
  let nextUrl = url;

  while (nextUrl) {
    const payload = await graphRequest(accessToken, nextUrl);
    items.push(...(payload.value ?? []));
    nextUrl = payload['@odata.nextLink'];
  }

  return items;
}

async function getSite(accessToken) {
  if (sharePointConfig.siteId) {
    return { id: sharePointConfig.siteId };
  }

  return graphRequest(
    accessToken,
    `/sites/${sharePointConfig.hostname}:${sharePointConfig.sitePath}`,
  );
}

async function listFolderItems(accessToken, siteId, folderPath) {
  const encodedPath = encodeDrivePath(folderPath);
  return graphCollection(accessToken, `/sites/${siteId}/drive/root:/${encodedPath}:/children?$top=200`);
}

async function listNestedFileResources(accessToken, siteId, repository, folders) {
  if (!repository.includeChildFiles) {
    return [];
  }

  const nestedResources = [];

  for (const folder of folders.filter((item) => item.folder)) {
    const childItems = (await listFolderItems(accessToken, siteId, `${repository.folderPath}/${folder.name}`))
      .filter((item) => item.file)
      .filter((item) => shouldIncludeItem(item, repository))
      .sort((left, right) => left.name.localeCompare(right.name, 'es', { sensitivity: 'base' }));

    nestedResources.push(...childItems.map((item) => toResource(item, repository, folder)));
  }

  return nestedResources;
}

async function buildCatalog() {
  const accessToken = await getAccessToken();
  const site = await getSite(accessToken);
  const repositories = [];
  const resources = [];

  for (const repository of sharePointConfig.repositories) {
    const items = (await listFolderItems(accessToken, site.id, repository.folderPath))
      .filter((item) => shouldIncludeItem(item, repository))
      .sort((left, right) => left.name.localeCompare(right.name, 'es', { sensitivity: 'base' }));

    const folderResources = items.map((item) => toResource(item, repository));
    const nestedFileResources = await listNestedFileResources(accessToken, site.id, repository, items);
    const repositoryResources = [...folderResources, ...nestedFileResources];

    repositories.push({
      id: repository.id,
      title: repository.title,
      description: repository.description,
      owner: repository.owner,
      href: `https://${sharePointConfig.hostname}${sharePointConfig.sitePath}/Documentos%20compartidos/${encodeDrivePath(repository.folderPath)}`,
      updatedAt: latestResourceDate(repositoryResources, items),
      status: repository.status,
      tone: repository.tone,
      resourceCount: repositoryResources.length,
      tags: repository.tags,
    });

    resources.push(...repositoryResources);
  }

  return { repositories, resources };
}

async function main() {
  const catalog = await buildCatalog();
  const json = `${JSON.stringify(catalog, null, 2)}\n`;

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, json, 'utf8');

  console.log(
    `SharePoint catalog synced: ${catalog.repositories.length} repositories, ${catalog.resources.length} resources.`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
