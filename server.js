require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');
const fs          = require('fs');
const path        = require('path');

const app = express();

// ─── LOGGING ──────────────────────────────────────────────────────────────────
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);
const logStream = fs.createWriteStream(path.join(logsDir, 'access.log'), { flags: 'a' });

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',').map(o => o.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined', { stream: logStream }));
app.use(morgan('dev'));

// Static assets (logo para emails)
app.use('/assets', express.static(path.join(__dirname, '../public')));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, message: 'Demasiadas solicitudes' });
app.use('/api/', limiter);
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Demasiados intentos de login' }));

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth.routes'));
app.use('/api/leads',     require('./routes/leads.routes'));
app.use('/api/blueprint', require('./routes/blueprint.routes'));
app.use('/api/emails',    require('./routes/emails.routes'));
app.use('/api/calendar',  require('./routes/calendar.routes'));
app.use('/api/drive',     require('./routes/drive.routes'));
app.use('/api/dashboard', require('./routes/dashboard.routes'));
app.use('/api/webhooks',  require('./routes/webhooks.routes'));
app.use('/api/users',     require('./routes/users.routes'));

app.get('/health', (_req, res) => res.json({ status: 'ok', version: '3.0.1-pdf-fix', timestamp: new Date().toISOString(), service: 'CAST CRM Revenue Engine' }));

app.use(require('./middleware/errorHandler'));

// ─── INIT ─────────────────────────────────────────────────────────────────────
async function init() {
  try {
    // Verify Supabase connection
    const { createClient } = require('@supabase/supabase-js');
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const { error } = await sb.from('users').select('id', { head: true, count: 'exact' });
    if (error) throw new Error(`Supabase: ${error.message}`);
    console.log('✅ Supabase conectado');

    // Verify Drive structure (Gmail/Calendar siguen usando Google APIs)
    const { ensureFolderStructure } = require('./services/drive.service');
    await ensureFolderStructure();
    console.log('✅ Google Drive verificado');

    // Start SLA monitor
    const { startSLAMonitor } = require('./services/sla.service');
    startSLAMonitor();

    // Recovery: detecta leads que quedaron en scoring sheet pero no llegaron a Supabase
    const { recoverMissingLeads } = require('./services/externalLeads.service');
    recoverMissingLeads()
      .then(r => { if (r.recovered > 0) console.log(`✅ Recovery: ${r.recovered} lead(s) recuperado(s)`); })
      .catch(e => console.warn('⚠️  Recovery check falló (no crítico):', e.message));

    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`
═══════════════════════════════════════════════
  CAST CRM — Revenue Engine v3.0
  Backend corriendo en puerto ${PORT}
  Entorno: ${process.env.NODE_ENV || 'development'}
  "No vendemos consultoría. Construimos el futuro."
═══════════════════════════════════════════════`);
    });
  } catch (error) {
    console.error('❌ Error al inicializar:', error.message);
    if (process.env.NODE_ENV !== 'production') {
      const PORT = process.env.PORT || 3001;
      app.listen(PORT, () => console.log(`⚠️  Servidor iniciado con errores en puerto ${PORT}`));
    } else {
      process.exit(1);
    }
  }
}

init();
