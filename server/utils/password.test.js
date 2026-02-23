const { describe, it } = require('node:test');
const assert = require('node:assert');
const { comparePassword, isMD5Hash } = require('./password');

describe('password utils', () => {
  describe('isMD5Hash', () => {
    it('should return true for valid 32-char hex string', () => {
      assert.strictEqual(isMD5Hash('5f4dcc3b5aa765d61d8327deb882cf99'), true);
      assert.strictEqual(isMD5Hash('abcdef0123456789abcdef0123456789'), true);
    });

    it('should return false for non-hex or wrong length', () => {
      assert.strictEqual(isMD5Hash('short'), false);
      assert.strictEqual(isMD5Hash('5f4dcc3b5aa765d61d8327deb882cf99a'), false);
      assert.strictEqual(isMD5Hash('gggggggggggggggggggggggggggggggg'), false);
      assert.ok(!isMD5Hash(null));
      assert.ok(!isMD5Hash(''));
    });
  });

  describe('comparePassword (MD5 legacy)', () => {
    it('should match MD5 hash for correct password', async () => {
      const hash = '5f4dcc3b5aa765d61d8327deb882cf99'; // MD5 of 'password'
      const result = await comparePassword('password', hash);
      assert.strictEqual(result.match, true);
      assert.strictEqual(result.needsUpgrade, true);
    });

    it('should not match MD5 hash for wrong password', async () => {
      const hash = '5f4dcc3b5aa765d61d8327deb882cf99';
      const result = await comparePassword('wrong', hash);
      assert.strictEqual(result.match, false);
    });
  });
});
