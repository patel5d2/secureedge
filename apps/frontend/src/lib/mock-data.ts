// Static sample data used only for first-render skeletons before real API data arrives.
// These shapes mirror the backend API contracts so components can type-check against them.

import type {
  AccessEvent,
  AppCard,
  Alert,
  Device,
  Group,
  OverviewStats,
  Policy,
  Session,
  User,
} from './api';

export const sampleUser: User = {
  id: 'u_sample',
  email: 'you@secureedge.dev',
  name: 'Sample User',
  role: 'employee',
  department: 'Engineering',
  status: 'active',
  last_login_at: new Date().toISOString(),
};

export const sampleApps: AppCard[] = [
  { id: 'a1', slug: 'github', name: 'GitHub', description: 'Source control and code review.', accessible: true },
  { id: 'a2', slug: 'jira', name: 'Jira', description: 'Issue and project tracking.', accessible: true },
  { id: 'a3', slug: 'salesforce', name: 'Salesforce', description: 'Customer relationship management.', accessible: false, posture_required: true },
];

export const sampleSessions: Session[] = [];
export const sampleDevices: Device[] = [];
export const sampleGroups: Group[] = [];
export const samplePolicies: Policy[] = [];
export const sampleAlerts: Alert[] = [];
export const sampleEvents: AccessEvent[] = [];

export const sampleOverview: OverviewStats = {
  activeUsers24h: 0,
  policiesActive: 0,
  denials24h: 0,
  criticalAlerts: 0,
  trend: { labels: [], allowed: [], denied: [] },
};
