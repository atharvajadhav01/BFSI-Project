/* ==========================================================
   AI Loan Eligibility Checker - Frontend Logic
   No API keys or secrets live in this file. All AI and
   Google Sheets calls go through /api/* serverless endpoints.
   ========================================================== */

/* ================= NAVIGATION ================= */
const navItems = document.querySelectorAll('[data-view]');
const views = document.querySelectorAll('.view');
const navLinks = document.getElementById('navLinks');
const hamburgerBtn = document.getElementById('hamburgerBtn');

function switchView(viewName) {
  views.forEach(v => v.classList.remove('active-view'));
  const target = document.getElementById(`view-${viewName}`);
  if (target) target.classList.add('active-view');

  document.querySelectorAll('.nav-links li').forEach(li => {
    li.classList.toggle('active', li.dataset.view === viewName);
  });

  navLinks.classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

navItems.forEach(item => {
  item.addEventListener('click', () => switchView(item.dataset.view));
});

hamburgerBtn.addEventListener('click', () => {
  navLinks.classList.toggle('open');
});

/* ================= TOAST ================= */
function showToast(message, type = 'success', duration = 3200) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

/* ================= VALIDATION HELPERS ================= */
function setFieldError(inputEl, errorEl, message) {
  if (message) {
    inputEl.classList.add('invalid');
    errorEl.textContent = message;
    return false;
  } else {
    inputEl.classList.remove('invalid');
    errorEl.textContent = '';
    return true;
  }
}

function validateNumber(value, { min, max, fieldName, allowDecimal = true }) {
  if (value === '' || value === null || value === undefined) {
    return `${fieldName} is required.`;
  }
  const num = Number(value);
  if (Number.isNaN(num)) return `${fieldName} must be a valid number.`;
  if (!allowDecimal && !Number.isInteger(num)) return `${fieldName} must be a whole number.`;
  if (min !== undefined && num < min) return `${fieldName} must be at least ${min}.`;
  if (max !== undefined && num > max) return `${fieldName} must be at most ${max}.`;
  return '';
}

/* ==========================================================
   1. LOAN ELIGIBILITY CHECKER
   ========================================================== */

const loanForm = document.getElementById('loanForm');
const loanResultEl = document.getElementById('loanResult');

const loanFields = {
  loanAge: { min: 18, max: 100, fieldName: 'Age', allowDecimal: false },
  loanIncome: { min: 1, fieldName: 'Monthly income', allowDecimal: true },
  employmentDuration: { min: 0, max: 60, fieldName: 'Employment duration', allowDecimal: true },
  existingEmi: { min: 0, fieldName: 'Existing EMI/debt', allowDecimal: true },
  loanCreditScore: { min: 300, max: 900, fieldName: 'Credit score', allowDecimal: false },
  loanAmount: { min: 1000, fieldName: 'Loan amount', allowDecimal: true },
  loanTenure: { min: 1, max: 30, fieldName: 'Loan tenure', allowDecimal: false },
};

function validateLoanForm() {
  let valid = true;
  for (const [id, rules] of Object.entries(loanFields)) {
    const input = document.getElementById(id);
    const errorEl = document.getElementById(`err-${id}`);
    const msg = validateNumber(input.value, rules);
    if (!setFieldError(input, errorEl, msg)) valid = false;
  }
  const empType = document.getElementById('employmentType');
  const empErr = document.getElementById('err-employmentType');
  if (!empType.value) {
    setFieldError(empType, empErr, 'Please select employment type.');
    valid = false;
  } else {
    setFieldError(empType, empErr, '');
  }
  return valid;
}

/**
 * Deterministic, transparent loan eligibility scoring engine.
 * Scores out of 100 across weighted factors. This is an
 * EDUCATIONAL ESTIMATE ONLY, not a real bank decision.
 */
function calculateLoanEligibility(data) {
  const { age, income, employmentType, employmentDuration, existingEmi, creditScore, loanAmount, loanTenure } = data;

  let score = 0;
  const maxScore = 100;
  const reasons = [];
  const improvements = [];

  // ---- Factor 1: Age (10 points) ----
  if (age >= 21 && age <= 55) {
    score += 10;
  } else if (age >= 18 && age < 21) {
    score += 5;
    reasons.push('Age is below the ideal 21–55 range, which may reduce eligibility.');
    improvements.push('Lenders often prefer applicants aged 21 and above.');
  } else if (age > 55 && age <= 65) {
    score += 6;
    reasons.push('Age above 55 may reduce loan tenure options.');
  } else {
    reasons.push('Age is outside the typical lending range (18–65).');
    improvements.push('Consider a co-applicant to strengthen the application.');
  }

  // ---- Factor 2: Credit Score (25 points) ----
  if (creditScore >= 750) {
    score += 25;
    reasons.push('Excellent credit score significantly boosts eligibility.');
  } else if (creditScore >= 700) {
    score += 20;
    reasons.push('Good credit score supports eligibility.');
  } else if (creditScore >= 650) {
    score += 13;
    reasons.push('Fair credit score provides moderate eligibility.');
    improvements.push('Improving your credit score above 700 would strengthen approval chances.');
  } else if (creditScore >= 580) {
    score += 6;
    reasons.push('Below-average credit score weakens eligibility.');
    improvements.push('Focus on timely bill payments to raise your credit score.');
  } else {
    reasons.push('Poor credit score is a major barrier to loan approval.');
    improvements.push('Work on rebuilding credit history before applying for large loans.');
  }

  // ---- Factor 3: Income level (15 points) ----
  if (income >= 100000) {
    score += 15;
  } else if (income >= 50000) {
    score += 12;
  } else if (income >= 25000) {
    score += 8;
    reasons.push('Moderate income may limit the maximum loan amount.');
  } else if (income >= 15000) {
    score += 4;
    reasons.push('Lower income reduces overall eligibility.');
    improvements.push('A higher stable income would improve eligibility.');
  } else {
    reasons.push('Very low monthly income significantly limits eligibility.');
    improvements.push('Consider a smaller loan amount relative to your income.');
  }

  // ---- Factor 4: Debt-to-Income Ratio / FOIR (25 points) ----
  // FOIR = (existing EMI + estimated new EMI) / income
  const monthlyRate = 0.10 / 12; // Assume average 10% annual rate for estimation
  const months = loanTenure * 12;
  const estimatedNewEmi = calculateEMI(loanAmount, monthlyRate, months);
  const foir = income > 0 ? (existingEmi + estimatedNewEmi) / income : 1;

  if (foir <= 0.35) {
    score += 25;
    reasons.push('Healthy debt-to-income ratio (FOIR) supports repayment capacity.');
  } else if (foir <= 0.5) {
    score += 17;
    reasons.push('Debt-to-income ratio is within an acceptable but moderate range.');
    improvements.push('Reducing existing EMIs/debt would improve repayment capacity.');
  } else if (foir <= 0.65) {
    score += 8;
    reasons.push('High debt-to-income ratio increases repayment risk.');
    improvements.push('Consider a lower loan amount or longer tenure to reduce EMI burden.');
  } else {
    reasons.push('Debt-to-income ratio is too high; existing obligations plus new EMI exceed safe limits.');
    improvements.push('Reduce existing debt or loan amount before applying.');
  }

  // ---- Factor 5: Employment type & stability (15 points) ----
  const stabilityMap = { salaried: 8, 'self-employed': 5, business: 5, unemployed: 0 };
  score += stabilityMap[employmentType] ?? 0;

  if (employmentType === 'unemployed') {
    reasons.push('No current employment significantly reduces eligibility.');
    improvements.push('A stable income source is typically required for loan approval.');
  } else if (employmentDuration >= 3) {
    score += 7;
    reasons.push('Stable, long-term employment strengthens eligibility.');
  } else if (employmentDuration >= 1) {
    score += 4;
    reasons.push('Moderate employment duration provides some stability.');
    improvements.push('A longer employment history would improve eligibility.');
  } else {
    reasons.push('Short employment duration may concern lenders.');
    improvements.push('Building at least 1–2 years of consistent employment helps eligibility.');
  }

  // ---- Factor 6: Loan amount relative to income (10 points) ----
  const annualIncome = income * 12;
  const loanToIncomeRatio = annualIncome > 0 ? loanAmount / annualIncome : 999;

  if (loanToIncomeRatio <= 3) {
    score += 10;
  } else if (loanToIncomeRatio <= 5) {
    score += 6;
    reasons.push('Requested loan amount is moderately high relative to annual income.');
  } else if (loanToIncomeRatio <= 8) {
    score += 3;
    reasons.push('Requested loan amount is high relative to annual income.');
    improvements.push('Consider requesting a smaller loan amount.');
  } else {
    reasons.push('Requested loan amount is disproportionately high compared to income.');
    improvements.push('Significantly reduce the loan amount or increase income/tenure.');
  }

  const finalScore = Math.min(Math.round(score), maxScore);
  const eligible = finalScore >= 50 && foir <= 0.65 && employmentType !== 'unemployed';

  if (reasons.length === 0) {
    reasons.push('All major factors are within favorable ranges.');
  }
  if (eligible && improvements.length === 0) {
    improvements.push('Maintain your current financial habits to keep a strong profile.');
  }

  return {
    eligible,
    score: finalScore,
    foirPercent: Math.round(foir * 100),
    estimatedEmi: Math.round(estimatedNewEmi),
    reasons,
    improvements,
  };
}

loanForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validateLoanForm()) {
    showToast('Please fix the highlighted fields.', 'error');
    return;
  }

  const data = {
    age: Number(document.getElementById('loanAge').value),
    income: Number(document.getElementById('loanIncome').value),
    employmentType: document.getElementById('employmentType').value,
    employmentDuration: Number(document.getElementById('employmentDuration').value),
    existingEmi: Number(document.getElementById('existingEmi').value),
    creditScore: Number(document.getElementById('loanCreditScore').value),
    loanAmount: Number(document.getElementById('loanAmount').value),
    loanTenure: Number(document.getElementById('loanTenure').value),
  };

  const result = calculateLoanEligibility(data);
  renderLoanResult(result, data);
});

function renderLoanResult(result, inputData) {
  const { eligible, score, foirPercent, estimatedEmi, reasons, improvements } = result;

  const barColor = score >= 70 ? 'var(--accent-green)' : score >= 50 ? 'var(--accent-yellow)' : 'var(--accent-red)';

  loanResultEl.innerHTML = `
    <h3 class="result-title ${eligible ? 'eligible' : 'not-eligible'}">
      ${eligible ? '✅ Likely Eligible' : '❌ Likely Not Eligible'}
    </h3>
    <p style="color:var(--text-secondary); margin-top:4px;">Eligibility Score: <strong style="color:var(--text-primary)">${score}/100</strong></p>

    <div class="score-bar-wrap">
      <div class="score-bar-bg">
        <div class="score-bar-fill" style="width:${score}%; background:${barColor};"></div>
      </div>
    </div>

    <p style="font-size:0.9rem; color:var(--text-secondary);">
      Estimated FOIR (debt burden ratio): <strong style="color:var(--text-primary)">${foirPercent}%</strong> &nbsp;|&nbsp;
      Estimated EMI for this loan (at ~10% p.a.): <strong style="color:var(--text-primary)">₹${estimatedEmi.toLocaleString('en-IN')}</strong>
    </p>

    <h4 style="margin-top:18px; font-size:0.95rem;">Key Factors</h4>
    <ul class="reason-list">${reasons.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>

    <h4 style="margin-top:14px; font-size:0.95rem;">Suggested Improvements</h4>
    <ul class="tip-list">${improvements.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>

    <div class="disclaimer-note">
      ⚠️ This is an educational estimation based on general lending criteria, not an actual bank decision. Real approval depends on the specific lender's policies, full documentation, and credit bureau checks.
    </div>

    <button class="btn-secondary" id="saveLoanBtn">💾 Save this record</button>
  `;
  loanResultEl.classList.remove('hidden');

  document.getElementById('saveLoanBtn').addEventListener('click', () => {
    saveRecord({
      type: 'loan_eligibility',
      age: inputData.age,
      income: inputData.income,
      creditScore: inputData.creditScore,
      loanAmount: inputData.loanAmount,
      loanTenure: inputData.loanTenure,
      eligibilityResult: eligible ? 'Eligible' : 'Not Eligible',
      eligibilityScore: score,
    });
  });
}

/* ==========================================================
   2. CREDIT SCORE ANALYZER
   ========================================================== */

const creditForm = document.getElementById('creditForm');
const creditResultEl = document.getElementById('creditResult');

function analyzeCreditScore(score) {
  let category, interpretation, risk, riskClass, factors, suggestions;

  if (score >= 800) {
    category = 'Excellent (800–900)';
    interpretation = 'Reflects an outstanding credit history with very low default risk.';
    risk = 'Very Low Risk'; riskClass = 'high';
    factors = ['Consistent on-time payments', 'Low credit utilization', 'Long, healthy credit history'];
    suggestions = ['Continue timely repayments', 'Avoid unnecessary new credit inquiries', 'Maintain low credit card utilization'];
  } else if (score >= 740) {
    category = 'Very Good (740–799)';
    interpretation = 'Indicates strong creditworthiness with minor room for improvement.';
    risk = 'Low Risk'; riskClass = 'high';
    factors = ['Mostly on-time payments', 'Healthy credit mix', 'Moderate credit age'];
    suggestions = ['Keep credit utilization under 30%', 'Avoid multiple new loan applications at once'];
  } else if (score >= 670) {
    category = 'Good (670–739)';
    interpretation = 'A generally acceptable score for most lenders, though not the most competitive rates.';
    risk = 'Moderate Risk'; riskClass = 'medium';
    factors = ['Occasional late payments possible', 'Moderate credit utilization', 'Limited credit history length'];
    suggestions = ['Pay all bills before due dates', 'Reduce outstanding credit card balances', 'Avoid closing old credit accounts'];
  } else if (score >= 580) {
    category = 'Fair (580–669)';
    interpretation = 'Below-average score; lenders may offer higher interest rates or stricter terms.';
    risk = 'High Risk'; riskClass = 'medium';
    factors = ['History of late/missed payments', 'High credit utilization', 'Multiple recent credit inquiries'];
    suggestions = ['Set up auto-pay to avoid missed payments', 'Pay down existing balances', 'Limit new credit applications for 6–12 months'];
  } else {
    category = 'Poor (300–579)';
    interpretation = 'Significantly below average; approval chances are low and terms will likely be unfavorable.';
    risk = 'Very High Risk'; riskClass = 'low';
    factors = ['Defaults or missed payments', 'Very high credit utilization', 'Possible collections/write-offs'];
    suggestions = ['Focus on clearing overdue payments first', 'Consider a secured credit card to rebuild history', 'Avoid taking on new debt for now'];
  }

  return { category, interpretation, risk, riskClass, factors, suggestions };
}

creditForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('creditScoreInput');
  const errorEl = document.getElementById('err-creditScoreInput');
  const msg = validateNumber(input.value, { min: 300, max: 900, fieldName: 'Credit score', allowDecimal: false });

  if (!setFieldError(input, errorEl, msg)) {
    showToast('Please enter a valid credit score.', 'error');
    return;
  }

  const score = Number(input.value);
  const analysis = analyzeCreditScore(score);
  renderCreditResult(score, analysis);
});

function renderCreditResult(score, analysis) {
  const barPercent = ((score - 300) / (900 - 300)) * 100;
  const barColor = analysis.riskClass === 'high' ? 'var(--accent-green)' : analysis.riskClass === 'medium' ? 'var(--accent-yellow)' : 'var(--accent-red)';

  creditResultEl.innerHTML = `
    <h3 class="result-title">Score: ${score} <span class="badge ${analysis.riskClass}">${analysis.risk}</span></h3>
    <p style="margin-top:6px; color:var(--text-secondary);">${escapeHtml(analysis.category)}</p>

    <div class="score-bar-wrap">
      <div class="score-bar-bg"><div class="score-bar-fill" style="width:${barPercent}%; background:${barColor};"></div></div>
    </div>

    <p style="font-size:0.92rem; margin-top:8px;">${escapeHtml(analysis.interpretation)}</p>

    <h4 style="margin-top:16px; font-size:0.95rem;">Factors That May Affect This Score</h4>
    <ul class="reason-list">${analysis.factors.map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul>

    <h4 style="margin-top:14px; font-size:0.95rem;">Suggestions to Improve Financial Health</h4>
    <ul class="tip-list">${analysis.suggestions.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>

    <div class="disclaimer-note">
      ⚠️ This tool does not access real credit bureau data. Enter your actual score (from CIBIL, Experian, etc.) for a general educational interpretation only.
    </div>

    <button class="btn-secondary" id="saveCreditBtn">💾 Save this record</button>
  `;
  creditResultEl.classList.remove('hidden');

  document.getElementById('saveCreditBtn').addEventListener('click', () => {
    saveRecord({ type: 'credit_analysis', creditScore: score, category: analysis.category, risk: analysis.risk });
  });
}

/* ==========================================================
   3. EMI CALCULATOR
   ========================================================== */

function calculateEMI(principal, monthlyRate, numMonths) {
  if (numMonths <= 0 || principal <= 0) return 0;
  if (monthlyRate === 0) return principal / numMonths;
  const factor = Math.pow(1 + monthlyRate, numMonths);
  return (principal * monthlyRate * factor) / (factor - 1);
}

const emiPrincipalInput = document.getElementById('emiPrincipal');
const emiRateInput = document.getElementById('emiRate');
const emiTenureYearsInput = document.getElementById('emiTenureYears');
const emiTenureMonthsInput = document.getElementById('emiTenureMonths');
const emiErrorEl = document.getElementById('err-emi');

function updateEmiCalculation() {
  const principal = Number(emiPrincipalInput.value);
  const annualRate = Number(emiRateInput.value);
  const years = Number(emiTenureYearsInput.value) || 0;
  const extraMonths = Number(emiTenureMonthsInput.value) || 0;
  const totalMonths = years * 12 + extraMonths;

  if (!principal || principal <= 0 || annualRate < 0 || totalMonths <= 0) {
    emiErrorEl.textContent = 'Please enter a valid loan amount, rate, and tenure.';
    document.getElementById('emiMonthly').textContent = '₹0';
    document.getElementById('emiInterest').textContent = '₹0';
    document.getElementById('emiTotal').textContent = '₹0';
    document.getElementById('emiPrincipalBar').style.width = '0%';
    document.getElementById('emiInterestBar').style.width = '0%';
    return;
  }
  emiErrorEl.textContent = '';

  const monthlyRate = annualRate / 12 / 100;
  const emi = calculateEMI(principal, monthlyRate, totalMonths);
  const totalPayment = emi * totalMonths;
  const totalInterest = totalPayment - principal;

  document.getElementById('emiMonthly').textContent = `₹${Math.round(emi).toLocaleString('en-IN')}`;
  document.getElementById('emiInterest').textContent = `₹${Math.round(totalInterest).toLocaleString('en-IN')}`;
  document.getElementById('emiTotal').textContent = `₹${Math.round(totalPayment).toLocaleString('en-IN')}`;

  const principalPercent = (principal / totalPayment) * 100;
  const interestPercent = 100 - principalPercent;
  document.getElementById('emiPrincipalBar').style.width = `${principalPercent}%`;
  document.getElementById('emiInterestBar').style.width = `${interestPercent}%`;

  updateEmiCalculation._last = {
    principal, annualRate, totalMonths,
    emi: Math.round(emi), totalInterest: Math.round(totalInterest), totalPayment: Math.round(totalPayment),
  };
}

[emiPrincipalInput, emiRateInput, emiTenureYearsInput, emiTenureMonthsInput].forEach(el => {
  el.addEventListener('input', updateEmiCalculation);
});

document.getElementById('saveEmiBtn').addEventListener('click', () => {
  const last = updateEmiCalculation._last;
  if (!last) {
    showToast('Enter valid EMI details first.', 'error');
    return;
  }
  saveRecord({
    type: 'emi_calculation',
    loanAmount: last.principal,
    annualRate: last.annualRate,
    tenureMonths: last.totalMonths,
    emiResult: last.emi,
    totalInterest: last.totalInterest,
    totalRepayment: last.totalPayment,
  });
});

// Initialize EMI calculation on load with default values
updateEmiCalculation();

/* ==========================================================
   4. AI FINANCIAL TIPS (via secure backend)
   ========================================================== */

const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');
const chatSendBtn = document.getElementById('chatSendBtn');
const chatSuggestions = document.getElementById('chatSuggestions');

function appendChatMessage(text, sender = 'ai') {
  const div = document.createElement('div');
  div.className = `chat-msg ${sender}`;
  const p = document.createElement('p');
  p.textContent = text;
  div.appendChild(p);
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

function appendTypingIndicator() {
  const div = document.createElement('div');
  div.className = 'chat-msg ai';
  div.innerHTML = `<div class="typing-dots"><span></span><span></span><span></span></div>`;
  div.id = 'typingIndicator';
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTypingIndicator() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

async function sendChatMessage(question) {
  if (!question.trim()) return;

  appendChatMessage(question, 'user');
  chatInput.value = '';
  chatSendBtn.disabled = true;
  appendTypingIndicator();

  try {
    const response = await fetch('/api/ai-tips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });

    removeTypingIndicator();

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server responded with status ${response.status}`);
    }

    const data = await response.json();
    appendChatMessage(data.answer, 'ai');
  } catch (err) {
    removeTypingIndicator();
    console.error('AI Tips error:', err);
    appendChatMessage(
      '⚠️ Sorry, I could not process your question right now. Please check your internet connection and try again in a moment.',
      'error'
    );
  } finally {
    chatSendBtn.disabled = false;
  }
}

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  sendChatMessage(chatInput.value);
});

chatSuggestions.addEventListener('click', (e) => {
  if (e.target.classList.contains('suggestion-chip')) {
    sendChatMessage(e.target.textContent);
  }
});

/* ==========================================================
   5. GOOGLE SHEETS RECORD STORAGE (via secure backend)
   ========================================================== */

async function saveRecord(recordData) {
  try {
    const payload = {
      timestamp: new Date().toISOString(),
      ...recordData,
    };

    const response = await fetch('/api/save-record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to save record.');
    }

    showToast('✅ Record saved successfully!', 'success');
  } catch (err) {
    console.error('Save record error:', err);
    showToast('⚠️ Could not save record. Google Sheets may not be configured yet.', 'error');
  }
}

const loadRecordsBtn = document.getElementById('loadRecordsBtn');
const recordsResultEl = document.getElementById('recordsResult');

loadRecordsBtn.addEventListener('click', async () => {
  loadRecordsBtn.disabled = true;
  loadRecordsBtn.innerHTML = `<span class="spinner"></span> Loading...`;

  try {
    const response = await fetch('/api/get-records');
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to load records.');
    }
    const data = await response.json();
    renderRecords(data.records || []);
  } catch (err) {
    console.error('Load records error:', err);
    recordsResultEl.innerHTML = `
      <p style="color:var(--accent-red);">⚠️ Could not load records. This usually means Google Sheets credentials are not configured yet on the backend.</p>
    `;
    recordsResultEl.classList.remove('hidden');
  } finally {
    loadRecordsBtn.disabled = false;
    loadRecordsBtn.innerHTML = '🔄 Load My Records';
  }
});

function renderRecords(records) {
  if (!records.length) {
    recordsResultEl.innerHTML = `<p style="color:var(--text-secondary);">No records found yet. Save a calculation from the other tools first.</p>`;
    recordsResultEl.classList.remove('hidden');
    return;
  }

  const allKeys = new Set();
  records.forEach(r => Object.keys(r).forEach(k => allKeys.add(k)));
  const columns = Array.from(allKeys);

  const headerHtml = columns.map(c => `<th>${escapeHtml(c)}</th>`).join('');
  const rowsHtml = records.map(r => `
    <tr>${columns.map(c => `<td>${escapeHtml(String(r[c] ?? '-'))}</td>`).join('')}</tr>
  `).join('');

  recordsResultEl.innerHTML = `
    <div class="records-table-wrap">
      <table class="records-table">
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
  recordsResultEl.classList.remove('hidden');
}

/* ================= UTILITY ================= */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
