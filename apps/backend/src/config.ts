import 'dotenv/config';

export const config = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  DATABASE_URL:
    process.env.DATABASE_URL ||
    'postgresql://secureedge:secureedge_dev@localhost:5432/secureedge',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-me',
  SESSION_TTL_SECONDS: parseInt(process.env.SESSION_TTL_SECONDS || '3600', 10),
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  NODE_ENV: process.env.NODE_ENV || 'development',
};

// JWT secret strength validation
if (config.NODE_ENV === 'production') {
  if (config.JWT_SECRET.length < 32) {
    throw new Error(
      'JWT_SECRET must be at least 32 characters in production. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64\'))"'
    );
  }
  if (config.JWT_SECRET.includes('dev-secret') || config.JWT_SECRET.includes('change-me')) {
    throw new Error('JWT_SECRET must not use the default dev value in production.');
  }
} else if (config.JWT_SECRET === 'dev-secret-change-me') {
  // Use pino directly here (logger.ts depends on config, so we avoid circular import)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pino = require('pino');
  pino().warn('Using default JWT_SECRET — do NOT use in production');
}

export function redactDatabaseUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return url;
  }
}
