import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import pinoHttp from 'pino-http';
import { config, redactDatabaseUrl } from './config';
import { pingDb } from './db/client';
import { connectRedis, pingRedis, redis } from './db/redis';
import { errorHandler } from './middleware/errors';
import { requestId } from './middleware/requestId';
import { apiLimiter } from './middleware/rateLimit';
import { metricsMiddleware, register } from './middleware/metrics';
import { logger } from './lib/logger';

import authRouter from './routes/auth';
import portalRouter from './routes/portal';
import adminRouter from './routes/admin';
import helpdeskRouter from './routes/helpdesk';
import eventsRouter from './routes/events';
import ssoRouter from './routes/sso';
import webauthnRouter from './routes/webauthn';
import { openApiDoc } from './lib/openapi';

const app = express();

app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  cors({
    origin: config.CORS_ORIGIN,
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(requestId);
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => (req.url || '').includes('/health') || (req.url || '').includes('/metrics') } }));
app.use(metricsMiddleware);
app.use(apiLimiter);

// CSRF — double-submit
function csrfMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Issue cookie on first request if missing
  if (!req.cookies || !req.cookies['se_csrf']) {
    const token = crypto.randomBytes(16).toString('hex');
    res.cookie('se_csrf', token, {
      httpOnly: false,
      sameSite: 'strict',
      secure: config.NODE_ENV === 'production',
      path: '/',
    });
    // Attach to req.cookies so subsequent validation in same request sees it
    req.cookies = req.cookies || {};
    req.cookies['se_csrf'] = token;
  }

  const method = req.method.toUpperCase();
  const needsCheck =
    ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) &&
    (req.path.startsWith('/api/admin') || req.path.startsWith('/api/helpdesk')) &&
    !req.path.startsWith('/api/auth/sso/callback');

  if (!needsCheck) {
    return next();
  }

  const cookieToken = req.cookies['se_csrf'];
  const headerToken = req.headers['x-csrf-token'];
  if (
    typeof headerToken !== 'string' ||
    !cookieToken ||
    headerToken !== cookieToken
  ) {
    res.status(403).json({ error: 'csrf_mismatch' });
    return;
  }
  next();
}
app.use(csrfMiddleware);

// Health
app.get('/api/health', async (_req, res) => {
  const [dbOk, redisOk] = await Promise.all([pingDb(), pingRedis()]);
  const healthy = dbOk; // Redis down is degraded, not unhealthy
  res.status(healthy ? 200 : 503).json({
    ok: healthy,
    uptime: process.uptime(),
    db: dbOk ? 'ok' : 'down',
    redis: redisOk ? 'ok' : 'down',
  });
});

// Prometheus metrics endpoint
app.get('/api/metrics', async (_req, res) => {
  res.setHeader('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Mount
app.use('/api/auth', authRouter);
app.use('/api/auth/sso', ssoRouter);
app.use('/api/auth/webauthn', webauthnRouter);
app.use('/api/portal', portalRouter);
app.use('/api/admin', adminRouter);
app.use('/api/helpdesk', helpdeskRouter);
app.use('/api/events', eventsRouter);

// OpenAPI documentation
app.get('/api/docs/openapi.json', (_req, res) => {
  res.json(openApiDoc);
});
app.get('/api/docs', (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>SecureEdge API Docs</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css"/>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>SwaggerUIBundle({ url: '/api/docs/openapi.json', dom_id: '#swagger-ui' });</script>
</body>
</html>`);
});

// 404 for unmatched API
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'not_found' });
});

app.use(errorHandler);

// Bootstrap
async function start(): Promise<void> {
  await connectRedis();

  const server = app.listen(config.PORT, () => {
    logger.info(
      { port: config.PORT, db: redactDatabaseUrl(config.DATABASE_URL), redis: config.REDIS_URL, cors: config.CORS_ORIGIN },
      'SecureEdge backend listening'
    );
  });

  function shutdown(): void {
    logger.info('server shutting down');
    server.close(async () => {
      try { await redis.quit(); } catch { /* ignore */ }
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  logger.fatal({ err }, 'server failed to start');
  process.exit(1);
});

export default app;
