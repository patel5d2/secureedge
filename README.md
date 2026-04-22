# SecureEdge

A **Zero Trust Network Access (ZTNA)** platform — similar to Tailscale / Twingate — providing policy-driven application access, device posture checks, and real-time security monitoring.

## Features

- **Identity-aware proxy model** with three personas: end user, admin, and helpdesk/SOC
- **Policy engine** — WHO × WHAT × CONDITIONS rule evaluation with live test sandbox
- **Device posture** scoring (managed, disk encryption, OS)
- **Audit log** — every access event appended and queryable
- **Live SOC dashboard** — SSE-driven real-time event feed
- **Mock IdP** — simulated Azure AD / Okta flow for local development

## Prerequisites

- Node.js 18+
- Docker + Docker Compose
- npm 9+

## Quick start

```bash
# From the repo root
npm run setup    # installs, starts Postgres, runs migrations, seeds data
npm run dev      # runs backend (:3001) and frontend (:5173) together
```

Open [http://localhost:5173](http://localhost:5173).

### Test credentials

All seeded accounts use password `password`:

| Email | Role | Lands on |
| --- | --- | --- |
| `admin@secureedge.dev` | admin | `/admin` |
| `helpdesk@secureedge.dev` | helpdesk | `/helpdesk` |
| `user@secureedge.dev` | user | `/portal` |

Extra seeded users: `alex.chen@secureedge.dev`, `morgan.kim@secureedge.dev`, `sam.rivera@secureedge.dev`, plus 10 more across departments.

MFA code in dev: **`123456`** always works.

## Architecture

```
secureedge/
├── apps/
│   ├── frontend/   React 18 + TS + Vite + Tailwind + React Router v6
│   └── backend/    Node + Express + TS + pg (raw SQL)
└── docker-compose.yml   Postgres + Redis
```

### Backend layout

```
apps/backend/src/
├── db/
│   ├── client.ts              pg Pool
│   ├── migrate.ts             runs migrations/*.sql in order
│   ├── seed.ts                idempotent seed script
│   └── migrations/001_initial.sql
├── middleware/                auth / rbac / rateLimit
├── routes/                    auth, portal, admin, helpdesk, events
├── services/                  policyEngine, postureCheck, auditLog
└── index.ts                   Express bootstrap
```

### Frontend layout

```
apps/frontend/src/
├── design-system/
│   ├── tokens.ts              color / spacing / radius / shadow constants
│   └── components/            Button, Input, Card, Badge, Table, Modal, Toast, Avatar, StatusDot, Spinner
├── layouts/                   AuthLayout, PortalLayout, AdminLayout, HelpdeskLayout
├── pages/
│   ├── auth/                  Login, MFAChallenge, AccessDenied
│   ├── portal/                PortalHome, AppDetail, MySessions, MyDevices, Profile
│   ├── admin/                 AdminHome, PoliciesList, PolicyEditor, UsersList, UserDetail, Applications, AuditLog
│   └── helpdesk/              LiveDashboard, AlertsQueue, UserLookup, DeviceFleet
├── hooks/                     useAuth, useToast, useRealtime (SSE)
└── lib/                       api (typed fetch), mock-data
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run setup` | install deps, start Postgres, migrate, seed |
| `npm run dev` | run backend + frontend concurrently |
| `npm run build` | type-check and bundle both apps |
| `npm run db:up` / `db:down` | start / stop docker services |
| `npm run db:migrate` | run SQL migrations |
| `npm run db:seed` | re-seed (safe to re-run) |
| `npm run db:reset` | wipe & re-seed from scratch |

## Security model (dev defaults)

- **JWT** in `httpOnly` + `SameSite=Strict` cookie (1h TTL)
- **CSRF** double-submit cookie on state-changing routes
- **Rate limit** — 5/minute per IP on `/api/auth/*`
- **Zod** validates every request body server-side
- **helmet** sets CSP, frame-ancestors, etc.
- **Secrets** only live in backend env; the React bundle never sees `JWT_SECRET`

## Policy engine

A policy's `rules` JSON:

```json
{
  "who":  { "groups": ["..."], "users": ["..."] },
  "what": { "applications": ["..."] },
  "conditions": [
    { "type": "device_managed", "value": true },
    { "type": "disk_encrypted", "value": true },
    { "type": "mfa_verified",   "value": true },
    { "type": "time_range",     "start": "09:00", "end": "18:00" },
    { "type": "country",        "allowed": ["US", "CA"] }
  ]
}
```

`POST /api/admin/policies/:id/simulate` runs the evaluator live from the Policy Editor.

## License

MIT — internal demo project.
