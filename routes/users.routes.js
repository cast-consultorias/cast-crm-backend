const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const auth    = require('../middleware/auth');
const ceoOnly = require('../middleware/ceo');
const svc     = require('../services/sheets.service');
const { SHEETS } = require('../config/sheets');
const { nowISO } = require('../utils/dateUtils');

router.get('/',    auth, ceoOnly, async (req, res, next) => {
  try { res.json({ users: await svc.getAllUsers() }); } catch (e) { next(e); }
});

router.post('/', auth, ceoOnly, async (req, res, next) => {
  try {
    const { email, password, name, role, isCEO = false, color = '#007AFF' } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'email, password y name son requeridos' });
    const existing = await svc.getUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'El email ya existe' });
    const hash = await bcrypt.hash(password, 12);
    const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    const { getSheets } = require('../config/google');
    const { SPREADSHEET_ID } = require('../config/sheets');
    const sheets = await getSheets();
    await sheets.spreadsheets.values.append({ spreadsheetId:SPREADSHEET_ID, range:`${SHEETS.USERS}!A1`, valueInputOption:'RAW', insertDataOption:'INSERT_ROWS', requestBody:{ values:[[uuidv4(),email,hash,name,role||'Equipo',isCEO?'TRUE':'FALSE','TRUE',nowISO(),'',color,initials]] }});
    res.status(201).json({ success: true });
  } catch (e) { next(e); }
});

module.exports = router;
