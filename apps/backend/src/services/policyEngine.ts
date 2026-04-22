import { pool } from '../db/client';
import {
  ConditionCheck,
  Policy,
  PolicyCondition,
  PolicyRules,
  SimulateContext,
  SimulateResult,
} from '../types';

interface DeviceCtxRow {
  id: string;
  managed: boolean;
  disk_encrypted: boolean;
  enrollment_status: string;
  registered_at: Date;
}

async function getUserGroupIds(userId: string): Promise<string[]> {
  const r = await pool.query<{ group_id: string }>(
    'SELECT group_id FROM user_groups WHERE user_id = $1',
    [userId]
  );
  return r.rows.map((row) => row.group_id);
}

async function getPrimaryDevice(userId: string): Promise<DeviceCtxRow | null> {
  const r = await pool.query<DeviceCtxRow>(
    `SELECT id, managed, disk_encrypted, enrollment_status, registered_at
       FROM devices
       WHERE user_id = $1 AND enrollment_status = 'enrolled'
       ORDER BY registered_at DESC
       LIMIT 1`,
    [userId]
  );
  return r.rows[0] || null;
}

function parseHHMM(s: string): number {
  // returns minutes since midnight
  const [h, m] = s.split(':').map((x) => parseInt(x, 10));
  return h * 60 + m;
}

function evaluateCondition(
  cond: PolicyCondition,
  ctx: Required<Omit<SimulateContext, 'country' | 'now'>> & {
    country?: string;
    now: Date;
  }
): ConditionCheck {
  switch (cond.type) {
    case 'device_managed': {
      const passed = ctx.deviceManaged === cond.value;
      return {
        type: cond.type,
        passed,
        detail: passed ? undefined : `expected device_managed=${cond.value}`,
      };
    }
    case 'disk_encrypted': {
      const passed = ctx.diskEncrypted === cond.value;
      return {
        type: cond.type,
        passed,
        detail: passed ? undefined : `expected disk_encrypted=${cond.value}`,
      };
    }
    case 'mfa_verified': {
      const passed = ctx.mfaVerified === cond.value;
      return {
        type: cond.type,
        passed,
        detail: passed ? undefined : `expected mfa_verified=${cond.value}`,
      };
    }
    case 'time_range': {
      const now = ctx.now;
      const minutes = now.getHours() * 60 + now.getMinutes();
      const start = parseHHMM(cond.start);
      const end = parseHHMM(cond.end);
      const passed = minutes >= start && minutes <= end;
      return {
        type: cond.type,
        passed,
        detail: passed
          ? undefined
          : `outside ${cond.start}-${cond.end} (now ${now.toISOString()})`,
      };
    }
    case 'country': {
      if (!ctx.country) {
        return {
          type: cond.type,
          passed: false,
          detail: 'country unknown',
        };
      }
      const passed = cond.allowed.includes(ctx.country);
      return {
        type: cond.type,
        passed,
        detail: passed
          ? undefined
          : `country ${ctx.country} not in ${cond.allowed.join(',')}`,
      };
    }
    default: {
      // unknown condition type — fail safe
      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type: (cond as any).type || 'unknown',
        passed: false,
        detail: 'unknown condition type',
      };
    }
  }
}

function conditionReasonKey(type: string): string {
  switch (type) {
    case 'device_managed':
      return 'device_not_managed';
    case 'disk_encrypted':
      return 'disk_not_encrypted';
    case 'mfa_verified':
      return 'mfa_required';
    case 'time_range':
      return 'outside_time_window';
    case 'country':
      return 'country_blocked';
    default:
      return 'condition_failed';
  }
}

function policyMatchesSubject(
  rules: PolicyRules,
  userId: string,
  groupIds: string[]
): boolean {
  const who = rules.who || {};
  if (who.users && who.users.includes(userId)) return true;
  if (who.groups && who.groups.some((g) => groupIds.includes(g))) return true;
  return false;
}

function policyMatchesApp(rules: PolicyRules, appId: string): boolean {
  const apps = rules.what?.applications || [];
  return apps.includes(appId);
}

// ── Policy cache (30s TTL, invalidated on admin CRUD) ─────────────────
let policyCache: { policies: Policy[]; cachedAt: number } | null = null;
const POLICY_CACHE_TTL_MS = 30_000;

/** Call this after any policy create / update / delete to bust the cache. */
export function invalidatePolicyCache(): void {
  policyCache = null;
}

async function loadActivePolicies(): Promise<Policy[]> {
  if (policyCache && Date.now() - policyCache.cachedAt < POLICY_CACHE_TTL_MS) {
    return policyCache.policies;
  }
  const r = await pool.query<Policy>(
    `SELECT id, name, description, status, priority, rules, created_by, created_at, updated_at
       FROM policies
       WHERE status = 'active'
       ORDER BY priority ASC, created_at ASC`
  );
  policyCache = { policies: r.rows, cachedAt: Date.now() };
  return r.rows;
}

function buildContext(
  device: DeviceCtxRow | null,
  overrides: Partial<SimulateContext>
): Required<Omit<SimulateContext, 'country' | 'now'>> & {
  country?: string;
  now: Date;
} {
  return {
    deviceManaged:
      overrides.deviceManaged !== undefined
        ? overrides.deviceManaged
        : device?.managed ?? false,
    diskEncrypted:
      overrides.diskEncrypted !== undefined
        ? overrides.diskEncrypted
        : device?.disk_encrypted ?? false,
    mfaVerified:
      overrides.mfaVerified !== undefined ? overrides.mfaVerified : true,
    country: overrides.country,
    now: overrides.now || new Date(),
  };
}

function evaluatePolicy(
  policy: Policy,
  ctx: ReturnType<typeof buildContext>
): { allowed: boolean; checks: ConditionCheck[]; failedType?: string } {
  const conditions: PolicyCondition[] = policy.rules?.conditions || [];
  const checks: ConditionCheck[] = [];
  for (const cond of conditions) {
    const check = evaluateCondition(cond, ctx);
    checks.push(check);
    if (!check.passed) {
      return { allowed: false, checks, failedType: cond.type };
    }
  }
  return { allowed: true, checks };
}

export async function simulate(
  userId: string,
  appId: string,
  ctx?: Partial<SimulateContext>
): Promise<SimulateResult> {
  const [groupIds, device, policies] = await Promise.all([
    getUserGroupIds(userId),
    getPrimaryDevice(userId),
    loadActivePolicies(),
  ]);

  const effectiveCtx = buildContext(device, ctx || {});

  let firstFailure: { reason: string; checks: ConditionCheck[] } | null = null;

  for (const policy of policies) {
    if (!policyMatchesSubject(policy.rules || {}, userId, groupIds)) continue;
    if (!policyMatchesApp(policy.rules || {}, appId)) continue;

    const result = evaluatePolicy(policy, effectiveCtx);
    if (result.allowed) {
      return {
        outcome: 'allowed',
        policyId: policy.id,
        policyName: policy.name,
        conditions_checked: result.checks,
      };
    }
    if (!firstFailure && result.failedType) {
      firstFailure = {
        reason: conditionReasonKey(result.failedType),
        checks: result.checks,
      };
    }
  }

  if (firstFailure) {
    return {
      outcome: 'denied',
      reason: firstFailure.reason,
      conditions_checked: firstFailure.checks,
    };
  }

  return { outcome: 'denied', reason: 'no_matching_policy' };
}

export async function simulateAgainstPolicy(
  userId: string,
  appId: string,
  policyId: string,
  ctx?: Partial<SimulateContext>
): Promise<SimulateResult> {
  const policyRow = await pool.query<Policy>(
    `SELECT id, name, description, status, priority, rules, created_by, created_at, updated_at
       FROM policies WHERE id = $1`,
    [policyId]
  );
  const policy = policyRow.rows[0];
  if (!policy) {
    return { outcome: 'denied', reason: 'policy_not_found' };
  }
  const [groupIds, device] = await Promise.all([
    getUserGroupIds(userId),
    getPrimaryDevice(userId),
  ]);
  const effectiveCtx = buildContext(device, ctx || {});
  const subjectMatches = policyMatchesSubject(policy.rules || {}, userId, groupIds);
  const appMatches = policyMatchesApp(policy.rules || {}, appId);
  if (!subjectMatches) {
    return {
      outcome: 'denied',
      reason: 'subject_not_in_policy',
      policyId: policy.id,
      policyName: policy.name,
    };
  }
  if (!appMatches) {
    return {
      outcome: 'denied',
      reason: 'app_not_in_policy',
      policyId: policy.id,
      policyName: policy.name,
    };
  }
  const result = evaluatePolicy(policy, effectiveCtx);
  if (result.allowed) {
    return {
      outcome: 'allowed',
      policyId: policy.id,
      policyName: policy.name,
      conditions_checked: result.checks,
    };
  }
  return {
    outcome: 'denied',
    reason: result.failedType ? conditionReasonKey(result.failedType) : 'denied',
    policyId: policy.id,
    policyName: policy.name,
    conditions_checked: result.checks,
  };
}

export async function userCanAccess(userId: string, appId: string): Promise<boolean> {
  const r = await simulate(userId, appId);
  return r.outcome === 'allowed';
}
