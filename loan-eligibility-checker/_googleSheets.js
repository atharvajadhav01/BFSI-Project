/**
 * _googleSheets.js
 *
 * Shared helper module for authenticating with Google Sheets API
 * using a service account. This file is NOT a route itself
 * (prefixed with "_" so Vercel does not expose it as an endpoint);
 * it is imported by save-record.js and get-records.js.
 *
 * SECURITY NOTES:
 * - Credentials come ONLY from environment variables:
 *     GOOGLE_SERVICE_ACCOUNT_EMAIL
 *     GOOGLE_PRIVATE_KEY
 *     GOOGLE_SHEET_ID
 * - Never commit real credentials to git. See .env.example.
 * - The private key in Vercel's dashboard should be pasted with
 *   literal "\n" sequences; this module converts them back to
 *   real newlines before use.
 */

const { google } = require('googleapis');

function getSheetsClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY;
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!clientEmail || !privateKeyRaw || !sheetId) {
    return null; // Not configured — caller should handle gracefully
  }

  // Vercel env vars store the key with escaped \n — convert back to real newlines
  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  return { sheets, sheetId };
}

const SHEET_NAME = 'Records';

// Fixed column order used for both writing and reading records
const COLUMNS = [
  'timestamp',
  'type',
  'age',
  'income',
  'employmentType',
  'creditScore',
  'category',
  'risk',
  'loanAmount',
  'loanTenure',
  'annualRate',
  'tenureMonths',
  'existingEmi',
  'eligibilityResult',
  'eligibilityScore',
  'emiResult',
  'totalInterest',
  'totalRepayment',
];

module.exports = { getSheetsClient, SHEET_NAME, COLUMNS };
