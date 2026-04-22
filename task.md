# SecureEdge Production Elevation — Task Tracker

## Phase 1: Security Fixes ✅
- [x] Fix password-optional login bypass (`routes/auth.ts`)
- [x] Fix MFA: store MFA state in DB session + JWT `mfa` claim instead of forgeable cookie
- [x] Add session revocation check in `requireAuth` middleware
- [x] Validate JWT secret strength on startup (crash in prod if weak)
- [x] Add failed login audit logging

## Phase 2: Redis Integration ✅
- [x] Create Redis client module (`db/redis.ts`)
- [x] Add `ioredis` + `rate-limit-redis` dependencies
- [x] Migrate rate limiter to Redis store
- [x] Implement session cache (SET on login, DEL on revoke, GET on auth)
- [x] Invalidate Redis sessions on helpdesk force-logout

## Phase 3: Containerization & CI/CD ✅
- [x] Backend Dockerfile (multi-stage, non-root user, healthcheck)
- [x] Frontend Dockerfile (multi-stage, nginx, SPA fallback)
- [x] Frontend nginx.conf (API proxy, SSE support, security headers)
- [x] `docker-compose.prod.yml` (resource limits, health checks, Prometheus + Grafana)
- [x] GitHub Actions CI pipeline (lint, test, security scan, Docker build)

## Phase 4: Test Suite
- [ ] Install test framework (Vitest for backend)
- [ ] Auth route unit tests
- [ ] Policy engine unit tests
- [ ] Posture check unit tests
- [ ] Middleware unit tests
- [ ] Integration test setup (testcontainers)

## Phase 5: Scalability ✅ (partial)
- [x] Policy engine caching with invalidation (30s TTL)
- [x] Cache invalidation wired into admin CRUD routes
- [ ] Add pagination to admin users, applications, groups, helpdesk devices/alerts
- [x] Tune DB connection pool (max 25 prod, timeouts)
- [x] Add missing DB indexes (migration 004)
- [x] Fix SSE synthetic events (broadcast-only, no DB write in dev)

## Phase 6: Observability (partial)
- [x] Add request ID middleware (`X-Request-Id`)
- [x] Enhanced health check (DB + Redis status)
- [x] Prometheus config (`infra/prometheus.yml`)
- [ ] Add pino structured logging (replace console.log)
- [ ] Add Prometheus metrics endpoint
- [x] API-wide rate limiter added

## Phase 7: Kubernetes & Production
- [ ] K8s Deployment manifest
- [ ] K8s Service + Ingress
- [ ] HPA (Horizontal Pod Autoscaler)
- [ ] PodDisruptionBudget
- [ ] ConfigMap + Sealed Secrets
