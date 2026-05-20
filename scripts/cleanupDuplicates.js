require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_LEADS    = process.env.SHEET_LEADS || 'Leads';
const PRIVATE_KEY    = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

const auth = new google.auth.GoogleAuth({
  credentials: {
    type: 'service_account',
    project_id: process.env.GOOGLE_PROJECT_ID,
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: PRIVATE_KEY,
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function run() {
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_LEADS}!A:AN`,
  });
  const rows = res.data.values || [];
  console.log(`Total filas en sheet (incluyendo header): ${rows.length}`);

  // Audit: show all rows
  rows.forEach((r, i) => {
    if (i === 0) return;
    console.log(`  Fila ${i+1}: id=${r[0] || '(vacío)'} | name=${r[1] || ''} | stage=${r[9] || ''} | reportIA=${r[18] || ''}`);
  });

  // Find which rows to clear:
  // 1. Rows with stage = 'deleted'
  // 2. Duplicate rows (same id appearing more than once — keep the first occurrence)
  const seenIds = new Set();
  const rowsToClear = []; // 1-indexed sheet row numbers

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const id    = (r[0] || '').trim();
    const stage = (r[9] || '').trim();

    if (!id) continue; // already blank

    if (stage === 'deleted') {
      rowsToClear.push(i + 1); // sheet row = array index + 1
      console.log(`  → Marcado para limpiar (deleted): fila ${i+1} | ${r[1]}`);
      seenIds.add(id); // treat as "seen" so dupes are also cleared
      continue;
    }

    if (seenIds.has(id)) {
      rowsToClear.push(i + 1);
      console.log(`  → Marcado para limpiar (duplicado): fila ${i+1} | ${r[1]} stage=${stage}`);
    } else {
      seenIds.add(id);
    }
  }

  if (rowsToClear.length === 0) {
    console.log('\n✅ No hay filas para limpiar.');
    return;
  }

  console.log(`\nLimpiando ${rowsToClear.length} fila(s)...`);

  // Clear each row (overwrite with empty values — keeps the row but blanks it)
  for (const sheetRow of rowsToClear) {
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_LEADS}!A${sheetRow}:AN${sheetRow}`,
    });
    console.log(`  ✅ Fila ${sheetRow} limpiada`);
  }

  // Verify result
  const res2 = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_LEADS}!A:B`,
  });
  const finalRows = (res2.data.values || []).filter((r, i) => i > 0 && r[0]);
  console.log(`\n🎉 Limpieza completada. Leads restantes: ${finalRows.length}`);
  finalRows.forEach(r => console.log(`  ${r[0]} | ${r[1]}`));
}

run().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
