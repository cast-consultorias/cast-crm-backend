const { google } = require('googleapis');
const { JWT }    = require('google-auth-library');
require('dotenv').config();

const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY           = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const IMPERSONATE_AS        = process.env.GMAIL_SENDER; // carlos@castconsultorias.com

// Sheets y Drive — service account directo (sin impersonación)
const auth = new google.auth.GoogleAuth({
  credentials: {
    type:         'service_account',
    project_id:   process.env.GOOGLE_PROJECT_ID,
    client_email: SERVICE_ACCOUNT_EMAIL,
    private_key:  PRIVATE_KEY,
  },
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
  ],
});

// Gmail y Calendar — impersona a carlos@castconsultorias.com via delegación de dominio
function getImpersonatedClient(scopes) {
  return new JWT({
    email:   SERVICE_ACCOUNT_EMAIL,
    key:     PRIVATE_KEY,
    scopes,
    subject: IMPERSONATE_AS,
  });
}

const getSheets   = async () => google.sheets({ version: 'v4', auth: await auth.getClient() });
const getDrive    = async () => google.drive({ version: 'v3',  auth: await auth.getClient() });
// Impersona a carlos@ para subir archivos (las cuentas de servicio no tienen cuota de almacenamiento)
const getDriveImpersonated = () => google.drive({ version: 'v3', auth: getImpersonatedClient(['https://www.googleapis.com/auth/drive']) });
const getGmail    = async () => google.gmail({ version: 'v1',  auth: getImpersonatedClient(['https://www.googleapis.com/auth/gmail.send']) });
const getCalendar = async () => google.calendar({ version: 'v3', auth: getImpersonatedClient(['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events']) });

module.exports = { auth, getSheets, getDrive, getDriveImpersonated, getGmail, getCalendar };
