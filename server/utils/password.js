const bcrypt = require('bcrypt');
const config = require('../config');

/**
 * Hash a password using bcrypt
 */
async function hashPassword(password) {
  return await bcrypt.hash(password, config.security.bcryptRounds);
}

/**
 * Compare a password with a hash
 */
async function comparePassword(password, hash) {
  // Check if hash is MD5 (32 hex characters) for backward compatibility
  if (hash && hash.length === 32 && /^[a-f0-9]{32}$/i.test(hash)) {
    // Legacy MD5 support - compare MD5 hash
    const crypto = require('crypto');
    const md5Hash = crypto.createHash('md5').update(password).digest('hex');
    if (md5Hash === hash) {
      // Password matches MD5, but we should upgrade it
      // Return true and indicate it needs upgrade
      return { match: true, needsUpgrade: true };
    }
    return { match: false, needsUpgrade: false };
  }
  
  // Use bcrypt for newer passwords
  const match = await bcrypt.compare(password, hash);
  return { match, needsUpgrade: false };
}

/**
 * Check if a hash is MD5 (needs upgrade)
 */
function isMD5Hash(hash) {
  return hash && hash.length === 32 && /^[a-f0-9]{32}$/i.test(hash);
}

module.exports = {
  hashPassword,
  comparePassword,
  isMD5Hash
};

