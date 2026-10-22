import assert from 'assert';
import { AKIJ_BASHIR_LOGO_BASE64, FRONT_FOOTER_LOGO_BASE64 } from '../src/data/cardAssets.ts';
import { BACK_TEMPLATE_SVG, FRONT_TEMPLATE_SVG } from '../src/data/cardTemplates.ts';
import { CARD_WIDTH, CARD_HEIGHT, DEFAULT_CALIBRATION } from '../src/types/index.ts';

async function runLayoutAndBackRenderingTests() {
  console.log('====================================================');
  console.log('TESTING ID CARD LAYOUT, DATA PERSISTENCE & ISOLATION');
  console.log('====================================================');

  let passed = 0;
  let failed = 0;

  function testAssert(condition: boolean, name: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} - ${detail || ''}`);
      failed++;
    }
  }

  // 1. Back Part Logo & Template Verification
  console.log('\n--- 1. Testing Back Part Logo & Base64 Assets ---');
  testAssert(
    typeof AKIJ_BASHIR_LOGO_BASE64 === 'string' && AKIJ_BASHIR_LOGO_BASE64.startsWith('data:image/png;base64,'),
    'AKIJ_BASHIR_LOGO_BASE64 is a valid Base64 PNG data URI'
  );
  testAssert(
    AKIJ_BASHIR_LOGO_BASE64.length > 5000,
    'AKIJ_BASHIR_LOGO_BASE64 has sufficient byte length for high resolution footer branding'
  );
  testAssert(
    decodeURIComponent(BACK_TEMPLATE_SVG).includes('image href="data:image/png;base64,'),
    'BACK_TEMPLATE_SVG directly embeds Base64 logo avoiding browser CORS/relative path load failures'
  );

  // 2. Front Template Logo Verification
  console.log('\n--- 2. Testing Front Part Base64 Assets ---');
  testAssert(
    typeof FRONT_FOOTER_LOGO_BASE64 === 'string' && FRONT_FOOTER_LOGO_BASE64.startsWith('data:image/png;base64,'),
    'FRONT_FOOTER_LOGO_BASE64 is a valid Base64 PNG data URI'
  );
  testAssert(
    decodeURIComponent(FRONT_TEMPLATE_SVG).includes('image href="data:image/png;base64,'),
    'FRONT_TEMPLATE_SVG directly embeds Base64 logo avoiding browser CORS/network errors'
  );

  // 3. Dimensions and Calibration Bounds
  console.log('\n--- 3. Testing Dimensions & Calibration Defaults ---');
  testAssert(CARD_WIDTH === 284, 'CARD_WIDTH is 284px');
  testAssert(CARD_HEIGHT === 500, 'CARD_HEIGHT is 500px');
  testAssert(Boolean(DEFAULT_CALIBRATION.back.emergencyContact.x), 'Emergency contact calibration exists');
  testAssert(Boolean(DEFAULT_CALIBRATION.back.nationalId.x), 'National ID calibration exists');
  testAssert(Boolean(DEFAULT_CALIBRATION.back.bloodGroup.x), 'Blood Group calibration exists');

  // 4. Test Public Settings Endpoint via Fetch
  console.log('\n--- 4. Testing Public Settings Endpoint for Supervisor Toggles ---');
  try {
    const res = await fetch('http://localhost:3000/api/settings/public');
    const settings = await res.json();
    testAssert(res.status === 200, 'Public settings HTTP status is 200');
    testAssert(
      settings.supervisorPhotoCameraEnabled !== undefined,
      'supervisorPhotoCameraEnabled toggle is present in public settings'
    );
    testAssert(
      settings.supervisorSignatureCameraEnabled !== undefined,
      'supervisorSignatureCameraEnabled toggle is present in public settings'
    );
    testAssert(
      settings.supervisorSignaturePadEnabled !== undefined,
      'supervisorSignaturePadEnabled toggle is present in public settings'
    );
  } catch (err: any) {
    testAssert(false, 'Public settings fetch succeeded', err.message);
  }

  console.log('\n====================================================');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runLayoutAndBackRenderingTests();
