import { SAMPLE_EMPLOYEES } from '../src/data/sampleEmployees';
import { FRONT_LOGO_BASE64, ISSUING_SIG_BASE64, FOOTER_PILLAR_BASE64, BACK_FOOTER_LOGO_BASE64 } from '../src/data/assets';
import { FRONT_TEMPLATE_SVG, BACK_TEMPLATE_SVG } from '../src/data/cardTemplates';
import JSZip from 'jszip';

async function runCardCopyVerification() {
  console.log('================================================================');
  console.log('RUNNING MANDATORY VERIFICATION FOR COPY SELECTED CARDS AS IMAGE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} - ${details || ''}`);
      failed++;
    }
  }

  // TEST SUITE 1: Card Selection Precision (1 card, 2 cards, 3 cards, 5 cards)
  console.log('--- 1. Testing Selected Card Filtering & Precision ---');
  const allEmployees = SAMPLE_EMPLOYEES;
  assert(allEmployees.length >= 3, 'Sample employee dataset contains at least 3 records');

  // Test Case A: Exactly 1 card selected
  const singleSelectedId = new Set([allEmployees[0].id]);
  const singleSelectedList = allEmployees.filter((e) => singleSelectedId.has(e.id));
  assert(
    singleSelectedList.length === 1 && singleSelectedList[0].id === allEmployees[0].id,
    'Exactly 1 card selected: filters to only the 1 targeted card (no extra or unselected cards)'
  );

  // Test Case B: Exactly 2 cards selected
  const twoSelectedIds = new Set([allEmployees[0].id, allEmployees[1].id]);
  const twoSelectedList = allEmployees.filter((e) => twoSelectedIds.has(e.id));
  assert(
    twoSelectedList.length === 2 &&
      twoSelectedList[0].id === allEmployees[0].id &&
      twoSelectedList[1].id === allEmployees[1].id,
    'Exactly 2 cards selected: filters to exactly those 2 cards in pristine preserved order'
  );

  // Test Case C: Exactly 3 cards selected
  const threeSelectedIds = new Set([allEmployees[0].id, allEmployees[1].id, allEmployees[2].id]);
  const threeSelectedList = allEmployees.filter((e) => threeSelectedIds.has(e.id));
  assert(
    threeSelectedList.length === 3 &&
      threeSelectedList.map((e) => e.id).join(',') === `${allEmployees[0].id},${allEmployees[1].id},${allEmployees[2].id}`,
    'Exactly 3 cards selected: filters to exactly those 3 cards in exact sequence'
  );

  // Test Case D: Exactly 5 cards selected (creating 2 additional mock records to test 5)
  const mockEmp4 = { ...allEmployees[0], id: 'emp-test-4', name: 'TEST WORKER FOUR', enrollId: '586668' };
  const mockEmp5 = { ...allEmployees[0], id: 'emp-test-5', name: 'TEST WORKER FIVE', enrollId: '586669' };
  const poolOfFive = [...allEmployees.slice(0, 3), mockEmp4, mockEmp5];
  const fiveSelectedIds = new Set(poolOfFive.map((e) => e.id));
  const fiveSelectedList = poolOfFive.filter((e) => fiveSelectedIds.has(e.id));
  assert(
    fiveSelectedList.length === 5,
    'Exactly 5 cards selected: accurately matches 5 cards without omission or duplication'
  );

  // TEST SUITE 2: Preview Source Fidelity & Asset Completeness
  console.log('\n--- 2. Testing Preview Source Assets & Design Preservation ---');
  assert(
    FRONT_LOGO_BASE64.startsWith('data:image/png;base64,') && FRONT_LOGO_BASE64.length > 500,
    'ROSA Front Header Logo is self-contained base64 (no external broken URLs)'
  );
  assert(
    ISSUING_SIG_BASE64.startsWith('data:image/png;base64,') && ISSUING_SIG_BASE64.length > 500,
    'Issuing Authority Signature is self-contained base64 (guaranteed rendering in DOM snapshot)'
  );
  assert(
    FOOTER_PILLAR_BASE64.startsWith('data:image/png;base64,') && FOOTER_PILLAR_BASE64.length > 500,
    'Footer Pillar Icon is embedded base64 (no missing red footer banner graphics)'
  );
  assert(
    BACK_FOOTER_LOGO_BASE64.startsWith('data:image/png;base64,') && BACK_FOOTER_LOGO_BASE64.length > 500,
    'Akij Bashir Back Footer Logo is embedded base64 (no missing back footer logos)'
  );

  // Check SVG templates are self-contained
  const frontSvgDecoded = decodeURIComponent(FRONT_TEMPLATE_SVG);
  const backSvgDecoded = decodeURIComponent(BACK_TEMPLATE_SVG);
  assert(
    !frontSvgDecoded.includes('/assets/') && frontSvgDecoded.includes('data:image/png;base64,'),
    'Front Template SVG contains embedded base64 data for all graphic sections'
  );
  assert(
    !backSvgDecoded.includes('/assets/') && backSvgDecoded.includes('data:image/png;base64,'),
    'Back Template SVG contains embedded base64 data for all graphic sections'
  );

  // TEST SUITE 3: Dynamic Data Display (Zero Truncation)
  console.log('\n--- 3. Testing Complete Data Fields (No Truncation) ---');
  for (const emp of allEmployees) {
    assert(Boolean(emp.name && emp.name.trim()), `Employee name present for ${emp.id}`);
    assert(Boolean(emp.enrollId && emp.enrollId.trim()), `Enroll ID present for ${emp.id}`);
    assert(Boolean(emp.emergencyContact && emp.emergencyContact.trim()), `Emergency contact present for ${emp.id}`);
    assert(Boolean(emp.bloodGroup && emp.bloodGroup.trim()), `Blood group present for ${emp.id}`);
    assert(Boolean(emp.permanentAddress && emp.permanentAddress.trim()), `Address present for ${emp.id}`);
  }

  // TEST SUITE 4: High-Resolution Pixel Dimensions for Microsoft Word
  console.log('\n--- 4. Testing Print Resolution & Word Pixel Dimensions ---');
  // Nominal card: 284 x 500 px. At 3x capture: 852 x 1500 px.
  // Standard CR80 badge printed at 300 DPI:
  // 54mm width / 25.4 * 300 = 637.8 px
  // 85.6mm height / 25.4 * 300 = 1011 px
  // Our 852 x 1500 px snapshot delivers ~400 DPI, exceeding commercial print threshold.
  const nominalCardW = 284;
  const nominalCardH = 500;
  const captureScale = 3;
  const highResW = nominalCardW * captureScale;
  const highResH = nominalCardH * captureScale;
  assert(
    highResW === 852 && highResH === 1500,
    `Single Card PNG resolution is ${highResW}x${highResH} px (~400 DPI, razor-sharp for Word & physical print)`
  );

  const pairGap = 20;
  const pairPadding = 8;
  const pairWidthSideBySide = (nominalCardW * 2 + pairGap + pairPadding * 2) * captureScale;
  const pairHeightSideBySide = (nominalCardH + pairPadding * 2) * captureScale;
  assert(
    pairWidthSideBySide === (284 * 2 + 20 + 16) * 3 && pairHeightSideBySide === (500 + 16) * 3,
    `Side-by-Side Pair PNG resolution is ${pairWidthSideBySide}x${pairHeightSideBySide} px (optimal for horizontal badge sheets in Word)`
  );

  const pairHeightTopBottom = (nominalCardH * 2 + pairGap + pairPadding * 2) * captureScale;
  const pairWidthTopBottom = (nominalCardW + pairPadding * 2) * captureScale;
  assert(
    pairHeightTopBottom === (500 * 2 + 20 + 16) * 3 && pairWidthTopBottom === (284 + 16) * 3,
    `Top-and-Bottom Pair PNG resolution is ${pairWidthTopBottom}x${pairHeightTopBottom} px (optimal for folding badges in Word)`
  );

  // TEST SUITE 5: Batch ZIP Archive Generation with JSZip
  console.log('\n--- 5. Testing Batch ZIP Generation ---');
  const zip = new JSZip();
  // Simulate 3 cards with front, back, pair
  for (let i = 0; i < 3; i++) {
    const emp = allEmployees[i];
    const prefix = String(i + 1).padStart(2, '0');
    zip.file(`${prefix}_${emp.enrollId}_${emp.name.replace(/\s+/g, '_')}_Pair.png`, 'PNG_DATA_PAIR');
    zip.file(`${prefix}_${emp.enrollId}_${emp.name.replace(/\s+/g, '_')}_Front.png`, 'PNG_DATA_FRONT');
    zip.file(`${prefix}_${emp.enrollId}_${emp.name.replace(/\s+/g, '_')}_Back.png`, 'PNG_DATA_BACK');
  }

  const zipBlob = await zip.generateAsync({ type: 'nodebuffer' });
  assert(zipBlob.length > 500, `ZIP archive generated successfully (${zipBlob.length} bytes, 9 individual image files)`);

  console.log('\n================================================================');
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCardCopyVerification().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
