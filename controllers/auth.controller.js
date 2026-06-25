const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { query } = require('../db');

// ─── Login ────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password are required.' });

    const result = await query(
      `SELECT id, email, password_hash, role, first_name, last_name, is_active
       FROM users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    const user = result.rows[0];

    if (!user)
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    if (!user.is_active)
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact admin.' });

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword)
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    // Update last login
    await query(`UPDATE users SET last_login = NOW() WHERE id = $1`, [user.id]);

    // Sign token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, first_name: user.first_name, last_name: user.last_name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Audit log
    await query(
      `INSERT INTO audit_logs (user_id, user_name, role, action, ip_address, status)
       VALUES ($1, $2, $3, 'LOGIN', $4, 'success')`,
      [user.id, user.email, user.role, req.ip]
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id:         user.id,
        email:      user.email,
        role:       user.role,
        first_name: user.first_name,
        last_name:  user.last_name
      }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Logout ───────────────────────────────────────────────────
const logout = async (req, res) => {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, user_name, role, action, ip_address, status)
       VALUES ($1, $2, $3, 'LOGOUT', $4, 'success')`,
      [req.user.id, req.user.email, req.user.role, req.ip]
    );
    return res.status(200).json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    console.error('Logout error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Get Current User ─────────────────────────────────────────
const getMe = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, email, role, first_name, last_name, phone, gender,
              date_of_birth, profile_photo, is_active, last_login, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    const user = result.rows[0];
    if (!user)
      return res.status(404).json({ success: false, message: 'User not found.' });

    return res.status(200).json({ success: true, user });
  } catch (err) {
    console.error('GetMe error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const register = async (req, res) => {
  try {
    const { first_name, last_name, email, password, role, phone } = req.body;

    if (!first_name || !last_name || !email || !password || !role)
      return res.status(400).json({ success: false, message: 'All fields are required.' });

    // Check if email already exists
    const existing = await query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase().trim()]);
    if (existing.rows.length > 0)
      return res.status(409).json({ success: false, message: 'Email already registered.' });

    const password_hash = await bcrypt.hash(password, 12);

    const result = await query(
      `INSERT INTO users (first_name, last_name, email, password_hash, role, phone, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id, email, role, first_name, last_name`,
      [first_name.trim(), last_name.trim(), email.toLowerCase().trim(), password_hash, role, phone || null]
    );

    const user = result.rows[0];

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, first_name: user.first_name, last_name: user.last_name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      token,
      user
    });
  } catch (err) {
    console.error('Register error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const saveFcmToken = async (req, res) => {
  try {
    const { fcm_token } = req.body;
    if (!fcm_token)
      return res.status(400).json({ success: false, message: 'FCM token required.' });

    await query(`UPDATE users SET fcm_token = $1 WHERE id = $2`, [fcm_token, req.user.id]);

    return res.status(200).json({ success: true, message: 'FCM token saved.' });
  } catch (err) {
    console.error('FCM token error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { login, logout, getMe, saveFcmToken, register };