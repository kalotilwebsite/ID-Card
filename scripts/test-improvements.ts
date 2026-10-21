import { calculatePrintGeometry, PAPER_DIMENSIONS_MM } from '../src/services/pdfExportService';
import { PrintSettings, SupportedPaperSize } from '../src/types';

async function runTests() {
  console.log('=== RUNNING TESTS FOR 5 IMPROVEMENTS ===\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ': ' + detail : ''}`);
    }
  }

  // -------------------------------------------------------------
  // TEST GROUP 1: PDF Layout & Page Boundary Math (Requirement 4)
  // -------------------------------------------------------------
  console.log('\n--- 1. PDF Page Boundary & Scaling Tests ---');
  const paperSizesToTest: SupportedPaperSize[] = ['a4', 'a5', 'letter', 'a3', 'legal'];
  const layoutsToTest = ['side-by-side', 'top-and-bottom', 'duplex'] as const;
  const cardsPerPageConfigs = [
    { cols: 2, rows: 2 }, // 4 cards
    { cols: 3, rows: 2 }, // 6 cards
    { cols: 3, rows: 3 }, // 9 cards
    { cols: 4, rows: 2 }, // 8 cards
  ];

  for (const paperSize of paperSizesToTest) {
    for (const layout of layoutsToTest) {
      for (const config of cardsPerPageConfigs) {
        const settings: PrintSettings = {
          paperSize,
          orientation: 'portrait',
          cardWidthMm: 54,
          cardHeightMm: 85.6,
          marginsMm: { top: 10, bottom: 10, left: 10, right: 10 },
          spacingMm: { horizontal: 5, vertical: 5 },
          columnsPerPage: config.cols,
          rowsPerPage: config.rows,
          layoutMode: layout,
          showCutMarks: true,
          cardBorderRadiusMm: 3,
        };

        const geom = calculatePrintGeometry(settings);

        // Aspect ratio test
        const expectedRatio = 85.6 / 54;
        const actualRatio = geom.cardHeightMm / geom.cardWidthMm;
        const ratioDelta = Math.abs(expectedRatio - actualRatio);

        // Total grid boundary test
        const unitsAcross =
          layout === 'side-by-side'
            ? geom.colsOfPairs * 2
            : geom.cols;
        const unitsDown =
          layout === 'top-and-bottom'
            ? geom.rowsOfPairs * 2
            : geom.rows;

        const totalGridW = unitsAcross * geom.cardWidthMm + (unitsAcross - 1) * geom.gapX;
        const totalGridH = unitsDown * geom.cardHeightMm + (unitsDown - 1) * geom.gapY;

        const endX = geom.startX + totalGridW;
        const endY = geom.startY + totalGridH;

        const fitsHorizontally = geom.startX >= 2.0 && endX <= geom.pageWidthMm + 0.01;
        const fitsVertically = geom.startY >= 2.0 && endY <= geom.pageHeightMm + 0.01;
        const ratioPreserved = ratioDelta < 0.01;

        assert(
          fitsHorizontally && fitsVertically && ratioPreserved,
          `PDF Bounds Check: ${paperSize.toUpperCase()} | ${layout} | ${config.cols}x${config.rows} (${geom.cardWidthMm.toFixed(1)}x${geom.cardHeightMm.toFixed(1)}mm, scale: ${(geom.scaleFactor * 100).toFixed(0)}%)`,
          `startX=${geom.startX.toFixed(1)}, endX=${endX.toFixed(1)} / ${geom.pageWidthMm}, startY=${geom.startY.toFixed(1)}, endY=${endY.toFixed(1)} / ${geom.pageHeightMm}`
        );
      }
    }
  }

  // -------------------------------------------------------------
  // TEST GROUP 2: API Endpoints (Search, Auth, Maintenance, Settings)
  // -------------------------------------------------------------
  console.log('\n--- 2. Backend API & Authentication Tests ---');

  const BASE_URL = 'http://127.0.0.1:3000';

  try {
    // 2.1 Public Settings Endpoint
    const publicSettingsRes = await fetch(`${BASE_URL}/api/settings/public`);
    const publicSettings = await publicSettingsRes.json();
    assert(
      publicSettingsRes.ok && typeof publicSettings.loginBackgroundImage === 'string',
      'GET /api/settings/public returns loginBackgroundImage and status',
      JSON.stringify(publicSettings)
    );

    // 2.2 Admin Login
    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Idcard@nuralam.com', password: '@466035$' }),
    });
    const adminData = await adminLoginRes.json();
    const adminToken = adminData.token;
    assert(adminLoginRes.ok && Boolean(adminToken), 'Admin login successful and returned token');

    // 2.3 Supervisor Login
    const supLoginRes = await fetch(`${BASE_URL}/api/auth/supervisor-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: 'SUP-2026-01', password: 'supervisor123' }),
    });
    const supData = await supLoginRes.json();
    const supToken = supData.token;
    assert(supLoginRes.ok && Boolean(supToken), 'Supervisor login successful and returned token');

    // 2.4 Search Employee by ID or Name
    const searchRes = await fetch(`${BASE_URL}/api/master-employees/search?q=586`, {
      headers: { Authorization: `Bearer ${supToken}` },
    });
    const searchData = await searchRes.json();
    assert(
      searchRes.ok && Array.isArray(searchData.results) && searchData.results.length > 0,
      'Supervisor auto-search for "586" returns matching employee results',
      `Found ${searchData.results?.length} records`
    );

    const searchNameRes = await fetch(`${BASE_URL}/api/master-employees/search?q=Rabiul`, {
      headers: { Authorization: `Bearer ${supToken}` },
    });
    const searchNameData = await searchNameRes.json();
    assert(
      searchNameRes.ok && searchNameData.results.some((r: any) => r.enrollId === '586665'),
      'Supervisor auto-search for "Rabiul" returns MD. RABIUL AWAL (586665)'
    );

    // 2.5 Lookup Employee Details
    const lookupRes = await fetch(`${BASE_URL}/api/lookup-employee/586665`, {
      headers: { Authorization: `Bearer ${supToken}` },
    });
    const lookupData = await lookupRes.json();
    assert(
      lookupRes.ok && lookupData.found && lookupData.employee?.enrollId === '586665',
      'Employee lookup for 586665 successfully returns full master record'
    );

    // 2.6 Maintenance Mode Toggle (Turn OFF)
    const customMaintenanceMsg = 'সাময়িক রক্ষণাবেক্ষণের জন্য আইডি কার্ড আবেদন কার্যক্রম বন্ধ রয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।';
    const updateOffRes = await fetch(`${BASE_URL}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        supervisorFormEnabled: false,
        supervisorFormDisabledMessage: customMaintenanceMsg,
        loginBackgroundImage: '/assets/default_login_bg.jpg',
      }),
    });
    assert(updateOffRes.ok, 'Admin successfully set supervisorFormEnabled = false');

    // 2.7 Verify Supervisor Search & Lookup are blocked with 403 in Maintenance Mode
    const searchBlockedRes = await fetch(`${BASE_URL}/api/master-employees/search?q=586`, {
      headers: { Authorization: `Bearer ${supToken}` },
    });
    assert(
      searchBlockedRes.status === 403,
      'Supervisor search is strictly rejected with 403 in Maintenance Mode'
    );

    const lookupBlockedRes = await fetch(`${BASE_URL}/api/lookup-employee/586665`, {
      headers: { Authorization: `Bearer ${supToken}` },
    });
    assert(
      lookupBlockedRes.status === 403,
      'Supervisor lookup is strictly rejected with 403 in Maintenance Mode'
    );

    const submitBlockedRes = await fetch(`${BASE_URL}/api/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supToken}`,
      },
      body: JSON.stringify({
        enrollId: '586665',
        nationalId: '19852691234567890',
        photoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        signatureUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      }),
    });
    assert(
      submitBlockedRes.status === 403,
      'Supervisor submission is strictly rejected with 403 in Maintenance Mode'
    );

    // 2.8 Re-enable Supervisor Form (Turn ON)
    const updateOnRes = await fetch(`${BASE_URL}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        supervisorFormEnabled: true,
      }),
    });
    assert(updateOnRes.ok, 'Admin successfully re-enabled supervisorFormEnabled = true');

    // 2.9 Verify Search & Lookup work again after re-enabling
    const searchAfterReenable = await fetch(`${BASE_URL}/api/master-employees/search?q=586`, {
      headers: { Authorization: `Bearer ${supToken}` },
    });
    assert(
      searchAfterReenable.ok,
      'Supervisor search works normally after re-enabling form'
    );

    // 2.10 Login Background Customization Persistence
    const customBgTestUri = '/assets/default_login_bg.jpg';
    const updateBgRes = await fetch(`${BASE_URL}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        loginBackgroundImage: customBgTestUri,
        paperSize: 'a4',
      }),
    });
    assert(updateBgRes.ok, 'Admin saved custom login background image');

    const verifyPublicSettings = await (await fetch(`${BASE_URL}/api/settings/public`)).json();
    assert(
      verifyPublicSettings.loginBackgroundImage === customBgTestUri,
      'Public settings returns updated login background image correctly'
    );

  } catch (err: any) {
    console.error('API Test Error:', err);
  }

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} PASSED`);
  console.log(`========================================\n`);

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests();
