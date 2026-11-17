const { timingSafeEqual } = require('node:crypto');
const { adminApiKey } = require('../config/env');

function requireAdminKey(request, response, next) {
  if (!adminApiKey) {
    return response.status(503).json({ error: 'Admin API authentication is not configured' });
  }

  const authorization = request.get('authorization') || '';
  const match = authorization.match(/^Bearer (.+)$/i);
  if (!match) return response.status(401).json({ error: 'Admin authentication required' });

  const supplied = Buffer.from(match[1]);
  const expected = Buffer.from(adminApiKey);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return response.status(401).json({ error: 'Invalid admin credentials' });
  }

  return next();
}

module.exports = { requireAdminKey };
