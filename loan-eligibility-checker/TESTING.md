# TESTING.md — AI Loan Eligibility Checker

This document lists the test cases used to validate the project's core
functionality. Automated tests for pure calculation logic (EMI formula,
credit score categorization) live in `tests/run-tests.js` — run them with:

```bash
node tests/run-tests.js
```

All other cases below (form validation, API failure handling, mobile
responsiveness) are **manual test cases** to run in the browser, since
they depend on DOM interaction, network conditions, or viewport size.

---

## 1. EMI Calculator Tests

| # | Input (Principal, Rate, Tenure) | Expected EMI (approx.) | Result |
|---|----------------------------------|-------------------------|--------|
| 1 | ₹5,00,000, 10% p.a., 5 years (60 mo) | ₹10,624 | ✅ Pass |
| 2 | ₹20,00,000, 8.5% p.a., 20 years (240 mo) | ₹17,356 | ✅ Pass |
| 3 | ₹1,20,000, 0% interest, 12 months | ₹10,000 (even split) | ✅ Pass |
| 4 | Principal = 0 | EMI = ₹0, no crash | ✅ Pass |
| 5 | Tenure = 0 months | EMI = ₹0, no crash (no divide-by-zero) | ✅ Pass |
| 6 | Negative principal (manual UI test) | Error message shown, no calculation | ✅ Pass |
| 7 | Empty rate field | Error message shown under the calculator | ✅ Pass |

**How to test manually:** Go to the EMI Calculator tab, enter values, and
confirm the Monthly EMI / Total Interest / Total Repayment values update
live without a page refresh, and the principal-vs-interest bar updates.

---

## 2. Loan Eligibility Checker Tests

| # | Scenario | Input Summary | Expected Result |
|---|----------|----------------|------------------|
| 1 | Strong profile | Age 30, income ₹80,000, salaried, 5 yrs job, ₹0 existing EMI, credit score 780, loan ₹5,00,000, 5 yrs | **Eligible**, high score (≥70) |
| 2 | Weak credit score | Same as #1 but credit score 500 | **Not Eligible** or low score, "Poor credit score" reason shown |
| 3 | High existing debt | Income ₹40,000, existing EMI ₹25,000, loan ₹3,00,000 | High FOIR% shown, likely **Not Eligible** |
| 4 | Unemployed applicant | employmentType = Unemployed | **Not Eligible** regardless of other factors |
| 5 | Loan far exceeds income | Income ₹20,000/mo, loan ₹50,00,000 | Low score, "loan amount disproportionately high" reason |
| 6 | Underage applicant | Age 18 | Reduced age score, reason listed, but not auto-rejected |
| 7 | Boundary credit score 750 | Credit score exactly 750 | Falls into "Excellent" bracket (≥750) |

**How to test manually:** Go to Loan Eligibility tab, fill the form with
each scenario, submit, and confirm the eligibility badge, score bar,
reasons list, and improvement suggestions all appear and make sense.

---

## 3. Credit Score Analyzer Tests

| # | Score Input | Expected Category | Expected Risk Badge |
|---|-------------|--------------------|-----------------------|
| 1 | 850 | Excellent (800–900) | Very Low Risk (green) |
| 2 | 760 | Very Good (740–799) | Low Risk (green) |
| 3 | 700 | Good (670–739) | Moderate Risk (yellow) |
| 4 | 600 | Fair (580–669) | High Risk (yellow) |
| 5 | 400 | Poor (300–579) | Very High Risk (red) |
| 6 | 299 (invalid, below min) | Validation error shown | N/A |
| 7 | 901 (invalid, above max) | Validation error shown | N/A |
| 8 | Empty field | "Credit score is required" error | N/A |

---

## 4. Form Validation Tests (All Forms)

| # | Test Case | Expected Behavior |
|---|-----------|---------------------|
| 1 | Submit Loan form with all fields empty | Every required field shows an inline error; form does not submit |
| 2 | Enter text (e.g. "abc") into a numeric field | Browser/JS blocks or flags as invalid number |
| 3 | Enter negative income | "must be at least ..." validation error shown |
| 4 | Enter age = 15 | "Age must be at least 18" error shown |
| 5 | Leave Employment Type unselected | "Please select employment type" error shown |
| 6 | Enter credit score = 1000 | "must be at most 900" error shown |
| 7 | Fix all errors and resubmit | Form submits successfully, result card appears |

---

## 5. AI Financial Tips (Claude API) Tests

| # | Test Case | Expected Behavior |
|---|-----------|---------------------|
| 1 | Ask "How can I improve my credit score?" | Typing indicator shows, then a relevant AI answer with disclaimer appears |
| 2 | Click a suggested question chip | Same flow as manually typing the question |
| 3 | Submit an empty message | Form does not submit (HTML `required` prevents it) |
| 4 | Submit a message > 500 characters | Backend returns 400 error; friendly error bubble shown in chat |
| 5 | `ANTHROPIC_API_KEY` missing on server | Backend returns 500 with clear config message; frontend shows a friendly error bubble, no crash |
| 6 | Network disconnected mid-request | `fetch` throws; caught in `catch` block; friendly error bubble shown, Send button re-enabled |
| 7 | Claude API returns 429 (rate limited) | Backend returns 429 with "AI service is currently busy" message |

---

## 6. Google Sheets Integration Tests

| # | Test Case | Expected Behavior |
|---|-----------|---------------------|
| 1 | Save a loan eligibility record with valid credentials configured | 200 response, success toast "Record saved successfully!" |
| 2 | Save a record with Google Sheets NOT configured (no env vars) | Backend returns 503; frontend shows a clear warning toast, does not crash |
| 3 | Load records with valid credentials and existing rows | Table renders with all saved records, most recent first |
| 4 | Load records when the sheet has 0 data rows | "No records found yet" message shown, no crash |
| 5 | Load records when the "Records" tab/sheet doesn't exist | Backend returns 500 with a message instructing the user to create the tab |
| 6 | Network failure while saving | `fetch` throws; caught; toast shows "Could not save record" |

---

## 7. Mobile Responsiveness Tests

| # | Device / Viewport | Expected Behavior |
|---|--------------------|---------------------|
| 1 | iPhone SE (375px width) | Navbar collapses into hamburger menu; cards stack vertically |
| 2 | Android phone (360–412px width) | All forms remain usable; inputs are full-width and tappable |
| 3 | Tablet (768px width) | 2-column card grid; forms remain readable |
| 4 | Desktop (1440px+ width) | 4-column dashboard grid; content stays centered with max-width |
| 5 | Rotate phone to landscape | Layout reflows without breaking; chat window stays scrollable |
| 6 | Tap hamburger menu | Nav links list toggles open/closed smoothly |

**How to test:** Use Chrome DevTools device toolbar (or an actual phone)
across the breakpoints defined in `style.css` (`768px`, `480px`).

---

## 8. Running the Automated Test Suite

```bash
# From the project root
node tests/run-tests.js
```

Expected output: all EMI and credit-score-categorization tests print
`✅ PASS`, ending with a summary line like:

```
=== RESULTS: 14 passed, 0 failed ===
```

A non-zero exit code indicates at least one failure (useful for CI).
