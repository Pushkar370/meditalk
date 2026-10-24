import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/ASUS/.gemini/antigravity-ide/brain/4f0eeea2-cebb-44bd-a073-5384402f41fd';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'audit_screenshots_before');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: 'phone-360', width: 360, height: 800 },
  { name: 'phone-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 800 },
  { name: 'desktop-1920', width: 1920, height: 1080 },
];

const ROLES = [
  {
    role: 'patient',
    email: 'patient@meditalk.com',
    password: 'password',
    pages: [
      '/patient/dashboard',
      '/patient/appointments',
      '/patient/book',
      '/patient/triage',
      '/patient/records',
      '/patient/history',
      '/patient/prescriptions',
      '/patient/profile',
      '/patient/settings',
      '/patient/notifications',
    ],
  },
  {
    role: 'doctor',
    email: 'doctor@meditalk.com',
    password: 'password',
    pages: [
      '/doctor/dashboard',
      '/doctor/appointments',
      '/doctor/patients',
      '/doctor/calendar',
      '/doctor/prescriptions',
      '/doctor/analytics',
      '/doctor/settings',
      '/doctor/notifications',
    ],
  },
  {
    role: 'nurse',
    email: 'nurse@meditalk.com',
    password: 'password',
    pages: [
      '/nurse/vitals',
      '/nurse/settings',
      '/nurse/notifications',
    ],
  },
  {
    role: 'receptionist',
    email: 'receptionist@meditalk.com',
    password: 'password',
    pages: [
      '/receptionist/queue',
      '/receptionist/settings',
      '/receptionist/notifications',
    ],
  },
  {
    role: 'admin',
    email: 'admin@meditalk.com',
    password: 'password',
    pages: [
      '/admin/dashboard',
      '/admin/doctors',
      '/admin/appointments',
      '/admin/patients',
      '/admin/announcements',
      '/admin/analytics',
      '/admin/audit-logs',
      '/admin/settings',
      '/admin/notifications',
    ],
  },
];

const PUBLIC_PAGES = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/terms',
  '/privacy',
  '/404',
];

async function analyzePage(page) {
  return await page.evaluate(() => {
    const issues = [];
    const html = document.documentElement;
    const body = document.body;

    // 1. Page horizontal overflow
    const docScrollWidth = Math.max(html.scrollWidth, body.scrollWidth);
    const docClientWidth = html.clientWidth;
    if (docScrollWidth > docClientWidth + 1) {
      issues.push({
        type: 'PAGE_HORIZONTAL_OVERFLOW',
        detail: `Page content width (${docScrollWidth}px) exceeds viewport width (${docClientWidth}px) by ${docScrollWidth - docClientWidth}px`,
        severity: 'HIGH',
      });
    }

    // 2. Helper to get background color
    function getEffectiveBg(el) {
      let cur = el;
      while (cur && cur !== document && cur !== html) {
        const bg = window.getComputedStyle(cur).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
          return bg;
        }
        cur = cur.parentElement;
      }
      return html.classList.contains('dark') ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)';
    }

    // Helper to parse rgb/rgba
    function parseRgb(colorStr) {
      const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!match) return [0, 0, 0];
      return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
    }

    // Calculate luminance
    function luminance(r, g, b) {
      const a = [r, g, b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    }

    // Contrast ratio
    function contrastRatio(rgb1, rgb2) {
      const lum1 = luminance(...rgb1);
      const lum2 = luminance(...rgb2);
      const brightest = Math.max(lum1, lum2);
      const darkest = Math.min(lum1, lum2);
      return (brightest + 0.05) / (darkest + 0.05);
    }

    // 3. Scan DOM elements for overflow and contrast
    const allElements = document.querySelectorAll('*');
    const seenOverflowElements = new Set();

    for (const el of allElements) {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      // Check if element spills out of window viewport horizontally
      if (rect.right > docClientWidth + 3 && !el.closest('[class*="overflow-x-auto"]')) {
        const tag = el.tagName.toLowerCase();
        const className = (el.className && typeof el.className === 'string') ? el.className.slice(0, 60) : '';
        const textSnippet = (el.innerText || '').trim().slice(0, 40);
        issues.push({
          type: 'ELEMENT_SPILLS_VIEWPORT',
          selector: `${tag}.${className.split(' ').slice(0, 3).join('.')}`,
          detail: `Element right edge (${Math.round(rect.right)}px) > viewport (${docClientWidth}px). Text: "${textSnippet}"`,
          severity: 'HIGH',
        });
      }

      // Check text element overflow (scrollWidth > clientWidth when no wrap or fixed width)
      if (el.scrollWidth > el.clientWidth + 3 && !['html', 'body', 'pre', 'code', 'table', 'tbody', 'thead', 'tr'].includes(el.tagName.toLowerCase())) {
        const overflowX = style.overflowX;
        if (overflowX !== 'auto' && overflowX !== 'scroll') {
          const textSnippet = (el.innerText || '').trim().slice(0, 50);
          if (textSnippet && !seenOverflowElements.has(el)) {
            seenOverflowElements.add(el);
            issues.push({
              type: 'TEXT_OVERFLOW_CLIPPED',
              selector: `${el.tagName.toLowerCase()}.${(el.className && typeof el.className === 'string' ? el.className.split(' ').slice(0, 3).join('.') : '')}`,
              detail: `scrollWidth (${el.scrollWidth}px) > clientWidth (${el.clientWidth}px). Text: "${textSnippet}"`,
              severity: 'MEDIUM',
            });
          }
        }
      }

      // 4. Color Contrast Check on leaf text elements
      if (el.childElementCount === 0 && (el.innerText || '').trim().length > 0) {
        const textColor = style.color;
        const bgColor = getEffectiveBg(el);
        const textRgb = parseRgb(textColor);
        const bgRgb = parseRgb(bgColor);
        const ratio = contrastRatio(textRgb, bgRgb);

        const fontSize = parseFloat(style.fontSize);
        const isBold = parseInt(style.fontWeight, 10) >= 700 || style.fontWeight === 'bold';
        const isLarge = fontSize >= 24 || (fontSize >= 18.66 && isBold);
        const threshold = isLarge ? 3.0 : 4.5;

        // Skip disabled elements or placeholders for this check
        if (el.hasAttribute('disabled') || el.closest('[disabled]')) continue;

        if (ratio < threshold && ratio > 1.1) {
          const snippet = el.innerText.trim().slice(0, 35);
          issues.push({
            type: 'WCAG_CONTRAST_FAIL',
            selector: `${el.tagName.toLowerCase()}.${(el.className && typeof el.className === 'string' ? el.className.split(' ').slice(0, 3).join('.') : '')}`,
            detail: `Contrast ${ratio.toFixed(2)}:1 below ${threshold}:1 (text: ${textColor}, bg: ${bgColor}) on "${snippet}"`,
            severity: 'MEDIUM',
          });
        }
      }
    }

    return issues;
  });
}

async function runAudit() {
  console.log('🚀 Starting Comprehensive Playwright UI Bug Audit...');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });

  const fullReport = [];
  let totalIssues = 0;

  // 1. Audit Public Pages
  console.log('\n--- Auditing Public Pages ---');
  for (const pagePath of PUBLIC_PAGES) {
    const url = `http://localhost:5173${pagePath}`;
    for (const vp of VIEWPORTS) {
      for (const theme of ['light', 'dark']) {
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
        });
        const page = await context.newPage();

        const consoleErrors = [];
        page.on('console', msg => {
          if (msg.type() === 'error') consoleErrors.push(msg.text());
        });

        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
          await page.waitForTimeout(500);

          if (theme === 'dark') {
            await page.evaluate(() => {
              document.documentElement.classList.add('dark');
            });
            await page.waitForTimeout(100);
          }

          const issues = await analyzePage(page);

          if (consoleErrors.length > 0) {
            for (const err of consoleErrors.slice(0, 3)) {
              issues.push({
                type: 'CONSOLE_ERROR',
                detail: err.slice(0, 100),
                severity: 'HIGH',
              });
            }
          }

          if (issues.length > 0) {
            totalIssues += issues.length;
            const safeName = `${pagePath.replace(/[^a-zA-Z0-9]/g, '_')}_${vp.name}_${theme}`;
            const screenshotPath = path.join(SCREENSHOT_DIR, `${safeName}.png`);
            await page.screenshot({ path: screenshotPath, fullPage: false });

            fullReport.push({
              page: pagePath,
              viewport: vp.name,
              width: vp.width,
              theme,
              screenshot: `${safeName}.png`,
              issues,
            });
            console.log(`⚠️ [${pagePath}] @ ${vp.name} (${theme}): ${issues.length} issue(s) found`);
          } else {
            console.log(`✅ [${pagePath}] @ ${vp.name} (${theme}): Clean`);
          }
        } catch (err) {
          console.error(`Error auditing ${url} at ${vp.name}:`, err.message);
        } finally {
          await context.close();
        }
      }
    }
  }

  // 2. Audit Role Portals
  for (const r of ROLES) {
    console.log(`\n--- Auditing ${r.role.toUpperCase()} Portal ---`);
    for (const pagePath of r.pages) {
      const url = `http://localhost:5173${pagePath}`;
      for (const vp of VIEWPORTS) {
        for (const theme of ['light', 'dark']) {
          const context = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
          });
          const page = await context.newPage();

          const consoleErrors = [];
          page.on('console', msg => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
          });

          try {
            await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded', timeout: 10000 });
            
            // Fast login via API & localStorage inject
            await page.evaluate(async ({ email, password }) => {
              try {
                const res = await fetch('/api/auth/login', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email, password }),
                });
                const data = await res.json();
                if (data.token && data.user) {
                  localStorage.setItem('token', data.token);
                  localStorage.setItem('user', JSON.stringify(data.user));
                }
              } catch (_) {}
            }, { email: r.email, password: r.password });

            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
            await page.waitForTimeout(600);

            if (theme === 'dark') {
              await page.evaluate(() => {
                document.documentElement.classList.add('dark');
              });
              await page.waitForTimeout(100);
            }

            const issues = await analyzePage(page);

            if (consoleErrors.length > 0) {
              for (const err of consoleErrors.slice(0, 3)) {
                issues.push({
                  type: 'CONSOLE_ERROR',
                  detail: err.slice(0, 100),
                  severity: 'HIGH',
                });
              }
            }

            if (issues.length > 0) {
              totalIssues += issues.length;
              const safeName = `${r.role}_${pagePath.replace(/[^a-zA-Z0-9]/g, '_')}_${vp.name}_${theme}`;
              const screenshotPath = path.join(SCREENSHOT_DIR, `${safeName}.png`);
              await page.screenshot({ path: screenshotPath, fullPage: false });

              fullReport.push({
                role: r.role,
                page: pagePath,
                viewport: vp.name,
                width: vp.width,
                theme,
                screenshot: `${safeName}.png`,
                issues,
              });
              console.log(`⚠️ [${r.role} - ${pagePath}] @ ${vp.name} (${theme}): ${issues.length} issue(s)`);
            } else {
              console.log(`✅ [${r.role} - ${pagePath}] @ ${vp.name} (${theme}): Clean`);
            }
          } catch (err) {
            console.error(`Error auditing ${url} for ${r.role} at ${vp.name}:`, err.message);
          } finally {
            await context.close();
          }
        }
      }
    }
  }

  await browser.close();

  const reportPath = path.join(ARTIFACT_DIR, 'initial_ui_audit_report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ totalIssues, fullReport }, null, 2));
  console.log(`\n🎉 Audit Completed! Found ${totalIssues} issues across views. Saved to ${reportPath}`);
}

runAudit().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
