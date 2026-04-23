Comprehensive TDD Test Suite — 95%+ Coverage
Background
Current coverage is 59.67% statements (services + middleware only). The vitest config currently limits coverage to src/services/**and src/middleware/**, missing the routes, db, lib, and config modules entirely. To achieve 95%+ coverage across the entire backend, we need to:

Expand the coverage scope to include all source modules
Write comprehensive test scenarios for every module that lacks coverage
Cover every branch, error path, and edge case
Current Coverage State
Module Stmts Branch Notes
middleware/auth.ts 58% 51% Missing: requireAuth revocation branches, optionalAuth, Bearer token extraction
middleware/errors.ts 100% 87% ✅ Nearly complete
middleware/metrics.ts 0% 100% Missing: metricsMiddleware, normalizePath
middleware/rateLimit.ts 0% 100% Config-only module — test that it exports middleware functions
middleware/rbac.ts 100% 100% ✅ Complete
middleware/requestId.ts 0% 0% Missing: UUID generation, header passthrough
services/auditLog.ts 0% 0% Missing: logEvent, subscribe/unsubscribe, broadcast, recentEvents
services/policyEngine.ts 77% 63% Missing: simulateAgainstPolicy, policy cache hit, unknown condition, country unknown
services/postureCheck.ts 93% 92% ✅ Nearly complete
routes/auth.ts N/A N/A Has tests but not in coverage scope
routes/admin.ts 0% 0% 814 lines — largest file, zero coverage
routes/helpdesk.ts 0% 0% 266 lines — zero coverage
routes/portal.ts 0% 0% 284 lines — zero coverage
routes/events.ts 0% 0% SSE streaming — zero coverage
config.ts 0% 0% redactDatabaseUrl utility
lib/logger.ts 0% 0% Config-only — test that it exports a logger
db/client.ts 0% 0% Config-only — test pool creation, pingDb
db/redis.ts 0% 0% cacheSession, isSessionCached, invalidateSession, pingRedis, connectRedis
Proposed Changes

1. Expand vitest coverage scope
[MODIFY]
vitest.config.ts
Change coverage include from ['src/services/**', 'src/middleware/**'] to ['src/**'] and exclude test files, seed, migrate, index.ts (server bootstrap) and types-only files.

2. New Test Files — Test Scenarios
IMPORTANT

Each test file follows TDD: we define what the app must do in each scenario, then the test verifies it. These are behavioral specifications, not implementation tests.

[NEW] src/middleware/requestId.test.ts (~5 tests)
Scenario Expected Behavior
Request without X-Request-Id header Middleware generates a UUID and sets req.id
Request with X-Request-Id header Middleware uses the provided ID
Response includes X-Request-Id Response header X-Request-Id is set
Calls next() Middleware always calls next()
[NEW] src/middleware/metrics.test.ts (~8 tests)
Scenario Expected Behavior
normalizePath strips query params /api/users?page=1 → /api/users
normalizePath collapses UUIDs /api/users/550e8400-... → /api/users/:id
normalizePath collapses numeric IDs /api/items/123 → /api/items/:id
metricsMiddleware calls next() Always passes through
metricsMiddleware increments counter on finish http_requests_total is incremented
metricsMiddleware records duration histogram http_request_duration_seconds is observed
Prometheus registry exports metrics register.metrics() returns Prometheus text
Application metrics are registered policyEvalDuration, sseConnectionsGauge exist
[NEW] src/middleware/auth.comprehensive.test.ts (~15 tests)
Scenario Expected Behavior
No cookie, no Bearer header 401 unauthorized
Bearer token in Authorization header Token is extracted and verified
Invalid/expired JWT 401 unauthorized
Valid JWT but user not found in DB 401 unauthorized
Valid JWT, user found, no sid User is attached, next() called
Valid JWT, sid present, Redis cache hit Skip DB, next() called
Valid JWT, sid present, Redis cache miss, DB session valid Re-cache in Redis, next() called
Valid JWT, sid present, Redis cache miss, DB session revoked 401 session_expired_or_revoked
mfa claim true req.mfaVerified = true
mfa claim false/missing req.mfaVerified = false
optionalAuth: no token next() called, no user
optionalAuth: valid token user attached, next() called
optionalAuth: invalid token next() called, no user (swallowed)
[NEW] src/services/auditLog.test.ts (~12 tests)
Scenario Expected Behavior
logEvent inserts into access_events Returns enriched event with DB-generated ID
logEvent enriches with user name/email When user_id present, fetches from users table
logEvent enriches with app name When application_id present, fetches from applications table
logEvent without user_id user_name/email are null
logEvent without application_id app_name is null
logEvent broadcasts to subscribers All subscribers receive the enriched event
subscribe adds listener Subscriber receives subsequent events
unsubscribe removes listener Subscriber no longer receives events
broadcast catches subscriber errors Logger.error called, other subscribers still receive
recentEvents returns events with enrichment Query executes with correct LIMIT
recentEvents clamps limit to 1-500 limit=0 → 1, limit=1000 → 500
recentEvents default limit is 20 Called with no args
[NEW] src/services/policyEngine.comprehensive.test.ts (~10 tests)
Scenario Expected Behavior
simulateAgainstPolicy: policy not found Returns denied, reason=policy_not_found
simulateAgainstPolicy: subject not in policy Returns denied, reason=subject_not_in_policy
simulateAgainstPolicy: app not in policy Returns denied, reason=app_not_in_policy
simulateAgainstPolicy: all conditions pass Returns allowed with condition checks
simulateAgainstPolicy: condition fails Returns denied with correct reason
Unknown condition type → fail-safe denied Returns passed=false, detail=unknown condition type
Country condition: country unknown (undefined) Returns denied, detail=country unknown
Policy cache: second call uses cache (no DB query) Cache hit within 30s TTL
Time range: exactly at start time → allowed Boundary test
conditionReasonKey: unknown type → condition_failed Default case
[NEW] src/config.test.ts (~4 tests)
Scenario Expected Behavior
redactDatabaseUrl hides password postgresql://user:pass@host/db → postgresql://user:***@host/db
redactDatabaseUrl handles no-password URL Returns URL unchanged
redactDatabaseUrl handles invalid URL Returns raw string
Config exports expected keys PORT, DATABASE_URL, JWT_SECRET, etc. are defined
[NEW] src/db/redis.test.ts (~10 tests)
Scenario Expected Behavior
cacheSession sets key with TTL Redis SET with EX called
cacheSession silently fails on Redis error No exception thrown
isSessionCached returns true on cache hit Redis GET returns value
isSessionCached returns null on cache miss Redis GET returns null
isSessionCached returns null on Redis error Falls back gracefully
invalidateSession deletes key Redis DEL called
invalidateSession silently fails on Redis error No exception thrown
pingRedis returns true on PONG Happy path
pingRedis returns false on error Redis down scenario
connectRedis logs warning on failure Doesn't crash
[NEW] src/routes/admin.test.ts (~30 tests)
Scenario Expected Behavior
All endpoints require authentication 401 without token
All endpoints require admin role 403 for user/helpdesk role
GET /overview: returns dashboard stats activeUsers24h, policiesActive, denials24h, criticalAlerts, trend
GET /policies: returns all policies with affected counts Pagination-free policy list
POST /policies: creates policy with defaults status=draft, priority=100, invalidates cache
POST /policies: validates name required 400 for empty name
GET /policies/:id: returns single policy 200 with policy
GET /policies/:id: not found 404
PUT /policies/:id: updates policy fields Returns updated policy, invalidates cache
PUT /policies/:id: not found 404
DELETE /policies/:id: deletes policy 200 ok, invalidates cache
DELETE /policies/:id: not found 404
POST /simulate: runs policy simulation Returns simulate result
POST /policies/:id/simulate: runs against specific policy Returns simulate result
GET /users: returns paginated user list page, limit, total, search
GET /users/:id: returns user with groups/devices/events Detailed user view
GET /users/:id: not found 404
POST /users: creates user 201 with user object
PUT /users/:id: updates user fields Returns updated user
DELETE /users/:id: soft-deletes (deactivates) status becomes deactivated
GET /applications: returns paginated apps page, limit, total
POST /applications: creates application 201
PUT /applications/:id: updates application Returns updated app
DELETE /applications/:id: deletes application Nullifies access_events references
GET /groups: returns paginated groups page, limit, total, member_count
POST /groups: creates group 201
GET /groups/:id: returns group with members Group + member list
PUT /groups/:id: updates group Returns updated
DELETE /groups/:id: deletes group 200 ok
POST /groups/:id/members: adds member 201
DELETE /groups/:id/members/:userId: removes member 200
PUT /devices/:id: updates device Returns updated device
GET /audit-log: returns paginated events with filters outcome, search, date range
[NEW] src/routes/helpdesk.test.ts (~15 tests)
Scenario Expected Behavior
All endpoints require helpdesk or admin role 403 for user role
GET /dashboard: returns helpdesk stats activeConnections, denials24h, openAlerts, etc.
GET /alerts: returns paginated alerts Filters by severity, status
PUT /alerts/:id: updates alert status Returns updated alert
PUT /alerts/:id: not found 404
GET /users/search: returns matching users Search by email/name
GET /users/search: empty query returns empty 200 { users: [] }
GET /users/:id/access-history: returns events Last 30 days, limit 500
POST /users/:id/force-logout: revokes sessions Returns revoked count, invalidates Redis
POST /users/:id/send-password-reset: not found user 404
POST /users/:id/send-password-reset: success Revokes sessions, logs audit event, returns token in dev
GET /devices: returns paginated devices Search by name/owner
[NEW] src/routes/portal.test.ts (~20 tests)
Scenario Expected Behavior
All endpoints require authentication 401 without token
GET /apps: returns apps with accessibility Each app has accessible boolean from simulate
GET /apps/:id: returns app detail Requirements, access groups, simulation result
GET /apps/:id: not found 404
GET /sessions: returns user's sessions Most recent 50
GET /devices: returns user's devices Ordered by registered_at DESC
GET /profile: returns user profile User info, groups, primary device
DELETE /sessions/:id: revokes own session 200 ok
DELETE /sessions/:id: not found or already revoked 404
POST /devices: registers new device 201, enrollment_status=pending
POST /devices: validates required fields 400 for missing name/os
PUT /devices/:id: updates own device Returns updated device
PUT /devices/:id: not found (wrong user) 404
PUT /devices/:id: empty update body Returns { device: null }
DELETE /devices/:id: deletes own device 200 ok
DELETE /devices/:id: not found (wrong user) 404
3. Total test count estimate
File Tests
Existing (auth, errors, rbac, policyEngine, postureCheck, auth routes) 60
middleware/requestId.test.ts 4
middleware/metrics.test.ts 8
middleware/auth.comprehensive.test.ts 13
services/auditLog.test.ts 12
services/policyEngine.comprehensive.test.ts 10
config.test.ts 4
db/redis.test.ts 10
routes/admin.test.ts 33
routes/helpdesk.test.ts 12
routes/portal.test.ts 16
Total ~182
Verification Plan
Automated Tests
bash

# Run full suite with coverage

npx vitest run --coverage

# Verify 95%+ statement coverage

# Verify 90%+ branch coverage

Coverage Thresholds
After implementing, we'll add coverage thresholds to vitest.config.ts:

typescript
thresholds: {
  statements: 95,
  branches: 90,
  functions: 95,
  lines: 95,
}
Execution Order
Update vitest.config.ts — Expand coverage scope
Small utility tests — config, requestId, metrics (quick wins)
Service tests — auditLog, policyEngine comprehensive
Auth middleware — comprehensive requireAuth/optionalAuth
Redis tests — db/redis
Route tests — admin, helpdesk, portal (bulk of work)
Final coverage report — Verify 95%+ and add thresholds
