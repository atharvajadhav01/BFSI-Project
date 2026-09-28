/**
 * /api/get-records
 *
 * Retrieves previously saved financial records from Google Sheets.
 * Credentials are never exposed to the frontend — this file runs
 * only on the server (Vercel serverless function).
 *
 * NOTE: This demo app does not implement user authentication, so
 * it returns all rows in the sheet. In a production version, records
 * should be scoped per authenticated user (see README "Future
 * Enhancements": User Authentication).
 */

const { getSheetsClient, SHEET_NAME, COLUMNS } = require('./_googleSheets');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    const client = getSheetsClient();

    if (!client) {
      console.warn('Google Sheets is not configured (missing env vars).');
      return res.status(503).json({
        error: 'Record storage is not configured yet. Please set up Google Sheets credentials on the server.',
      });
    }

    const { sheets, sheetId } = client;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${SHEET_NAME}!A2:R`, // Skip header row (row 1); columns A–R match COLUMNS
    });

    const rows = response.data.values || [];

    // Limit to the most recent 100 records to keep the response light
    const recentRows = rows.slice(-100).reverse();

    const records = recentRows.map((row) => {
      const record = {};
      COLUMNS.forEach((col, idx) => {
        if (row[idx] !== undefined && row[idx] !== '') {
          record[col] = row[idx];
        }
      });
      return record;
    });

    return res.status(200).json({ success: true, records });
  } catch (error) {
    console.error('Get records error:', error?.message || error);

    if (error?.message && error.message.includes('Unable to parse range')) {
      return res.status(500).json({
        error: `Google Sheet must contain a tab named "${SHEET_NAME}" with a header row. Please create it first.`,
      });
    }

    return res.status(502).json({
      error: 'Failed to load records from Google Sheets. Please try again later.',
    });
  }
};
