export type StatusTone = 'success' | 'warning' | 'info' | 'neutral' | 'critical';

export type QuickLink = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: string;
  status: string;
  tone: StatusTone;
};

export type Assistant = {
  id: string;
  title: string;
  description: string;
  owner: string;
  status: string;
  tone: StatusTone;
  tags: string[];
  href: string;
};

export type NewsItem = {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  status: string;
  tone: StatusTone;
  href?: string;
  source?: string;
  url?: string;
  summary?: string;
  rawMeta?: {
    briefingTitle?: string;
    dateText?: string;
    totalNews?: number;
    newsletterSource?: string;
    sectionCategory?: string;
    sectionExpectedCount?: number;
    itemNumber?: number;
    marketLine?: string;
    sourceLine?: string;
    subject?: string;
  };
};

export type DocumentItem = {
  id: string;
  title: string;
  description: string;
  area: string;
  updatedAt: string;
  href: string;
  status: string;
  tone: StatusTone;
};

export type SharePointResourceScope = 'team' | 'projects';

export type SharePointResource = {
  id: string;
  title: string;
  description: string;
  repository: string;
  scope: SharePointResourceScope;
  category: string;
  itemType: 'folder' | 'file';
  parentTitle?: string;
  path?: string;
  itemCount?: number;
  updatedAt: string;
  href: string;
  status: string;
  tone: StatusTone;
  tags: string[];
};

export type SharePointRepository = {
  id: string;
  title: string;
  description: string;
  owner: string;
  href: string;
  updatedAt: string;
  status: string;
  tone: StatusTone;
  resourceCount: number;
  tags: string[];
};

export type SharePointCatalog = {
  repositories: SharePointRepository[];
  resources: SharePointResource[];
};

export type InternalApp = {
  id: string;
  title: string;
  description: string;
  owner: string;
  href: string;
  status: string;
  tone: StatusTone;
  icon: string;
};

export type EventWorkSchedule = 'laboral' | 'fuera_horario';

export type EventItem = {
  id: string;
  title: string;
  organization: string;
  format: string;
  category: string;
  startDate: string;
  endDate: string;
  timezone: string;
  workSchedule: EventWorkSchedule;
  url: string;
  cta: string;
  source: string;
  tags: string[];
  dateText?: string;
  timeText?: string;
};

export type RoadmapItem = {
  id: string;
  title: string;
  description: string;
  quarter: string;
  status: string;
  tone: StatusTone;
};
