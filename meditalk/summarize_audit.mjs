import fs from 'fs';
import path from 'path';

const reportPath = 'C:/Users/ASUS/.gemini/antigravity-ide/brain/4f0eeea2-cebb-44bd-a073-5384402f41fd/initial_ui_audit_report.json';
const data = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

console.log(`Total Scanned View entries with issues: ${data.fullReport.length}`);
console.log(`Total Issue instances: ${data.totalIssues}`);

const issuesByType = {};
const issuesByPage = {};
const issuesBySelector = {};
const contrastFailures = new Set();
const horizontalOverflows = [];
const elementSpills = [];

for (const entry of data.fullReport) {
  for (const issue of entry.issues) {
    issuesByType[issue.type] = (issuesByType[issue.type] || 0) + 1;
    const pageKey = `${entry.role || 'public'}:${entry.page}`;
    issuesByPage[pageKey] = (issuesByPage[pageKey] || 0) + 1;
    
    if (issue.selector) {
      issuesBySelector[issue.selector] = (issuesBySelector[issue.selector] || 0) + 1;
    }

    if (issue.type === 'PAGE_HORIZONTAL_OVERFLOW') {
      horizontalOverflows.push({
        page: entry.page,
        role: entry.role,
        viewport: entry.viewport,
        width: entry.width,
        detail: issue.detail,
        screenshot: entry.screenshot,
      });
    }

    if (issue.type === 'ELEMENT_SPILLS_VIEWPORT') {
      elementSpills.push({
        page: entry.page,
        role: entry.role,
        viewport: entry.viewport,
        width: entry.width,
        selector: issue.selector,
        detail: issue.detail,
      });
    }

    if (issue.type === 'WCAG_CONTRAST_FAIL') {
      contrastFailures.add(`${issue.selector} -> ${issue.detail}`);
    }
  }
}

console.log('\n--- Breakdown by Issue Type ---');
console.table(issuesByType);

console.log('\n--- Top 15 Selectors Causing Issues ---');
const sortedSelectors = Object.entries(issuesBySelector).sort((a, b) => b[1] - a[1]).slice(0, 15);
console.table(sortedSelectors);

console.log('\n--- Horizontal Page Overflows ---');
console.table(horizontalOverflows.slice(0, 10));

console.log('\n--- Element Spills Sample ---');
console.table(elementSpills.slice(0, 15));

console.log(`\nUnique Contrast Issues: ${contrastFailures.size}`);
console.log('Sample Contrast Issues:');
Array.from(contrastFailures).slice(0, 15).forEach(c => console.log('  *', c));
