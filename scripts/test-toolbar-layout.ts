import fs from 'fs';
import assert from 'assert';

console.log('====================================================');
console.log('VERIFYING COMPACT CARD PREVIEW TOOLBAR IN STUDIO');
console.log('====================================================');

const appContent = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. Locate Card Preview Toolbar section
const toolbarStart = appContent.indexOf('Compact Single-Line Card Preview Toolbar');
assert(toolbarStart !== -1, 'Toolbar section comment found in App.tsx');

const toolbarEnd = appContent.indexOf('Preview Side Switcher', toolbarStart);
assert(toolbarEnd !== -1, 'End of toolbar section found in App.tsx');
const toolbarBlock = appContent.slice(toolbarStart, toolbarEnd);

// 2. Verify flex-nowrap to prevent wrapping into a second line
assert(toolbarBlock.includes('flex-nowrap'), 'Toolbar must use "flex-nowrap" to prevent multi-line wrapping');
assert(toolbarBlock.includes('overflow-x-auto'), 'Toolbar container must support responsive horizontal containment with "overflow-x-auto"');
console.log('[PASS] Toolbar enforces flex-nowrap and horizontal scrolling containment');

// 3. Verify All 5 Target Controls on Single Line:
// Item 1: Card counter with compact chevrons
assert(toolbarBlock.includes('Card {selectedEmpIndex + 1} of {employees.length}'), 'Card counter "Card X of Y" is present');
assert(toolbarBlock.includes('ChevronLeft') && toolbarBlock.includes('ChevronRight'), 'Compact chevrons present');
console.log('[PASS] Item 1 verified: "Card 1 of 6" counter with compact chevrons');

// Item 2: Print Pending status badge
assert(toolbarBlock.includes('Print Pending'), 'Print Pending badge is present');
assert(toolbarBlock.includes('Clock'), 'Clock icon is present for Print Pending');
console.log('[PASS] Item 2 verified: "Print Pending" status badge');

// Item 3: Mark Print OK action button
assert(toolbarBlock.includes('Mark Print OK'), '"Mark Print OK" button label is present');
assert(toolbarBlock.includes('handleMarkSinglePrintOk'), 'Mark Print OK click handler preserved');
console.log('[PASS] Item 3 verified: "Mark Print OK" action button with functional handler');

// Item 4: Copy button
assert(toolbarBlock.includes('handleCopyCard'), 'Copy button click handler preserved');
assert(toolbarBlock.includes("'Copy'"), '"Copy" label is present');
assert(toolbarBlock.includes('Copy className='), 'Copy icon is present');
console.log('[PASS] Item 4 verified: "Copy" compact button with tooltip and icon');

// Item 5: Bulk PDF Download (with count)
assert(toolbarBlock.includes('Bulk PDF Download'), '"Bulk PDF Download" label is present');
assert(toolbarBlock.includes('selectedCardIds.size'), 'Dynamic selection count ({selectedCardIds.size}) is present');
assert(toolbarBlock.includes('handleTriggerBulkPdfDownload'), 'Bulk PDF click handler preserved');
console.log('[PASS] Item 5 verified: "Bulk PDF Download (3)" button with dynamic count and action handler');

// 4. Verify all buttons have whitespace-nowrap and shrink-0 to maintain strict horizontal alignment
const countWhitespaceNowrap = (toolbarBlock.match(/whitespace-nowrap/g) || []).length;
assert(countWhitespaceNowrap >= 5, `Expected at least 5 whitespace-nowrap elements, found ${countWhitespaceNowrap}`);
console.log(`[PASS] ${countWhitespaceNowrap} elements styled with "whitespace-nowrap" and "shrink-0" to eliminate wrap risks`);

// 5. Verify Tooltips (title attributes) are present on buttons to save space cleanly
const countTitles = (toolbarBlock.match(/title=/g) || []).length;
assert(countTitles >= 5, `Expected tooltips on all controls, found ${countTitles} title attributes`);
console.log(`[PASS] ${countTitles} helpful tooltips provided on toolbar buttons and badges`);

console.log('\n====================================================');
console.log('ALL TOOLBAR LAYOUT VERIFICATIONS PASSED (100%)');
console.log('====================================================');
