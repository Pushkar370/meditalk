import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/ASUS/.gemini/antigravity-ide/brain/4f0eeea2-cebb-44bd-a073-5384402f41fd';
const STRESS_SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'stress_test_screenshots');
if (!fs.existsSync(STRESS_SCREENSHOT_DIR)) {
  fs.mkdirSync(STRESS_SCREENSHOT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: 'phone-360', width: 360, height: 800 },
  { name: 'phone-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 800 },
  { name: 'desktop-1920', width: 1920, height: 1080 },
];

const STRESS_DATA = {
  // 60-character patient name
  patientName: "Devanand Venkatanarasimharajuvaripeta Ramachandra Rao Jr 60c",
  // Very long email address
  longEmail: "maximilian.alexander.obermeyer.external.consultant@department-of-cardiovascular-medicine.example-hospital.org",
  // Long reason for visit
  longReason: "Experiencing recurrent nocturnal paroxysmal dyspnea accompanied by acute substernal tightness and bilateral lower extremity pitting edema extending past the mid-shin for three consecutive weeks",
  // Long diagnosis
  longDiagnosis: "Chronic Congestive Systolic Heart Failure with Dilated Cardiomyopathy and Secondary Moderate Mitral Valve Regurgitation (ICD-10 I50.22)",
  // Long medicine name
  longMedicine: "Hydrochlorothiazide / Triamterene Hydrochloride Extended-Release Capsules 37.5mg/25mg Once Daily After Breakfast",
  // Text in other scripts such as Devanagari
  devanagariText: "डॉक्टर स्नेहा मेनन (सामान्य चिकित्सा) - मरीज़: आरव शर्मा (छाती में तेज दर्द और सांस लेने में कठिनाई)",
};

async function runStressTest() {
  console.log('🧪 Starting UI Stress Test with Extreme Data & Scripts...');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });

  const stressResults = [];
  let violationsCount = 0;

  for (const vp of VIEWPORTS) {
    console.log(`\nTesting Viewport: ${vp.name} (${vp.width}x${vp.height})`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    });
    const page = await context.newPage();

    // 1. Stress Login & Auth header
    await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ STRESS_DATA }) => {
      // Set extreme user in localStorage
      localStorage.setItem('user', JSON.stringify({
        id: 'patient-stress-999',
        name: STRESS_DATA.patientName,
        email: STRESS_DATA.longEmail,
        role: 'patient',
      }));
      localStorage.setItem('token', 'fake-stress-token');
    }, { STRESS_DATA });

    // 2. Visit Patient Dashboard with extreme injected data
    await page.goto('http://localhost:5173/patient/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    // Inject cards with extreme data into the page DOM to test layout resilience
    const injectionResult = await page.evaluate(({ STRESS_DATA }) => {
      const container = document.querySelector('main > div') || document.querySelector('main');
      if (!container) return { success: false, reason: 'No main container' };

      const stressCard = document.createElement('div');
      stressCard.className = 'card space-y-4 my-6 border-2 border-primary/30';
      stressCard.id = 'stress-test-card';
      stressCard.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div class="flex items-center gap-3.5 min-w-0 flex-1">
            <div class="h-11 w-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              🩺
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-ink dark:text-white tracking-tight truncate" id="stress-name" title="${STRESS_DATA.patientName}">
                ${STRESS_DATA.patientName}
              </p>
              <p class="text-xs text-ink-secondary dark:text-neutral-400 mt-0.5 truncate" id="stress-email" title="${STRESS_DATA.longEmail}">
                ${STRESS_DATA.longEmail}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              Active Triage
            </span>
          </div>
        </div>

        <div class="pt-3 border-t border-black/[0.04] dark:border-white/[0.06] space-y-2 text-xs">
          <div>
            <span class="font-bold text-ink dark:text-white">Reason for Visit:</span>
            <p class="text-ink-secondary dark:text-neutral-300 break-words mt-0.5" id="stress-reason">
              ${STRESS_DATA.longReason}
            </p>
          </div>
          <div>
            <span class="font-bold text-ink dark:text-white">Diagnosis:</span>
            <p class="text-ink-secondary dark:text-neutral-300 break-words mt-0.5" id="stress-diagnosis">
              ${STRESS_DATA.longDiagnosis}
            </p>
          </div>
          <div>
            <span class="font-bold text-ink dark:text-white">Prescription Medicine:</span>
            <p class="text-ink-secondary dark:text-neutral-300 break-words mt-0.5" id="stress-medicine">
              ${STRESS_DATA.longMedicine}
            </p>
          </div>
          <div class="p-3 rounded-xl bg-primary/5 border border-primary/20">
            <span class="font-bold text-ink dark:text-white">Devanagari Script Clinical Notes:</span>
            <p class="text-ink dark:text-neutral-200 break-words mt-0.5 font-medium" id="stress-devanagari">
              ${STRESS_DATA.devanagariText}
            </p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 pt-2">
          <button type="button" class="px-4 py-2 text-xs font-semibold rounded-full bg-primary text-white">
            Schedule Immediate Follow-Up Consultation
          </button>
          <button type="button" class="px-3 py-2 text-xs font-semibold rounded-full bg-black/5 dark:bg-white/10 text-ink dark:text-white">
            Download Complete Audit Record
          </button>
        </div>
      `;

      container.prepend(stressCard);
      return { success: true };
    }, { STRESS_DATA });

    await page.waitForTimeout(300);

    // Verify page overflow and element widths
    const checkResult = await page.evaluate((vpWidth) => {
      const html = document.documentElement;
      const body = document.body;
      const scrollW = Math.max(html.scrollWidth, body.scrollWidth);
      const clientW = Math.max(html.clientWidth, body.clientWidth);
      const pageHorizontalScroll = scrollW > clientW + 1;

      const card = document.getElementById('stress-test-card');
      const cardRect = card ? card.getBoundingClientRect() : null;
      const cardSpills = cardRect ? cardRect.right > clientW + 3 : false;

      // Check all elements for viewport overflow
      let maxRight = 0;
      let spillingElement = null;
      for (const el of document.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.right > clientW + 3) {
          if (!el.closest('[class*="overflow-x-auto"]') && !el.closest('[class*="no-scrollbar"]')) {
            maxRight = r.right;
            spillingElement = el.tagName + '.' + (el.className || '');
            break;
          }
        }
      }

      return {
        scrollW,
        clientW,
        pageHorizontalScroll,
        cardSpills,
        spillingElement,
        maxRight,
      };
    }, vp.width);

    const screenshotName = `stress_${vp.name}_light.png`;
    await page.screenshot({ path: path.join(STRESS_SCREENSHOT_DIR, screenshotName), fullPage: false });

    // Also test dark mode
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForTimeout(100);
    const darkScreenshotName = `stress_${vp.name}_dark.png`;
    await page.screenshot({ path: path.join(STRESS_SCREENSHOT_DIR, darkScreenshotName), fullPage: false });

    const passed = !checkResult.pageHorizontalScroll && !checkResult.cardSpills && !checkResult.spillingElement;
    if (!passed) violationsCount++;

    stressResults.push({
      viewport: vp.name,
      width: vp.width,
      pageHorizontalScroll: checkResult.pageHorizontalScroll,
      cardSpills: checkResult.cardSpills,
      spillingElement: checkResult.spillingElement,
      screenshots: [screenshotName, darkScreenshotName],
      passed,
    });

    console.log(`Viewport ${vp.name}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    if (!passed) {
      console.log('  Details:', JSON.stringify(checkResult));
    }

    await context.close();
  }

  await browser.close();

  const stressReportPath = path.join(ARTIFACT_DIR, 'stress_test_report.json');
  fs.writeFileSync(stressReportPath, JSON.stringify({ violationsCount, stressResults, STRESS_DATA }, null, 2));
  console.log(`\n🎉 Stress Test Completed! Violations: ${violationsCount}. Saved to ${stressReportPath}`);
  return violationsCount === 0;
}

runStressTest().then(success => {
  if (!success) process.exit(1);
}).catch(err => {
  console.error('Fatal stress test error:', err);
  process.exit(1);
});
