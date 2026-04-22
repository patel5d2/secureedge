// Typed fetch wrapper + shared TypeScript types for the SecureEdge backend API.

const BASE_URL: string =
  (import.meta.env && (import.meta.env as { VITE_API_BASE_URL?: string }).VITE_API_BASE_URL) || '/api';

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function readCsrfCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)se_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function buildQuery(query?: Record<string, unknown>): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

async function request<T>(method: string, path: string, body?: unknown, query?: Record<string, unknown>): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (method !== 'GET') {
    const csrf = readCsrfCookie();
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }
  const res = await fetch(`${BASE_URL}${path}${buildQuery(query)}`, {
    method,
    credentials: 'include',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  if (!res.ok) {
    const msg =
      (parsed && typeof parsed === 'object' && 'error' in parsed && typeof (parsed as { error?: unknown }).error === 'string'
        ? (parsed as { error: string }).error
        : undefined) ||
      (parsed && typeof parsed === 'object' && 'message' in parsed && typeof (parsed as { message?: unknown }).message === 'string'
        ? (parsed as { message: string }).message
        : undefined) ||
      res.statusText ||
      `Request failed (${res.status})`;
    throw new ApiError(msg, res.status, parsed);
  }
  return parsed as T;
}

export const api = {
  get: <T>(path: string, query?: Record<string, unknown>) => request<T>('GET', path, undefined, query),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};

// =============================================================================
// Shared types
// =============================================================================

export type UserRole = 'admin' | 'helpdesk' | 'employee' | 'user';
export type UserStatus = 'active' | 'suspended' | 'invited';

export interface User {
  id: string;
  email: string;
  name: string;
  full_name?: string;
  role: UserRole;
  department?: string | null;
  status?: UserStatus;
  last_login_at?: string | null;
  created_at?: string;
  avatar_url?: string | null;
  mfa_enabled?: boolean;
  groups_count?: number;
  devices_count?: number;
}

export interface Group {
  id: string;
  name: string;
  description?: string | null;
  source?: 'local' | 'idp_synced';
  member_count?: number;
  created_at?: string;
}

export interface AppCard {
  id: string;
  slug: string;
  name: string;
  description: string;
  url?: string;
  icon?: string | null;
  protocol?: 'http' | 'https' | 'ssh' | 'rdp' | 'tcp';
  mfa_required?: boolean;
  policy_count?: number;
  accessible: boolean;
  posture_required?: boolean;
  reason?: string | null;
}

export interface Application extends AppCard {
  url: string;
  app_url?: string;
  slug: string;
  protocol: 'http' | 'https' | 'ssh' | 'rdp' | 'tcp';
  required_mfa?: boolean;
  created_at?: string;
}

export interface Device {
  id: string;
  user_id?: string;
  owner_name?: string;
  owner_email?: string;
  name: string;
  os: string;
  os_version?: string;
  serial_number?: string;
  enrollment_status: 'enrolled' | 'pending' | 'quarantined' | 'revoked' | 'unenrolled';
  posture_score: number;
  managed: boolean;
  encrypted?: boolean;
  disk_encrypted?: boolean;
  firewall_enabled?: boolean;
  last_posture_check?: string | null;
  last_seen?: string | null;
  last_seen_at?: string | null;
  registered_at?: string;
}

export interface Session {
  id: string;
  user_id?: string;
  started_at: string;
  expires_at: string;
  revoked_at?: string | null;
  device_name?: string;
  device_id?: string;
  ip: string;
  user_agent: string;
  status: 'active' | 'revoked' | 'expired';
  country?: string;
}

export type AccessOutcome = 'allow' | 'deny' | 'allowed' | 'denied';

export interface AccessEvent {
  id: string;
  timestamp: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  app_id: string;
  app_name?: string;
  device_id?: string;
  device_name?: string;
  outcome: AccessOutcome;
  deny_reason?: string | null;
  policy_id?: string | null;
  policy_name?: string | null;
  ip: string;
  country?: string;
  lat?: number;
  lon?: number;
  user_agent?: string;
}

export type PolicyStatus = 'draft' | 'active' | 'disabled';

export type PolicyConditionType =
  | 'device_managed'
  | 'disk_encrypted'
  | 'mfa_verified'
  | 'time_range'
  | 'country';

export interface PolicyCondition {
  type: PolicyConditionType;
  value: boolean | string | { start: string; end: string } | string[];
}

export interface PolicyRules {
  who: { groupIds?: string[]; userIds?: string[]; groups?: string[]; users?: string[] };
  what: { appIds?: string[]; applications?: string[] };
  conditions?: PolicyCondition[];
}

export interface Policy {
  id: string;
  name: string;
  description?: string | null;
  status: PolicyStatus;
  priority: number;
  rules: PolicyRules;
  affected_user_count?: number;
  app_count?: number;
  updated_at?: string;
  created_at?: string;
}

export interface SimulateContext {
  deviceManaged?: boolean;
  diskEncrypted?: boolean;
  mfaVerified?: boolean;
  country?: string;
  time?: string;
}

export interface ConditionCheck {
  type: PolicyConditionType;
  passed: boolean;
  detail?: string;
}

export interface SimulateResult {
  allowed: boolean;
  outcome?: string;
  policyId?: string | null;
  policyName?: string | null;
  reason?: string | null;
  conditions_checked?: ConditionCheck[];
}

export interface OverviewStats {
  activeUsers24h: number;
  policiesActive: number;
  denials24h: number;
  criticalAlerts: number;
  trend: { labels: string[]; allowed: number[]; denied: number[] };
}

export interface Alert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  user_id?: string;
  user_name?: string;
  user_email?: string;
  triggered_at: string;
  status: 'open' | 'acknowledged' | 'resolved' | 'false_positive';
  assignee?: string | null;
  context?: Record<string, unknown>;
  message?: string;
}

export interface HelpdeskDashboard {
  activeConnections: number;
  denials24h: number;
  openAlerts: number;
  criticalAlerts: number;
  allowed24h: number;
}

export interface AuditLogPage {
  events: AccessEvent[];
  total: number;
  page: number;
  limit: number;
}

// Convenience composite response types

export interface LoginResponse {
  user: User;
  mfaRequired: boolean;
  nextStep: 'mfa' | 'portal';
}

export interface MfaResponse {
  user: User;
  ok: boolean;
}

export interface MeResponse {
  user: User;
}

export interface AppsResponse {
  apps: AppCard[];
}

export interface AppDetailResponse {
  app: AppCard;
  requirements: { managed: boolean; encrypted: boolean; mfa: boolean };
  accessGroups: Group[];
  simulate: SimulateResult;
}

export interface SessionsResponse {
  sessions: Session[];
}

export interface DevicesResponse {
  devices: Device[];
}

export interface ProfileResponse {
  user: User;
  groups: Group[];
  device: Device | null;
}

export interface PoliciesResponse {
  policies: Policy[];
}

export interface UsersResponse {
  users: User[];
}

export interface GroupsResponse {
  groups: Group[];
}

export interface ApplicationsResponse {
  applications: Application[];
}

export interface RecentEventsResponse {
  events: AccessEvent[];
}

export interface AlertsResponse {
  alerts: Alert[];
}

export interface UserSearchResponse {
  users: User[];
}

export interface UserAccessHistoryResponse {
  events: AccessEvent[];
}
