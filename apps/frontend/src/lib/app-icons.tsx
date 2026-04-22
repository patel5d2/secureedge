import {
  BarChart3,
  Box,
  Cloud,
  Database,
  FileText,
  Github,
  Layers,
  Server,
  Users,
  type LucideIcon,
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  github: Github,
  jira: Layers,
  salesforce: Cloud,
  notion: FileText,
  'aws-console': Server,
  grafana: BarChart3,
  'hr-portal': Users,
  'customer-db': Database,
};

export function iconForSlug(slug?: string): LucideIcon {
  if (!slug) return Box;
  return iconMap[slug] || Box;
}
