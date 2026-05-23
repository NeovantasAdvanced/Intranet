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

export type RoadmapItem = {
  id: string;
  title: string;
  description: string;
  quarter: string;
  status: string;
  tone: StatusTone;
};
