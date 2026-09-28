"""
server.py

Optional Python (Flask) backend for local development and demonstration.

This mirrors the same functionality as the Node.js serverless functions
in /api (ai-tips, save-record, get-records). Use this if you prefer to
run/demo the project as a traditional Python server (e.g. on your own
machine or a platform like Render/Railway) instead of Vercel serverless
functions.

For actual Vercel/Netlify deployment, the /api/*.js serverless functions
are used instead — see README.md for deployment instructions.

SECURITY:
- All secrets are read from environment variables via python-dotenv.
- NEVER hardcode API keys or paste real credentials into this file.
- NEVER commit a real .env file to git.

Run locally:
    pip install -r requirements.txt
    python server.py
"""

import os
import re
import json
from datetime import datetime, timezone

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()  # Loads variables from a local .env file if present

app = Flask(__name__, static_folder="../frontend", static_url_path="")
CORS(app)  # Allow requests from the frontend during local development

# ---- Environment variables (secrets) ----
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
GOOGLE_SERVICE_ACCOUNT_EMAIL = os.environ.get("GOOGLE_SERVICE_ACCOUNT_EMAIL")
GOOGLE_PRIVATE_KEY = os.environ.get("GOOGLE_PRIVATE_KEY")
GOOGLE_SHEET_ID = os.environ.get("GOOGLE_SHEET_ID")

SHEET_NAME = "Records"
COLUMNS = [
    "timestamp", "type", "age", "income", "employmentType", "creditScore",
    "category", "risk", "loanAmount", "loanTenure", "annualRate",
    "tenureMonths", "existingEmi", "eligibilityResult", "eligibilityScore",
    "emiResult", "totalInterest", "totalRepayment",
]

SYSTEM_PROMPT = """You are a friendly, beginner-friendly financial education assistant embedded in an
Indian BFSI (Banking, Financial Services & Insurance) educational web app called "FinWise AI".

Rules you must follow:
- Explain concepts simply, as if to someone new to personal finance.
- Focus on loans, EMIs, credit scores, budgeting, savings, and debt management.
- Never claim to give personalized professional financial, legal, tax, or investment advice.
- Never guarantee loan approval, specific returns, or specific credit score outcomes.
- Keep answers concise: 3-6 short paragraphs or a short bulleted list, in plain text (no markdown symbols).
- If asked something outside personal finance/banking, politely redirect to finance topics.
- Always keep a supportive, non-judgmental, encouraging tone.
- Do not ask for or reference any sensitive personal identifying information."""


# ==========================================================
# Serve frontend (for simple local demo without a separate server)
# ==========================================================
@app.route("/")
def serve_index():
    return send_from_directory(app.static_folder, "index.html")


# ==========================================================
# 1. AI FINANCIAL TIPS ENDPOINT
# ==========================================================
@app.route("/api/ai-tips", methods=["POST"])
def ai_tips():
    try:
        data = request.get_json(silent=True) or {}
        question = data.get("question", "")

        if not isinstance(question, str) or not question.strip():
            return jsonify({"error": "A valid 'question' string is required."}), 400

        question = question.strip()

        if len(question) > 500:
            return jsonify({"error": "Question is too long. Please limit to 500 characters."}), 400

        # Basic sanitization: strip control characters
        question = re.sub(r"[\x00-\x1f\x7f]", "", question)

        if not ANTHROPIC_API_KEY:
            app.logger.error("ANTHROPIC_API_KEY is not configured.")
            return jsonify({
                "error": "AI service is not configured yet. Please set ANTHROPIC_API_KEY in your environment variables."
            }), 500

        try:
            import anthropic
        except ImportError:
            return jsonify({"error": "The 'anthropic' Python package is not installed. Run: pip install anthropic"}), 500

        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=700,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": question}],
        )

        answer_text = "\n".join(
            block.text for block in message.content if block.type == "text"
        ).strip()

        if not answer_text:
            raise ValueError("Empty response from AI service.")

        disclaimer = "\n\n(Educational guidance only — not professional financial advice.)"

        return jsonify({"answer": answer_text + disclaimer}), 200

    except Exception as exc:  # noqa: BLE001 - top-level safety net for API route
        app.logger.error(f"AI Tips error: {exc}")
        return jsonify({"error": "Failed to get a response from the AI service. Please try again later."}), 502


# ==========================================================
# 2. SAVE RECORD ENDPOINT (Google Sheets)
# ==========================================================
@app.route("/api/save-record", methods=["POST"])
def save_record():
    try:
        data = request.get_json(silent=True) or {}

        if not data.get("type"):
            return jsonify({"error": "Record 'type' is required."}), 400

        sheets_service = _get_sheets_service()
        if sheets_service is None:
            return jsonify({
                "error": "Record storage is not configured yet. Please set up Google Sheets credentials on the server."
            }), 503

        row = [_sanitize(data.get(col, "")) for col in COLUMNS]

        sheets_service.spreadsheets().values().append(
            spreadsheetId=GOOGLE_SHEET_ID,
            range=f"{SHEET_NAME}!A1",
            valueInputOption="USER_ENTERED",
            insertDataOption="INSERT_ROWS",
            body={"values": [row]},
        ).execute()

        return jsonify({"success": True, "message": "Record saved successfully."}), 200

    except Exception as exc:  # noqa: BLE001
        app.logger.error(f"Save record error: {exc}")
        return jsonify({"error": "Failed to save record to Google Sheets. Please try again later."}), 502


# ==========================================================
# 3. GET RECORDS ENDPOINT (Google Sheets)
# ==========================================================
@app.route("/api/get-records", methods=["GET"])
def get_records():
    try:
        sheets_service = _get_sheets_service()
        if sheets_service is None:
            return jsonify({
                "error": "Record storage is not configured yet. Please set up Google Sheets credentials on the server."
            }), 503

        result = sheets_service.spreadsheets().values().get(
            spreadsheetId=GOOGLE_SHEET_ID,
            range=f"{SHEET_NAME}!A2:R",
        ).execute()

        rows = result.get("values", [])
        recent_rows = list(reversed(rows[-100:]))

        records = []
        for row in recent_rows:
            record = {}
            for idx, col in enumerate(COLUMNS):
                if idx < len(row) and row[idx] != "":
                    record[col] = row[idx]
            records.append(record)

        return jsonify({"success": True, "records": records}), 200

    except Exception as exc:  # noqa: BLE001
        app.logger.error(f"Get records error: {exc}")
        return jsonify({"error": "Failed to load records from Google Sheets. Please try again later."}), 502


# ==========================================================
# Helpers
# ==========================================================
def _sanitize(value):
    if value is None:
        return ""
    text = str(value)
    return text[:300]


def _get_sheets_service():
    """Builds an authenticated Google Sheets API client from env vars.
    Returns None if credentials are not configured, so callers can
    respond gracefully instead of crashing.
    """
    if not (GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY and GOOGLE_SHEET_ID):
        return None

    try:
        from google.oauth2.service_account import Credentials
        from googleapiclient.discovery import build
    except ImportError:
        app.logger.error("google-api-python-client / google-auth not installed.")
        return None

    private_key = GOOGLE_PRIVATE_KEY.replace("\\n", "\n")

    credentials_info = {
        "type": "service_account",
        "client_email": GOOGLE_SERVICE_ACCOUNT_EMAIL,
        "private_key": private_key,
        "token_uri": "https://oauth2.googleapis.com/token",
    }

    creds = Credentials.from_service_account_info(
        credentials_info,
        scopes=["https://www.googleapis.com/auth/spreadsheets"],
    )

    service = build("sheets", "v4", credentials=creds)
    return service


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
