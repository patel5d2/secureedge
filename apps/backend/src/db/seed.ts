import bcrypt from 'bcryptjs';
import { pool } from './client';
import { redactDatabaseUrl, config } from '../config';

interface SeedUser {
  email: string;
  full_name: string;
  department: string;
  role: 'admin' | 'helpdesk' | 'user';
  isAlias?: boolean;
}

const SEED_USERS: SeedUser[] = [
  // alias role shortcuts
  {
    email: 'admin@secureedge.dev',
    full_name: 'Admin User',
    department: 'IT',
    role: 'admin',
    isAlias: true,
  },
  {
    email: 'helpdesk@secureedge.dev',
    full_name: 'Helpdesk User',
    department: 'IT Ops',
    role: 'helpdesk',
    isAlias: true,
  },
  {
    email: 'user@secureedge.dev',
    full_name: 'Regular User',
    department: 'Engineering',
    role: 'user',
    isAlias: true,
  },
  // persona
  {
    email: 'alex.chen@secureedge.dev',
    full_name: 'Alex Chen',
    department: 'Engineering',
    role: 'user',
  },
  {
    email: 'morgan.kim@secureedge.dev',
    full_name: 'Morgan Kim',
    department: 'Security',
    role: 'admin',
  },
  {
    email: 'sam.rivera@secureedge.dev',
    full_name: 'Sam Rivera',
    department: 'IT Ops',
    role: 'helpdesk',
  },
  // cast
  {
    email: 'jordan.lee@secureedge.dev',
    full_name: 'Jordan Lee',
    department: 'Sales',
    role: 'user',
  },
  {
    email: 'priya.sharma@secureedge.dev',
    full_name: 'Priya Sharma',
    department: 'Engineering',
    role: 'user',
  },
  {
    email: 'ravi.patel@secureedge.dev',
    full_name: 'Ravi Patel',
    department: 'Finance',
    role: 'user',
  },
  {
    email: 'elena.garcia@secureedge.dev',
    full_name: 'Elena Garcia',
    department: 'Marketing',
    role: 'user',
  },
  {
    email: 'hiro.tanaka@secureedge.dev',
    full_name: 'Hiro Tanaka',
    department: 'Engineering',
    role: 'user',
  },
  {
    email: 'fatima.okafor@secureedge.dev',
    full_name: 'Fatima Okafor',
    department: 'Sales',
    role: 'user',
  },
  {
    email: 'chen.wei@secureedge.dev',
    full_name: 'Chen Wei',
    department: 'Executive',
    role: 'user',
  },
  {
    email: 'lucas.muller@secureedge.dev',
    full_name: 'Lucas Müller',
    department: 'Contractors',
    role: 'user',
  },
  {
    email: 'amara.diallo@secureedge.dev',
    full_name: 'Amara Diallo',
    department: 'HR',
    role: 'user',
  },
  {
    email: 'noah.goldberg@secureedge.dev',
    full_name: 'Noah Goldberg',
    department: 'Contractors',
    role: 'user',
  },
];

interface SeedGroup {
  name: string;
  description: string;
  source: 'idp_synced' | 'local';
}

const SEED_GROUPS: SeedGroup[] = [
  { name: 'Engineering', description: 'Engineering department', source: 'idp_synced' },
  { name: 'Sales', description: 'Sales department', source: 'idp_synced' },
  { name: 'Security', description: 'Security team', source: 'idp_synced' },
  { name: 'IT Ops', description: 'IT operations', source: 'idp_synced' },
  { name: 'Executive', description: 'Executive leadership', source: 'idp_synced' },
  { name: 'Contractors', description: 'External contractors', source: 'local' },
  { name: 'HR', description: 'Human resources', source: 'idp_synced' },
  { name: 'Finance', description: 'Finance department', source: 'idp_synced' },
  { name: 'Marketing', description: 'Marketing department', source: 'idp_synced' },
  { name: 'All Employees', description: 'All employees', source: 'local' },
];

interface SeedApp {
  slug: string;
  name: string;
  description: string;
  icon_url: string;
  app_url: string;
  protocol: 'https' | 'ssh' | 'rdp';
  required_mfa: boolean;
}

const SEED_APPS: SeedApp[] = [
  {
    slug: 'jira',
    name: 'Jira',
    description: 'Issue tracking',
    icon_url: 'https://cdn.secureedge.dev/icons/jira.png',
    app_url: 'https://jira.secureedge.dev',
    protocol: 'https',
    required_mfa: true,
  },
  {
    slug: 'salesforce',
    name: 'Salesforce',
    description: 'CRM',
    icon_url: 'https://cdn.secureedge.dev/icons/salesforce.png',
    app_url: 'https://salesforce.secureedge.dev',
    protocol: 'https',
    required_mfa: true,
  },
  {
    slug: 'github',
    name: 'GitHub Enterprise',
    description: 'Source control',
    icon_url: 'https://cdn.secureedge.dev/icons/github.png',
    app_url: 'https://github.secureedge.dev',
    protocol: 'https',
    required_mfa: true,
  },
  {
    slug: 'notion',
    name: 'Notion',
    description: 'Docs and wiki',
    icon_url: 'https://cdn.secureedge.dev/icons/notion.png',
    app_url: 'https://notion.secureedge.dev',
    protocol: 'https',
    required_mfa: false,
  },
  {
    slug: 'aws-console',
    name: 'AWS Console',
    description: 'Cloud infrastructure',
    icon_url: 'https://cdn.secureedge.dev/icons/aws.png',
    app_url: 'https://aws.secureedge.dev',
    protocol: 'https',
    required_mfa: true,
  },
  {
    slug: 'grafana',
    name: 'Grafana',
    description: 'Observability',
    icon_url: 'https://cdn.secureedge.dev/icons/grafana.png',
    app_url: 'https://grafana.secureedge.dev',
    protocol: 'https',
    required_mfa: true,
  },
  {
    slug: 'hr-portal',
    name: 'Internal HR Portal',
    description: 'HR self-service',
    icon_url: 'https://cdn.secureedge.dev/icons/hr.png',
    app_url: 'https://hr.secureedge.dev',
    protocol: 'https',
    required_mfa: true,
  },
  {
    slug: 'customer-db',
    name: 'Customer DB',
    description: 'Production database access',
    icon_url: 'https://cdn.secureedge.dev/icons/db.png',
    app_url: 'ssh://db.secureedge.dev',
    protocol: 'ssh',
    required_mfa: true,
  },
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomIp(): string {
  const prefixes = ['203.0.113', '198.51.100', '192.0.2'];
  return `${pick(prefixes)}.${randomInt(1, 254)}`;
}

async function truncateAll(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('[seed] truncating tables...');
  await pool.query(
    `TRUNCATE alerts, sessions, access_events, devices, policies,
     user_groups, applications, groups, users CASCADE`
  );
}

export async function runSeed(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[seed] using db: ${redactDatabaseUrl(config.DATABASE_URL)}`);
  await truncateAll();

  const passwordHash = await bcrypt.hash('password', 8);

  // Users
  const userIds: Record<string, string> = {};
  for (const u of SEED_USERS) {
    const lastLoginOffsetHrs = randomInt(1, 7 * 24);
    const r = await pool.query<{ id: string }>(
      `INSERT INTO users (email, full_name, department, role, status, password_hash, last_login_at)
       VALUES ($1, $2, $3, $4, 'active', $5, now() - ($6 || ' hours')::interval)
       RETURNING id`,
      [u.email, u.full_name, u.department, u.role, passwordHash, String(lastLoginOffsetHrs)]
    );
    userIds[u.email] = r.rows[0].id;
  }
  // eslint-disable-next-line no-console
  console.log(`[seed] users: ${Object.keys(userIds).length}`);

  // Groups
  const groupIds: Record<string, string> = {};
  for (const g of SEED_GROUPS) {
    const r = await pool.query<{ id: string }>(
      `INSERT INTO groups (name, description, source)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [g.name, g.description, g.source]
    );
    groupIds[g.name] = r.rows[0].id;
  }
  // eslint-disable-next-line no-console
  console.log(`[seed] groups: ${Object.keys(groupIds).length}`);

  // user_groups: each user into department + All Employees + role groups for Security/Executive/Contractors
  for (const u of SEED_USERS) {
    const uid = userIds[u.email];
    const memberships = new Set<string>();
    // All Employees
    memberships.add(groupIds['All Employees']);
    // Department
    if (groupIds[u.department]) memberships.add(groupIds[u.department]);
    // Role-based additions
    if (u.role === 'admin' && u.department === 'Security') {
      memberships.add(groupIds['Security']);
    }
    // Special case: admin alias is in IT but not dept group; still include IT Ops? Spec says department mapping handles it.
    // No additional role-based group beyond what's already added.

    for (const gid of memberships) {
      await pool.query(
        `INSERT INTO user_groups (user_id, group_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [uid, gid]
      );
    }
  }
  // eslint-disable-next-line no-console
  console.log('[seed] user_groups populated');

  // Applications
  const appIds: Record<string, string> = {};
  for (const a of SEED_APPS) {
    const r = await pool.query<{ id: string }>(
      `INSERT INTO applications (name, slug, description, icon_url, app_url, protocol, required_mfa)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [a.name, a.slug, a.description, a.icon_url, a.app_url, a.protocol, a.required_mfa]
    );
    appIds[a.slug] = r.rows[0].id;
  }
  // eslint-disable-next-line no-console
  console.log(`[seed] applications: ${Object.keys(appIds).length}`);

  // Policies
  const adminId = userIds['morgan.kim@secureedge.dev'];

  const policies = [
    {
      name: 'Engineering Full Access',
      description: 'Engineers get full dev stack access',
      status: 'active',
      priority: 10,
      rules: {
        who: { groups: [groupIds['Engineering']] },
        what: {
          applications: [appIds['github'], appIds['jira'], appIds['aws-console']],
        },
        conditions: [
          { type: 'device_managed', value: true },
          { type: 'disk_encrypted', value: true },
        ],
      },
    },
    {
      name: 'Sales CRM Access',
      description: 'Sales team access to Salesforce',
      status: 'active',
      priority: 20,
      rules: {
        who: { groups: [groupIds['Sales']] },
        what: { applications: [appIds['salesforce']] },
        conditions: [{ type: 'mfa_verified', value: true }],
      },
    },
    {
      name: 'Contractor Limited',
      description: 'Contractors restricted to business hours',
      status: 'active',
      priority: 30,
      rules: {
        who: { groups: [groupIds['Contractors']] },
        what: { applications: [appIds['notion']] },
        conditions: [
          { type: 'device_managed', value: true },
          { type: 'time_range', start: '09:00', end: '18:00' },
        ],
      },
    },
    {
      name: 'Security Team - All Apps',
      description: 'Security team full access',
      status: 'active',
      priority: 5,
      rules: {
        who: { groups: [groupIds['Security']] },
        what: { applications: Object.values(appIds) },
        conditions: [
          { type: 'mfa_verified', value: true },
          { type: 'device_managed', value: true },
        ],
      },
    },
    {
      name: 'Executive Access',
      description: 'Executives access',
      status: 'active',
      priority: 15,
      rules: {
        who: { groups: [groupIds['Executive']] },
        what: {
          applications: [
            appIds['jira'],
            appIds['notion'],
            appIds['grafana'],
            appIds['hr-portal'],
          ],
        },
        conditions: [{ type: 'mfa_verified', value: true }],
      },
    },
    {
      name: 'Universal Notion',
      description: 'Everyone gets Notion',
      status: 'active',
      priority: 200,
      rules: {
        who: { groups: [groupIds['All Employees']] },
        what: { applications: [appIds['notion']] },
        conditions: [],
      },
    },
    {
      name: 'Draft: Restrict HR to HR group',
      description: 'HR portal locked to HR team',
      status: 'draft',
      priority: 50,
      rules: {
        who: { groups: [groupIds['HR']] },
        what: { applications: [appIds['hr-portal']] },
        conditions: [
          { type: 'device_managed', value: true },
          { type: 'country', allowed: ['US', 'CA'] },
        ],
      },
    },
  ];

  for (const p of policies) {
    await pool.query(
      `INSERT INTO policies (name, description, status, priority, rules, created_by)
       VALUES ($1, $2, $3::policy_status, $4, $5::jsonb, $6)`,
      [p.name, p.description, p.status, p.priority, JSON.stringify(p.rules), adminId]
    );
  }
  // eslint-disable-next-line no-console
  console.log(`[seed] policies: ${policies.length}`);

  // Devices — every user except 3 alias users gets one device
  const deviceTargets = SEED_USERS.filter((u) => !u.isAlias);
  const osMix = ['macOS 14', 'Windows 11', 'Ubuntu 22.04'];
  const deviceIds: Record<string, string> = {};

  // Pre-allocate quarantined and pending slots
  // 2 quarantined, 1 pending among deviceTargets
  const shuffled = [...deviceTargets].sort(() => Math.random() - 0.5);
  const quarantineTargets = new Set<string>(
    shuffled.slice(0, 2).map((u) => u.email)
  );
  const pendingTarget = shuffled[2]?.email;

  for (const u of deviceTargets) {
    const uid = userIds[u.email];
    let enrollment: 'pending' | 'enrolled' | 'quarantined' = 'enrolled';
    let managed = true;
    let diskEncrypted = true;
    let score = randomInt(85, 100);

    if (quarantineTargets.has(u.email)) {
      enrollment = 'quarantined';
      managed = false;
      diskEncrypted = false;
      score = randomInt(40, 60);
    } else if (u.email === pendingTarget) {
      enrollment = 'pending';
      managed = false;
      diskEncrypted = false;
      score = 0;
    }

    // Forced: Alex Chen / Morgan Kim
    if (u.email === 'alex.chen@secureedge.dev') {
      enrollment = 'enrolled';
      managed = true;
      diskEncrypted = true;
      score = 92;
    }
    if (u.email === 'morgan.kim@secureedge.dev') {
      enrollment = 'enrolled';
      managed = true;
      diskEncrypted = true;
      score = 100;
    }

    const os = pick(osMix);
    const r = await pool.query<{ id: string }>(
      `INSERT INTO devices (user_id, name, os, enrollment_status, last_posture_check, posture_score, managed, disk_encrypted)
       VALUES ($1, $2, $3, $4::device_enrollment, now() - ($5 || ' hours')::interval, $6, $7, $8)
       RETURNING id`,
      [
        uid,
        `${u.full_name.split(' ')[0]}'s ${os.split(' ')[0]}`,
        os,
        enrollment,
        String(randomInt(1, 48)),
        score,
        managed,
        diskEncrypted,
      ]
    );
    deviceIds[u.email] = r.rows[0].id;
  }
  // eslint-disable-next-line no-console
  console.log(`[seed] devices: ${Object.keys(deviceIds).length}`);

  // Access events — 500
  const policyRows = await pool.query<{ id: string }>(
    'SELECT id FROM policies WHERE status = $1',
    ['active']
  );
  const activePolicyIds = policyRows.rows.map((r) => r.id);

  const denyReasons = [
    'device_not_managed',
    'disk_not_encrypted',
    'mfa_required',
    'outside_time_window',
    'country_blocked',
    'no_matching_policy',
  ];
  const countries = ['US', 'US', 'US', 'US', 'CA', 'GB', 'DE', 'IN'];
  const allUserEmails = Object.keys(userIds);
  const allAppSlugs = Object.keys(appIds);

  // Build bulk insert with parameters in batches to stay under parameter limits
  const events: Array<{
    ts: Date;
    userId: string;
    appId: string;
    deviceId: string | null;
    policyId: string | null;
    outcome: 'allowed' | 'denied';
    deny?: string;
    ip: string;
    country: string;
  }> = [];

  const now = Date.now();
  for (let i = 0; i < 500; i++) {
    const offsetMs = Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000);
    const ts = new Date(now - offsetMs);
    const email = pick(allUserEmails);
    const appSlug = pick(allAppSlugs);
    const outcome: 'allowed' | 'denied' = Math.random() < 0.8 ? 'allowed' : 'denied';
    events.push({
      ts,
      userId: userIds[email],
      appId: appIds[appSlug],
      deviceId: deviceIds[email] || null,
      policyId:
        outcome === 'allowed' && activePolicyIds.length > 0
          ? pick(activePolicyIds)
          : null,
      outcome,
      deny: outcome === 'denied' ? pick(denyReasons) : undefined,
      ip: randomIp(),
      country: pick(countries),
    });
  }

  // Insert in chunks of 100
  for (let i = 0; i < events.length; i += 100) {
    const chunk = events.slice(i, i + 100);
    const values: unknown[] = [];
    const placeholders: string[] = [];
    chunk.forEach((e, idx) => {
      const base = idx * 9;
      placeholders.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}::access_outcome, $${base + 7}, $${base + 8}::inet, $${base + 9})`
      );
      values.push(
        e.ts,
        e.userId,
        e.appId,
        e.deviceId,
        e.policyId,
        e.outcome,
        e.deny || null,
        e.ip,
        e.country
      );
    });
    await pool.query(
      `INSERT INTO access_events
         (timestamp, user_id, application_id, device_id, policy_id, outcome, deny_reason, ip_address, geo_country)
       VALUES ${placeholders.join(', ')}`,
      values
    );
  }
  // eslint-disable-next-line no-console
  console.log(`[seed] access_events: ${events.length}`);

  // Sessions — 8 current
  const sessionUsers = [...allUserEmails].sort(() => Math.random() - 0.5).slice(0, 8);
  for (const email of sessionUsers) {
    await pool.query(
      `INSERT INTO sessions (user_id, device_id, started_at, expires_at, ip_address, user_agent)
       VALUES ($1, $2, now() - interval '10 minutes', now() + interval '1 hour', $3::inet, $4)`,
      [
        userIds[email],
        deviceIds[email] || null,
        randomIp(),
        'Mozilla/5.0 SecureEdge-Client',
      ]
    );
  }
  // eslint-disable-next-line no-console
  console.log(`[seed] sessions: ${sessionUsers.length}`);

  // Alerts — 5 open
  const quarantinedEmail = Array.from(quarantineTargets)[0];
  const alerts = [
    {
      severity: 'critical',
      type: 'impossible_travel',
      userEmail: 'alex.chen@secureedge.dev',
      context: { from: 'US', to: 'RU', window_minutes: 12 },
    },
    {
      severity: 'high',
      type: 'brute_force',
      userEmail: 'user@secureedge.dev',
      context: { attempts: 17, ip: '203.0.113.45' },
    },
    {
      severity: 'high',
      type: 'posture_failed',
      userEmail: quarantinedEmail,
      context: { posture_score: 42, reason: 'disk_not_encrypted' },
    },
    {
      severity: 'medium',
      type: 'new_device_registered',
      userEmail: 'jordan.lee@secureedge.dev',
      context: { device_name: 'Unknown laptop' },
    },
    {
      severity: 'low',
      type: 'unusual_location',
      userEmail: 'priya.sharma@secureedge.dev',
      context: { country: 'NG' },
    },
  ];
  for (const a of alerts) {
    const uid = a.userEmail ? userIds[a.userEmail] : null;
    const did = a.userEmail ? deviceIds[a.userEmail] || null : null;
    const offsetMin = randomInt(5, 60 * 23);
    await pool.query(
      `INSERT INTO alerts (severity, type, user_id, device_id, status, triggered_at, context)
       VALUES ($1::alert_severity, $2, $3, $4, 'open', now() - ($5 || ' minutes')::interval, $6::jsonb)`,
      [a.severity, a.type, uid, did, String(offsetMin), JSON.stringify(a.context)]
    );
  }
  // eslint-disable-next-line no-console
  console.log(`[seed] alerts: ${alerts.length}`);

  // eslint-disable-next-line no-console
  console.log('[seed] done');
}

if (require.main === module) {
  runSeed()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error('[seed] error', err);
      await pool.end().catch(() => undefined);
      process.exit(1);
    });
}
