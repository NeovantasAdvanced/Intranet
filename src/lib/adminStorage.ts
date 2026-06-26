import accessControlSeed from '../data/access-control.json';
import usersAccessSeed from '../data/users-access.json';
import appsSeed from '../data/apps.json';
import documentsSeed from '../data/documents.json';
import quickLinksSeed from '../data/quickLinks.json';
import { type DocumentItem, type InternalApp, type QuickLink } from '../types/content';

export type AccessControlData = {
  admins: {
    allowedEmails: string[];
  };
  repositories: {
    allowedEmails: string[];
  };
};

export type UserAccessRow = {
  name: string;
  email: string;
  department: string;
  jobTitle: string;
  permissions: {
    admin: boolean;
    repositories: boolean;
  };
};

export type ManagedContentData = {
  tools: InternalApp[];
  employeeResources: InternalApp[];
  documents: DocumentItem[];
  quickLinks: QuickLink[];
};

export type AdminStoragePayload = {
  accessControl: AccessControlData;
  usersAccess: UserAccessRow[];
  content: ManagedContentData;
};

const STORAGE_KEY = 'neovantas.admin.storage.v1';

function normalizeEmail(value: string) {
  return String(value ?? '').trim().toLowerCase();
}

function cloneAccessControl(data: AccessControlData): AccessControlData {
  return {
    admins: { allowedEmails: [...data.admins.allowedEmails] },
    repositories: { allowedEmails: [...data.repositories.allowedEmails] },
  };
}

function cloneUsersAccess(data: UserAccessRow[]): UserAccessRow[] {
  return data.map((item) => ({
    ...item,
    permissions: { ...item.permissions },
  }));
}

function cloneContent(data: ManagedContentData): ManagedContentData {
  return {
    tools: data.tools.map((item) => ({ ...item })),
    employeeResources: data.employeeResources.map((item) => ({ ...item })),
    documents: data.documents.map((item) => ({ ...item })),
    quickLinks: data.quickLinks.map((item) => ({ ...item })),
  };
}

function getSeedPayload(): AdminStoragePayload {
  const accessControl = accessControlSeed as AccessControlData;
  const usersAccess = usersAccessSeed as UserAccessRow[];
  const tools = (appsSeed as InternalApp[]).filter((item) => item.category === 'tools');
  const employeeResources = (appsSeed as InternalApp[]).filter((item) => item.category === 'employee');

  return {
    accessControl: cloneAccessControl(accessControl),
    usersAccess: cloneUsersAccess(usersAccess),
    content: {
      tools: tools.map((item) => ({ ...item })),
      employeeResources: employeeResources.map((item) => ({ ...item })),
      documents: (documentsSeed as DocumentItem[]).map((item) => ({ ...item })),
      quickLinks: (quickLinksSeed as QuickLink[]).map((item) => ({ ...item })),
    },
  };
}

function readLocalCache(): AdminStoragePayload | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<AdminStoragePayload>;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return mergeWithSeed(parsed);
  } catch {
    return null;
  }
}

function writeLocalCache(payload: AdminStoragePayload) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function mergeWithSeed(payload?: Partial<AdminStoragePayload> | null): AdminStoragePayload {
  const seed = getSeedPayload();
  return {
    accessControl: cloneAccessControl(payload?.accessControl ?? seed.accessControl),
    usersAccess: cloneUsersAccess(payload?.usersAccess ?? seed.usersAccess),
    content: {
      tools: (payload?.content?.tools ?? seed.content.tools).map((item) => ({ ...item })),
      employeeResources: (payload?.content?.employeeResources ?? seed.content.employeeResources).map((item) => ({ ...item })),
      documents: (payload?.content?.documents ?? seed.content.documents).map((item) => ({ ...item })),
      quickLinks: (payload?.content?.quickLinks ?? seed.content.quickLinks).map((item) => ({ ...item })),
    },
  };
}

async function requestJson(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const text = await response.text();
  let payload: Partial<AdminStoragePayload> = {};

  if (text.trim()) {
    try {
      payload = JSON.parse(text) as Partial<AdminStoragePayload>;
    } catch {
      payload = {} as Partial<AdminStoragePayload>;
    }
  }

  if (!response.ok) {
    const error = new Error(`Request failed: ${response.status} ${response.statusText || ''}`.trim()) as Error & {
      status?: number;
      responseBody?: string;
    };
    error.status = response.status;
    error.responseBody = text;
    throw error;
  }

  return payload;
}

export async function getAccessControl() {
  if (typeof window !== 'undefined') {
    try {
      const payload = await requestJson('/api/admin/access');
      const merged = mergeWithSeed(payload);
      writeLocalCache(merged);
      return merged.accessControl;
    } catch {
      const cached = readLocalCache();
      if (cached) {
        return cached.accessControl;
      }
    }
  }

  return getSeedPayload().accessControl;
}

export async function updateAccessControl(accessControl: AccessControlData) {
  const payload = mergeWithSeed({ accessControl });

  if (typeof window !== 'undefined') {
    writeLocalCache(payload);
  }

  try {
    await requestJson('/api/admin/access', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accessControl: payload.accessControl }),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'No se pudo guardar el control de acceso.';
    const wrapped = new Error(detail) as Error & { status?: number; responseBody?: string };
    if (error && typeof error === 'object') {
      wrapped.status = (error as { status?: number }).status;
      wrapped.responseBody = (error as { responseBody?: string }).responseBody;
    }
    throw wrapped;
  }

  return payload.accessControl;
}

export async function getUsersAccess() {
  if (typeof window !== 'undefined') {
    try {
      const payload = await requestJson('/api/admin/access');
      const merged = mergeWithSeed(payload);
      writeLocalCache(merged);
      return merged.usersAccess;
    } catch {
      const cached = readLocalCache();
      if (cached) {
        return cached.usersAccess;
      }
    }
  }

  return getSeedPayload().usersAccess;
}

export async function updateUserAccess(usersAccess: UserAccessRow[]) {
  const payload = mergeWithSeed({ usersAccess });

  if (typeof window !== 'undefined') {
    writeLocalCache(payload);
  }

  try {
    await requestJson('/api/admin/access', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ usersAccess: payload.usersAccess }),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'No se pudo guardar los permisos de usuarios.';
    const wrapped = new Error(detail) as Error & { status?: number; responseBody?: string };
    if (error && typeof error === 'object') {
      wrapped.status = (error as { status?: number }).status;
      wrapped.responseBody = (error as { responseBody?: string }).responseBody;
    }
    throw wrapped;
  }

  return payload.usersAccess;
}

export async function getManagedContent() {
  if (typeof window !== 'undefined') {
    try {
      const payload = await requestJson('/api/admin/access');
      const merged = mergeWithSeed(payload);
      writeLocalCache(merged);
      return merged.content;
    } catch {
      const cached = readLocalCache();
      if (cached) {
        return cached.content;
      }
    }
  }

  return getSeedPayload().content;
}

export async function updateManagedContent(content: ManagedContentData) {
  const payload = mergeWithSeed({ content });

  if (typeof window !== 'undefined') {
    writeLocalCache(payload);
  }

  try {
    await requestJson('/api/admin/access', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: payload.content }),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'No se pudo guardar el contenido administrado.';
    const wrapped = new Error(detail) as Error & { status?: number; responseBody?: string };
    if (error && typeof error === 'object') {
      wrapped.status = (error as { status?: number }).status;
      wrapped.responseBody = (error as { responseBody?: string }).responseBody;
    }
    throw wrapped;
  }

  return payload.content;
}

export function isManagedAdminEmail(userEmail: string, accessControl?: AccessControlData) {
  const normalized = normalizeEmail(userEmail);
  if (!normalized) return false;
  const control = accessControl ?? getSeedPayload().accessControl;
  return [...control.admins.allowedEmails, ...control.repositories.allowedEmails].map(normalizeEmail).includes(normalized);
}
