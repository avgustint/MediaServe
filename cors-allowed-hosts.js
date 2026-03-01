/**
 * CORS allowed hosts for MediaServer
 *
 * App can be accessed from any of these hostnames. Used by:
 * - server/config.js (development)
 * - scripts/build.js (production via build.config.js)
 *
 * Default: mediaplayer.local (mDNS on Raspberry Pi).
 * Also supports: localhost, 127.0.0.1, fixed LAN IP, Tailscale IP, public IP (home).
 */
const CORS_ALLOWED_HOSTS = [
  'localhost',
  '127.0.0.1',
  'mediaplayer.local',
  '192.168.0.100',
  '100.84.31.66',
  '93.103.9.191'  // Home Raspberry Pi (public IP), ports 5000/5001
];

/**
 * Build full CORS origin URLs for given hosts and ports
 * @param {string[]} hosts - hostnames
 * @param {number[]} ports - ports (e.g. [4200, 4201, 5000, 5001, 5002])
 * @returns {string[]} origin URLs
 */
function buildCorsOrigins(hosts = CORS_ALLOWED_HOSTS, ports = [4200, 4201, 5000, 5001, 5002]) {
  const origins = [];
  for (const host of hosts) {
    for (const port of ports) {
      origins.push(`http://${host}:${port}`);
    }
  }
  return origins;
}

module.exports = CORS_ALLOWED_HOSTS;
module.exports.buildCorsOrigins = buildCorsOrigins;
