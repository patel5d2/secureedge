/**
 * Logger module tests.
 * Verifies the logger exports correctly with the expected API.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../config', () => ({
  config: {
    NODE_ENV: 'test',
  },
}));

import { logger } from './logger';

describe('logger', () => {
  it('exports a pino logger instance with standard methods', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.fatal).toBe('function');
  });

  it('has log level set to debug in non-production', () => {
    expect(logger.level).toBe('debug');
  });

  it('can log without crashing', () => {
    expect(() => logger.info('test message')).not.toThrow();
    expect(() => logger.error({ err: new Error('test') }, 'test error')).not.toThrow();
  });
});
