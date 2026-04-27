import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

// ── Auth schemas ──────────────────────────────────────────────────────

const LoginSchema = registry.register(
  'LoginRequest',
  z.object({
    email: z.string().email().openapi({ example: 'admin@secureedge.dev' }),
    password: z.string().min(1).openapi({ example: 'password' }),
  })
);

const MfaSchema = registry.register(
  'MfaRequest',
  z.object({
    code: z.string().min(1).openapi({ example: '123456' }),
  })
);

const UserSchema = registry.register(
  'User',
  z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    full_name: z.string(),
    role: z.enum(['admin', 'helpdesk', 'user']),
    department: z.string().nullable(),
    status: z.enum(['active', 'suspended', 'deactivated']),
    last_login_at: z.string().nullable(),
  })
);

const LoginResponseSchema = registry.register(
  'LoginResponse',
  z.object({
    user: UserSchema,
    mfaRequired: z.boolean(),
    nextStep: z.enum(['mfa', 'portal']),
  })
);

const MfaResponseSchema = registry.register(
  'MfaResponse',
  z.object({
    user: UserSchema,
    ok: z.boolean(),
  })
);

// ── Auth paths ────────────────────────────────────────────────────────

registry.registerPath({
  method: 'post',
  path: '/api/auth/login',
  description: 'Authenticate with email and password. Returns a pre-MFA JWT.',
  request: { body: { content: { 'application/json': { schema: LoginSchema } } } },
  responses: {
    200: { description: 'Login succeeded, MFA required next', content: { 'application/json': { schema: LoginResponseSchema } } },
    401: { description: 'Invalid credentials' },
    403: { description: 'Account not active' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/auth/mfa',
  description: 'Verify MFA code (TOTP or WebAuthn). Upgrades the JWT to mfa=true.',
  request: { body: { content: { 'application/json': { schema: MfaSchema } } } },
  responses: {
    200: { description: 'MFA verified', content: { 'application/json': { schema: MfaResponseSchema } } },
    401: { description: 'Invalid MFA code' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/auth/logout',
  description: 'Revoke the current session and clear the auth cookie.',
  responses: { 200: { description: 'Logged out' } },
});

registry.registerPath({
  method: 'get',
  path: '/api/auth/me',
  description: 'Get the current authenticated user.',
  responses: {
    200: { description: 'Current user', content: { 'application/json': { schema: z.object({ user: UserSchema }) } } },
    401: { description: 'Not authenticated' },
  },
});

// ── SSO paths ─────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/auth/sso/config',
  description: 'Check if OIDC SSO is enabled and get the login URL.',
  responses: {
    200: {
      description: 'SSO configuration',
      content: {
        'application/json': {
          schema: z.object({
            enabled: z.boolean(),
            providerName: z.string().optional(),
            loginUrl: z.string().optional(),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/auth/sso/login',
  description: 'Redirect to the OIDC provider for authentication.',
  responses: { 302: { description: 'Redirect to IdP authorization endpoint' } },
});

registry.registerPath({
  method: 'get',
  path: '/api/auth/sso/callback',
  description: 'OIDC callback. Handles token exchange, JIT provisioning, and session creation.',
  responses: { 302: { description: 'Redirect to /portal after successful authentication' } },
});

// ── Portal paths ──────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/portal/apps',
  description: 'List all applications the current user can see, with access status.',
  responses: { 200: { description: 'Application list' } },
});

registry.registerPath({
  method: 'get',
  path: '/api/portal/apps/{id}',
  description: 'Get detailed application info with access simulation result.',
  responses: { 200: { description: 'Application detail with policy evaluation' } },
});

registry.registerPath({
  method: 'get',
  path: '/api/portal/sessions',
  description: 'List the current user\'s active and recent sessions.',
  responses: { 200: { description: 'Session list' } },
});

registry.registerPath({
  method: 'get',
  path: '/api/portal/devices',
  description: 'List devices registered to the current user.',
  responses: { 200: { description: 'Device list' } },
});

// ── Admin paths ───────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/admin/overview',
  description: 'Admin dashboard overview stats (active users, denials, alerts).',
  responses: { 200: { description: 'Overview statistics' } },
});

registry.registerPath({
  method: 'get',
  path: '/api/admin/policies',
  description: 'List all policies with pagination.',
  responses: { 200: { description: 'Policy list' } },
});

registry.registerPath({
  method: 'post',
  path: '/api/admin/policies',
  description: 'Create a new access policy.',
  responses: { 201: { description: 'Policy created' } },
});

registry.registerPath({
  method: 'get',
  path: '/api/admin/users',
  description: 'List all users with pagination.',
  responses: { 200: { description: 'User list' } },
});

registry.registerPath({
  method: 'get',
  path: '/api/admin/audit-log',
  description: 'Query the append-only access event log with filters and pagination.',
  responses: { 200: { description: 'Paginated audit events' } },
});

// ── Helpdesk paths ────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/helpdesk/dashboard',
  description: 'Helpdesk SOC dashboard stats.',
  responses: { 200: { description: 'Dashboard counters' } },
});

registry.registerPath({
  method: 'get',
  path: '/api/helpdesk/alerts',
  description: 'List security alerts with filtering.',
  responses: { 200: { description: 'Alert list' } },
});

registry.registerPath({
  method: 'get',
  path: '/api/events/stream',
  description: 'SSE stream of real-time access events. Requires authentication.',
  responses: { 200: { description: 'Server-sent event stream (text/event-stream)' } },
});

// ── Health / Metrics ──────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/health',
  description: 'Health check — returns DB and Redis status.',
  responses: {
    200: {
      description: 'Healthy',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
            uptime: z.number(),
            db: z.enum(['ok', 'down']),
            redis: z.enum(['ok', 'down']),
          }),
        },
      },
    },
  },
});

// ── Generate ──────────────────────────────────────────────────────────

const generator = new OpenApiGeneratorV31(registry.definitions);

export const openApiDoc = generator.generateDocument({
  openapi: '3.1.0',
  info: {
    title: 'SecureEdge ZTNA API',
    version: '1.0.0',
    description:
      'Zero Trust Network Access platform API. Policy-driven application access, device posture checks, and real-time security monitoring.',
    contact: { name: 'SecureEdge', url: 'https://github.com/secureedge' },
    license: { name: 'MIT' },
  },
  servers: [{ url: 'http://localhost:3001', description: 'Local development' }],
});
