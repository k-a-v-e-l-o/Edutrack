require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const morgan   = require('morgan');
const path     = require('path');

const app = express();

// ─── Middleware ───────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Static Files (frontend) ──────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── API Routes ───────────────────────────────────────────────
app.use('/api/auth',    require('./routes/auth.routes'));
app.use('/api/learner', require('./routes/learner.routes'));
app.use('/api/parent',  require('./routes/parent.routes'));
app.use('/api/teacher', require('./routes/teacher.routes'));
app.use('/api/admin',   require('./routes/admin.routes'));

// ─── Serve Frontend Pages ─────────────────────────────────────
app.get('/login',           (req, res) => res.sendFile(path.join(__dirname, 'public/pages/auth/login.html')));
app.get('/register',        (req, res) => res.sendFile(path.join(__dirname, 'public/pages/auth/register.html')));
app.get('/learner/*',       (req, res) => res.sendFile(path.join(__dirname, 'public/pages/learner/dashboard.html')));
app.get('/parent/*',        (req, res) => res.sendFile(path.join(__dirname, 'public/pages/parent/dashboard.html')));
app.get('/teacher/*',       (req, res) => res.sendFile(path.join(__dirname, 'public/pages/teacher/dashboard.html')));
app.get('/admin/*',         (req, res) => res.sendFile(path.join(__dirname, 'public/pages/admin/dashboard.html')));

// ─── Root redirect ────────────────────────────────────────────
app.get('/', (req, res) => res.redirect('/login'));

// ─── 404 Handler ──────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Global Error Handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// ─── Start Server ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ EduTrack server running on http://localhost:${PORT}`);
});