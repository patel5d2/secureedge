export type UserRole = 'admin' | 'helpdesk' | 'user';
export type UserStatus = 'active' | 'suspended' | 'deactivated';
export type GroupSource = 'idp_synced' | 'local';
export type AppProtocol = 'https' | 'ssh' | 'rdp';
export type PolicyStatus = 'draft' | 'active' | 'disabled';
export type DeviceEnrollment =
  | 'pending'
  | 'enrolled'
  | 'quarantined'
  | 'revoked';
export type AccessOutcome = 'allowed' | 'denied';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertStatus = 'open' | 'acknowledged' | 'resolved' | 'false_positive';

export interface User {
  id: string;
  external_id: string | null;
  email: string;
  full_name: string;
  department: string | null;
  role: string;
  manager_id: string | null;
  status: UserStatus;
  created_at: Date | string;
  last_login_at: Date | string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  full_name: string;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  source: GroupSource;
  created_at: Date | string;
}

export interface Application {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon_url: string | null;
  app_url: string;
  protocol: AppProtocol;
  required_mfa: boolean;
  created_at: Date | string;
}

export interface PolicyRules {
  who?: {
    users?: string[];
    groups?: string[];
  };
  what?: {
    applications?: string[];
  };
  conditions?: PolicyCondition[];
}

export type PolicyCondition =
  | { type: 'device_managed'; value: boolean }
  | { type: 'disk_encrypted'; value: boolean }
  | { type: 'mfa_verified'; value: boolean }
  | { type: 'time_range'; start: string; end: string }
  | { type: 'country'; allowed: string[] };

export interface Policy {
  id: string;
  name: string;
  description: string | null;
  status: PolicyStatus;
  priority: number;
  rules: PolicyRules;
  created_by: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface Device {
  id: string;
  user_id: string | null;
  name: string;
  os: string | null;
  enrollment_status: DeviceEnrollment;
  last_posture_check: Date | string | null;
  posture_score: number | null;
  managed: boolean;
  disk_encrypted: boolean;
  registered_at: Date | string;
}

export interface AccessEvent {
  id: string;
  timestamp: Date | string;
  user_id: string | null;
  application_id: string | null;
  device_id: string | null;
  policy_id: string | null;
  outcome: AccessOutcome;
  deny_reason: string | null;
  ip_address: string | null;
  geo_country: string | null;
  session_id: string | null;
  raw_event: Record<string, unknown>;
}

export interface Session {
  id: string;
  user_id: string | null;
  device_id: string | null;
  started_at: Date | string;
  expires_at: Date | string;
  revoked_at: Date | string | null;
  ip_address: string | null;
  user_agent: string | null;
}

export interface Alert {
  id: string;
  severity: AlertSeverity;
  type: string;
  user_id: string | null;
  device_id: string | null;
  status: AlertStatus;
  assigned_to: string | null;
  triggered_at: Date | string;
  resolved_at: Date | string | null;
  context: Record<string, unknown>;
}

export interface SimulateContext {
  deviceManaged?: boolean;
  diskEncrypted?: boolean;
  mfaVerified?: boolean;
  country?: string;
  now?: Date;
}

export interface ConditionCheck {
  type: string;
  passed: boolean;
  detail?: string;
}

export interface SimulateResult {
  outcome: AccessOutcome;
  reason?: string;
  policyId?: string;
  policyName?: string;
  conditions_checked?: ConditionCheck[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      sessionId?: string;
      /** True when the JWT contains a verified mfa=true claim. */
      mfaVerified?: boolean;
    }
  }
}
