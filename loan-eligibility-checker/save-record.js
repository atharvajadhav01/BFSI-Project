/**
 * /api/save-record
 *
 * Saves a user's financial calculation/analysis record as a new row
 * in a Google Sheet, using a backend service account. Credentials
 * are never exposed to the frontend.
 *
 * Configure these environment variables (see .env.example and README):
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_PRIVATE_KEY
 *   GOOGLE_SHEET_ID
 */

const { getSheetsClient, SHEET_NAME, COLUMNS } = require('./_googleSheets');

function sanitizeValue(value) {
  if (value === undefined || value === null) return '';
  // Prevent extremely long or malicious strings from being stored
  const str = String(value);
  return str.length > 300 ? str.slice(0, 300) : str;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const body = req.body || {};

    if (!body.type || typeof body.type !== 'string') {
      return res.status(400).json({ error: 'Record "type" is required.' });
    }

    const client = getSheetsClient();

    if (!client) {
      // Google Sheets not configured — fail gracefully with a clear message
      console.warn('Google Sheets is not configured (missing env vars).');
      return res.status(503).json({
        error: 'Record storage is not configured yet. Please set up Google Sheets credentials on the server.',
      });
    }

    const { sheets, sheetId } = client;

    // Build the row in fixed column order; missing fields become empty strings
    const row = COLUMNS.map((col) => sanitizeValue(body[col]));

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [row],
      },
    });

    return res.status(200).json({ success: true, message: 'Record saved successfully.' });
  } catch (error) {
    console.error('Save record error:', error?.message || error);

    // Common Google API failure: sheet/tab does not exist yet
    if (error?.message && error.message.includes('Unable to parse range')) {
      return res.status(500).json({
        error: `Google Sheet must contain a tab named "${SHEET_NAME}" with a header row. Please create it and try again.`,
      });
    }

    return res.status(502).json({
      error: 'Failed to save record to Google Sheets. Please try again later.',
    });
  }
};
