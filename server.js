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
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
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

app.get('/health', (_req, res) => res.json({ status: 'ok', version: '3.0.0', timestamp: new Date().toISOString(), service: 'CAST CRM Revenue Engine' }));

app.use(require('./middleware/errorHandler'));

// ─── INIT ─────────────────────────────────────────────────────────────────────
async function init() {
  try {
    // Verify Google Sheets connection
    const { getSheets } = require('./config/google');
    const { SPREADSHEET_ID } = require('./config/sheets');
    const sheets = await getSheets();
    await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    console.log('✅ Google Sheets conectado');

    // Verify Drive structure
    const { ensureFolderStructure } = require('./services/drive.service');
    await ensureFolderStructure();
    console.log('✅ Google Drive verificado');

    // Start SLA monitor
    const { startSLAMonitor } = require('./services/sla.service');
    startSLAMonitor();

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
    console.error('💡 Verifica que SPREADSHEET_ID y las credenciales de Google estén configuradas en .env');
    // Start without Google integration in dev mode
    if (process.env.NODE_ENV !== 'production') {
      const PORT = process.env.PORT || 3001;
      app.listen(PORT, () => console.log(`⚠️  Servidor iniciado sin Google APIs en puerto ${PORT}`));
    } else {
      process.exit(1);
    }
  }
}

init();
