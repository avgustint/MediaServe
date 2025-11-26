const dbOps = require('../dbOperations');

/**
 * Get user data with permissions
 */
function getUserWithPermissions(user) {
  const userRole = user.role ? dbOps.getRole(user.role) : null;
  const permissionGuids = userRole ? dbOps.getRolePermissions(user.role) : [];
  
  const permissionNames = permissionGuids.map(guid => {
    const perm = dbOps.getPermission(guid);
    return perm ? perm.name : null;
  }).filter(Boolean);

  // Decode email from base64
  let decodedEmail = user.email;
  try {
    decodedEmail = Buffer.from(user.email, 'base64').toString('utf8');
  } catch (error) {
    console.warn('Failed to decode email for user:', user.username, error.message);
  }

  return {
    name: user.name,
    email: decodedEmail,
    username: user.username,
    role: userRole ? {
      guid: userRole.guid,
      name: userRole.name,
      is_admin: userRole.is_admin || 0
    } : null,
    guid: user.guid,
    permissions: permissionNames,
    locale: user.locale || null
  };
}

/**
 * Check if a user is an administrator
 */
function isAdministrator(user) {
  if (!user || !user.role) {
    return false;
  }
  const role = dbOps.getRole(user.role);
  return role && role.is_admin === 1;
}

module.exports = {
  getUserWithPermissions,
  isAdministrator
};

