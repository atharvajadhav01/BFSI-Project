# Architecture Notes

All system architecture, workflow, and data-flow **Mermaid diagrams**
are maintained in the main [README.md](../README.md) under:

- **System Architecture** — overall client/serverless/external services diagram
- **System Workflow & Data Flow** — sequence diagrams for:
  - Loan Eligibility flow
  - AI Financial Tips flow
  - Record Storage (Google Sheets) flow

Keeping diagrams in one place (the README) avoids duplication and keeps
them easy to find for anyone opening the repository for the first time.

## Design Decisions

**Why Vercel serverless functions instead of a long-running Python server?**
Vercel's native runtime for `/api` routes is Node.js, and serverless
functions map cleanly to Vercel/Netlify's deployment model (each file in
`/api` becomes its own endpoint automatically, no server process to
manage). A Python/Flask equivalent is still included in `/backend` for
local development, demos, or deployment to a Python-friendly host
(Render, Railway, PythonAnywhere, etc.) if preferred for the capstone
presentation.

**Why client-side loan eligibility scoring?**
The eligibility formula is intentionally transparent and deterministic
(see `README.md → Module Descriptions`). Keeping it in `script.js` means
mentors/evaluators can read the exact scoring logic in one file without
needing network access, while still being straightforward to move to a
backend endpoint later if server-side validation becomes a requirement.

**Why separate `_googleSheets.js` from the two Sheets endpoints?**
`save-record.js` and `get-records.js` share identical authentication
logic. Extracting it avoids duplicating credential-handling code (a
common source of security mistakes) and keeps each endpoint file focused
on its one responsibility.
