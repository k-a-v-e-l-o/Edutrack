const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not configured.');
    return res.status(500).json({ success: false, message: 'Authentication configuration error.' });
  }

  const authorization = req.headers.authorization || req.headers.Authorization;
  const token = authorization && authorization.startsWith('Bearer ') ? authorization.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    req.user = decoded;
    return next();
  } catch (err) {
    console.error('Token verification failed:', err.message);
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

module.exports = verifyToken;
