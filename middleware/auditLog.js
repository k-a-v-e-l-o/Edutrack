const { query } = require('../db');

const auditLog = (action) => {
  return async (req, res, next) => {
    try {
      const user = req.user || {};
      await query(
        `INSERT INTO audit_logs (user_id, user_name, role, action, ip_address, status)
         VALUES ($1, $2, $3, $4, $5, 'success')`,
        [
          user.id   || null,
          user.email || 'unknown',
          user.role  || null,
          action,
          req.ip    || null
        ]
      );
    } catch (err) {
      console.error('Audit log error:', err.message);
    }
    next();
  };
};

module.exports = auditLog;