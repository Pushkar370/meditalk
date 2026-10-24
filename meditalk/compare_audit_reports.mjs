import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/ASUS/.gemini/antigravity-ide/brain/4f0eeea2-cebb-44bd-a073-5384402f41fd';

const beforeReport = JSON.parse(fs.readFileSync(path.join(ARTIFACT_DIR, 'initial_ui_audit_report.json'), 'utf8'));
const afterReport = JSON.parse(fs.readFileSync(path.join(ARTIFACT_DIR, 'after_ui_audit_report.json'), 'utf8'));

function summarize(report) {
  const stats = {
    total: 0,
    byType: {},
    bySeverity: {},
    byRole: {},
    byViewport: {},
    textOverflows: [],
    horizontalScrolls: [],
    viewportSpills: [],
    consoleErrors: [],
    contrastFails: 0,
  };

  for (const entry of report.fullReport) {
    for (const issue of entry.issues) {
      stats.total++;
      stats.byType[issue.type] = (stats.byType[issue.type] || 0) + 1;
      stats.bySeverity[issue.severity] = (stats.bySeverity[issue.severity] || 0) + 1;
      stats.byRole[entry.role] = (stats.byRole[entry.role] || 0) + 1;
      stats.byViewport[entry.viewport] = (stats.byViewport[entry.viewport] || 0) + 1;

      if (issue.type === 'HORIZONTAL_SCROLL_PAGE') stats.horizontalScrolls.push({ page: entry.page, vp: entry.viewport, detail: issue.detail });
      if (issue.type === 'TEXT_OVERFLOW_CLIPPED') stats.textOverflows.push({ page: entry.page, vp: entry.viewport, selector: issue.selector, detail: issue.detail });
      if (issue.type === 'ELEMENT_SPILLS_VIEWPORT') stats.viewportSpills.push({ page: entry.page, vp: entry.viewport, detail: issue.detail });
      if (issue.type === 'CONSOLE_ERROR') stats.consoleErrors.push({ page: entry.page, detail: issue.detail });
      if (issue.type === 'WCAG_CONTRAST_FAIL') stats.contrastFails++;
    }
  }

  return stats;
}

const beforeStats = summarize(beforeReport);
const afterStats = summarize(afterReport);

console.log('=== BEFORE VS AFTER AUDIT SUMMARY ===');
console.log('Total Issues:');
console.log(`  Before: ${beforeStats.total}`);
console.log(`  After:  ${afterStats.total}`);

console.log('\nIssues by Type:');
const allTypes = Array.from(new Set([...Object.keys(beforeStats.byType), ...Object.keys(afterStats.byType)]));
for (const t of allTypes) {
  console.log(`  ${t.padEnd(25)}: Before = ${beforeStats.byType[t] || 0}, After = ${afterStats.byType[t] || 0}`);
}

console.log('\nText Overflow / Clipping Count:');
console.log(`  Before: ${beforeStats.textOverflows.length}`);
console.log(`  After:  ${afterStats.textOverflows.length}`);
if (afterStats.textOverflows.length > 0) {
  console.log('  Remaining text overflows:');
  for (const o of afterStats.textOverflows.slice(0, 10)) {
    console.log(`    [${o.page} @ ${o.vp}] ${o.selector}: ${o.detail}`);
  }
}

console.log('\nPage-Level Horizontal Scrolling:');
console.log(`  Before: ${beforeStats.horizontalScrolls.length}`);
console.log(`  After:  ${afterStats.horizontalScrolls.length}`);

console.log('\nElement Spills Viewport:');
console.log(`  Before: ${beforeStats.viewportSpills.length}`);
console.log(`  After:  ${afterStats.viewportSpills.length}`);

console.log('\nConsole Errors:');
console.log(`  Before: ${beforeStats.consoleErrors.length}`);
console.log(`  After:  ${afterStats.consoleErrors.length}`);

// Inspect sample contrast failures in afterReport
console.log('\nSample Remaining Contrast Issues:');
const sampleContrast = [];
for (const entry of afterReport.fullReport) {
  for (const issue of entry.issues) {
    if (issue.type === 'WCAG_CONTRAST_FAIL' && sampleContrast.length < 15) {
      sampleContrast.push({ page: entry.page, theme: entry.theme, detail: issue.detail, selector: issue.selector });
    }
  }
}
for (const c of sampleContrast) {
  console.log(`  [${c.page} (${c.theme})] ${c.selector} -> ${c.detail}`);
}
