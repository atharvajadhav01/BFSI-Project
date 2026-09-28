/**
 * run-tests.js
 *
 * Simple standalone test runner (no external framework needed) for the
 * core calculation logic: EMI formula and credit score categorization.
 * Loan eligibility and form-validation test CASES are documented with
 * expected results in ../TESTING.md (since that logic is intertwined
 * with DOM code in script.js and is best verified via manual/browser
 * testing as described there).
 *
 * Run with: node tests/run-tests.js
 */

let passed = 0;
let failed = 0;

function assertClose(actual, expected, tolerance, label) {
  const diff = Math.abs(actual - expected);
  if (diff <= tolerance) {
    console.log(`✅ PASS: ${label} (got ${actual}, expected ~${expected})`);
    passed++;
  } else {
    console.log(`❌ FAIL: ${label} (got ${actual}, expected ~${expected})`);
    failed++;
  }
}

function assertEqual(actual, expected, label) {
  if (actual === expected) {
    console.log(`✅ PASS: ${label}`);
    passed++;
  } else {
    console.log(`❌ FAIL: ${label} (got "${actual}", expected "${expected}")`);
    failed++;
  }
}

// ---- Re-implement calculateEMI exactly as in frontend/script.js ----
function calculateEMI(principal, monthlyRate, numMonths) {
  if (numMonths <= 0 || principal <= 0) return 0;
  if (monthlyRate === 0) return principal / numMonths;
  const factor = Math.pow(1 + monthlyRate, numMonths);
  return (principal * monthlyRate * factor) / (factor - 1);
}

// ---- Re-implement credit score categorization exactly as in frontend/script.js ----
function categorize(score) {
  if (score >= 800) return 'Excellent';
  if (score >= 740) return 'Very Good';
  if (score >= 670) return 'Good';
  if (score >= 580) return 'Fair';
  return 'Poor';
}

console.log('\n=== EMI CALCULATION TESTS ===\n');

// Test 1: Standard loan - ₹500,000 at 10% p.a. for 5 years (60 months)
const emi1 = calculateEMI(500000, 0.10 / 12, 60);
assertClose(emi1, 10624, 5, 'EMI for ₹5,00,000 @ 10% p.a. for 5 years');

// Test 2: Zero interest rate should divide evenly
const emi2 = calculateEMI(120000, 0, 12);
assertEqual(emi2, 10000, 'EMI with 0% interest divides principal evenly');

// Test 3: Zero principal returns 0
const emi3 = calculateEMI(0, 0.01, 12);
assertEqual(emi3, 0, 'EMI with 0 principal returns 0');

// Test 4: Zero tenure returns 0 (guards against divide-by-zero)
const emi4 = calculateEMI(100000, 0.01, 0);
assertEqual(emi4, 0, 'EMI with 0 tenure returns 0 (no crash)');

// Test 5: Larger loan, longer tenure
const emi5 = calculateEMI(2000000, 0.085 / 12, 240);
assertClose(emi5, 17356, 5, 'EMI for ₹20,00,000 @ 8.5% p.a. for 20 years');

console.log('\n=== CREDIT SCORE CATEGORIZATION TESTS ===\n');

assertEqual(categorize(820), 'Excellent', 'Score 820 → Excellent');
assertEqual(categorize(800), 'Excellent', 'Score 800 (boundary) → Excellent');
assertEqual(categorize(799), 'Very Good', 'Score 799 (boundary) → Very Good');
assertEqual(categorize(750), 'Very Good', 'Score 750 → Very Good');
assertEqual(categorize(700), 'Good', 'Score 700 → Good');
assertEqual(categorize(620), 'Fair', 'Score 620 → Fair');
assertEqual(categorize(450), 'Poor', 'Score 450 → Poor');
assertEqual(categorize(300), 'Poor', 'Score 300 (min boundary) → Poor');
assertEqual(categorize(900), 'Excellent', 'Score 900 (max boundary) → Excellent');

console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
}
