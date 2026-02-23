const { describe, it } = require('node:test');
const assert = require('node:assert');
const config = require('./config');

describe('config', () => {
  it('should export port', () => {
    assert.ok(typeof config.port === 'number' || typeof config.port === 'string');
  });

  it('should export nodeEnv', () => {
    assert.ok(['development', 'production', 'test'].includes(config.nodeEnv) || config.nodeEnv);
  });

  it('should export cors with origin array', () => {
    assert.ok(Array.isArray(config.cors.origin));
    assert.ok(config.cors.origin.length > 0);
  });

  it('should export security with bcryptRounds', () => {
    assert.ok(typeof config.security.bcryptRounds === 'number');
    assert.ok(config.security.bcryptRounds >= 1);
  });

  it('should export performance settings', () => {
    assert.ok(typeof config.performance.cacheEnabled === 'boolean');
    assert.ok(typeof config.performance.pagination.defaultLimit === 'number');
    assert.ok(typeof config.performance.pagination.maxLimit === 'number');
  });
});
