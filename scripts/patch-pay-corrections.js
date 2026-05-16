/**
 * One-time pay correction patch — RosieCleans_FieldApp_Sheet
 *
 * Run on the Mac Mini with:
 *   node scripts/patch-pay-corrections.js
 *
 * Requires Google Application Default Credentials (ADC) or a service account
 * JSON file at the path set by GOOGLE_APPLICATION_CREDENTIALS.
 *
 * Corrections:
 *
 *   1. Maribel Rojas — JOB-260515-T02-015 (Nicole, 2026-05-15)
 *      Tech Pay: 85 → 185  (leading '1' was dropped at entry)
 *      Total Earned: 85 → 185
 *      Weekly total for T02 becomes $935 base + $90 tips = $1,025 ✓
 *
 *   2. Maria Yamileth Lopez — JOB-260514-T03-025 (Shai, 2026-05-14)
 *      Tech Pay: 90 → 70  ($20 tip was incorrectly added to base pay)
 *      Tip stays at 20, Total Earned stays at 90
 */

import { google } from 'googleapis';

const SPREADSHEET_ID = '1clvo_K7sMsurVAG13IHAmxQ09mQX2cF3hvHT_G_tp5A';
const SHEET_NAME = 'Jobs';

// Column layout: T=Tech Pay, U=Tip, V=Total Earned (1-indexed, row 1 = header)
const CORRECTIONS = [
  {
    description: 'Maribel — Nicole job JOB-260515-T02-015 (row 16)',
    range: `${SHEET_NAME}!T16:V16`,
    values: [[185, 0, 185]],
    previous: [85, 0, 85],
  },
  {
    description: 'Yamileth — Shai job JOB-260514-T03-025 (row 26)',
    range: `${SHEET_NAME}!T26`,
    values: [[70]],
    previous: [90],
  },
];

async function verify(sheets, correction) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: correction.range,
  });
  const current = res.data.values?.[0]?.map(Number) ?? [];
  const match = correction.previous.every((v, i) => current[i] === v);
  if (!match) {
    console.warn(`  ⚠ Pre-check mismatch for ${correction.description}`);
    console.warn(`    Expected: ${correction.previous.join(', ')}`);
    console.warn(`    Found:    ${current.join(', ')}`);
    console.warn('  Skipping to avoid overwriting unexpected values.');
    return false;
  }
  return true;
}

async function applyCorrections() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  console.log('RosieCleans field app — pay correction patch\n');

  for (const correction of CORRECTIONS) {
    console.log(`Processing: ${correction.description}`);
    const ok = await verify(sheets, correction);
    if (!ok) continue;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: correction.range,
      valueInputOption: 'RAW',
      requestBody: { values: correction.values },
    });
    console.log(`  ✓ ${correction.range} → [${correction.values[0].join(', ')}]\n`);
  }

  console.log('Done.');
}

applyCorrections().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
