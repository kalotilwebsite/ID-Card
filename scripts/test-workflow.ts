import http from 'http';

function makeRequest(options: http.RequestOptions, postData?: any): Promise<{ statusCode: number; data: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : null;
          resolve({ statusCode: res.statusCode || 0, data: parsed, headers: res.headers });
        } catch {
          resolve({ statusCode: res.statusCode || 0, data: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTestSuite() {
  console.log('====================================================');
  console.log('STARTING AUTOMATED SECURITY & WORKFLOW VERIFICATION');
  console.log('====================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} - ${detail || ''}`);
      failed++;
    }
  }

  try {
    // 1. Test Supervisor Login with pre-assigned Enrollment ID
    console.log('\n--- 1. Testing Supervisor Authentication ---');
    const supLoginRes = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/supervisor-login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { employeeId: 'SUP-2026-01', password: 'supervisor123' }
    );

    assert(
      supLoginRes.statusCode === 200 && supLoginRes.data?.user?.role === 'supervisor',
      'Supervisor login succeeds with Enrollment ID & password',
      JSON.stringify(supLoginRes.data)
    );
    const supervisorToken = supLoginRes.data?.token;

    // Test invalid supervisor login
    const badLoginRes = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/supervisor-login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { employeeId: 'SUP-2026-01', password: 'wrongpassword' }
    );
    assert(badLoginRes.statusCode === 401, 'Invalid supervisor password rejected with 401');

    // 2. Test Admin Login
    console.log('\n--- 2. Testing Administrator Authentication ---');
    const adminLoginRes = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { username: 'admin', password: 'admin123' }
    );
    assert(
      adminLoginRes.statusCode === 200 && adminLoginRes.data?.user?.role === 'admin',
      'Admin login succeeds',
      JSON.stringify(adminLoginRes.data)
    );
    const adminToken = adminLoginRes.data?.token;

    // 3. Test Master Employee Lookup by Enrollment ID
    console.log('\n--- 3. Testing Employee Database Lookup ---');
    const lookupExisting = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/lookup-employee/586665',
      method: 'GET',
      headers: { Authorization: `Bearer ${supervisorToken}` },
    });
    assert(
      lookupExisting.statusCode === 200 && lookupExisting.data?.found === true && lookupExisting.data?.employee?.enrollId === '586665',
      'Supervisor can look up existing employee (586665) and receive read-only data',
      `Status: ${lookupExisting.statusCode}, Data: ${JSON.stringify(lookupExisting.data)}`
    );

    const lookupNonExistent = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/lookup-employee/NON_EXISTENT_9999',
      method: 'GET',
      headers: { Authorization: `Bearer ${supervisorToken}` },
    });
    assert(
      lookupNonExistent.statusCode === 404,
      'Looking up non-existent Enrollment ID returns 404 error'
    );

    // 4. Test ID Card Submission & Duplicate Prevention
    console.log('\n--- 4. Testing Employee ID Card Submission & Duplicate Prevention ---');
    // Ensure test ID is cleared before test
    await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/submissions/586667',
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    // Test NID > 15 digits rejection
    const rejectOver15Res = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/submissions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supervisorToken}`,
        },
      },
      {
        enrollId: '586667',
        nationalId: '19952692018000456', // 17 digits
        photoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        signatureUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      }
    );
    assert(
      rejectOver15Res.statusCode === 400 &&
        rejectOver15Res.data?.error === 'আইডি কার্ডের সংখ্যা অনেক বড় হলে প্রথম চারটি সংখ্যা বাদ দিয়ে লিখুন।',
      'NID > 15 digits rejected with 400 and Bengali instruction message',
      JSON.stringify(rejectOver15Res.data)
    );

    // Test valid submission with <= 15 digits (e.g. 15 digits)
    const submitRes = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/submissions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supervisorToken}`,
        },
      },
      {
        enrollId: '586667',
        nationalId: '123456789012345', // exactly 15 digits
        photoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        signatureUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      }
    );
    assert(
      submitRes.statusCode === 201 && submitRes.data?.success === true,
      'Supervisor can submit ID card data with NID (15 digits), photo & signature',
      JSON.stringify(submitRes.data)
    );

    // Test duplicate submission
    const duplicateRes = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/submissions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supervisorToken}`,
        },
      },
      {
        enrollId: '586667',
        nationalId: '123456789012345',
        photoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        signatureUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      }
    );
    assert(
      duplicateRes.statusCode === 409,
      'Duplicate submission for same Enrollment ID blocked with 409 Conflict'
    );

    // 5. Test Server-Side Role-Based Access Control (Supervisor Restrictions)
    console.log('\n--- 5. Testing Server-Side RBAC Restrictions for Supervisor ---');
    const supAccessSubmissions = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/submissions',
      method: 'GET',
      headers: { Authorization: `Bearer ${supervisorToken}` },
    });
    assert(
      supAccessSubmissions.statusCode === 403,
      'Supervisor cannot access Admin Submissions List (403 Forbidden)'
    );

    const supAccessSettings = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/settings',
      method: 'GET',
      headers: { Authorization: `Bearer ${supervisorToken}` },
    });
    assert(
      supAccessSettings.statusCode === 403,
      'Supervisor cannot access Admin Settings (403 Forbidden)'
    );

    const supAccessUsers = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/users',
      method: 'GET',
      headers: { Authorization: `Bearer ${supervisorToken}` },
    });
    assert(
      supAccessUsers.statusCode === 403,
      'Supervisor cannot access User Management (403 Forbidden)'
    );

    // 6. Test Admin Submission Management, Printing, and Reprinting
    console.log('\n--- 6. Testing Admin Print & Reprint Management ---');
    const adminGetSubmissions = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/submissions',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      adminGetSubmissions.statusCode === 200 && Array.isArray(adminGetSubmissions.data),
      'Admin can retrieve list of supervisor submissions'
    );

    const submittedCard = adminGetSubmissions.data.find((s: any) => s.enrollId === '586667');
    assert(
      submittedCard && submittedCard.printStatus === 'pending',
      'Newly submitted card is clearly identified with printStatus="pending"'
    );

    // Mark as printed
    const markPrintedRes = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/submissions/586667/mark-printed',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      },
      { note: 'Test initial print verification' }
    );
    assert(
      markPrintedRes.statusCode === 200 && markPrintedRes.data?.record?.printStatus === 'printed',
      'Admin can mark card as Printed, updating printStatus to "printed"'
    );

    // Reprint action
    const reprintRes = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/submissions/586667/reprint',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      },
      { note: 'Card damaged in packaging; reprint requested' }
    );
    assert(
      reprintRes.statusCode === 200 &&
      reprintRes.data?.record?.printCount >= 2 &&
      reprintRes.data?.record?.reprintHistory?.length >= 2,
      'Admin can issue Reprint, retaining printed status, incrementing print count, and logging history'
    );

    // 7. Test Admin Configurable Confirmation Message
    console.log('\n--- 7. Testing Admin Configurable Confirmation Message ---');
    const customMessage = 'Card data successfully recorded for Shift A! Admin office will print by 4:00 PM.';
    const updateSettingsRes = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/settings',
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      },
      { supervisorSuccessMessage: customMessage }
    );
    assert(
      updateSettingsRes.statusCode === 200 && updateSettingsRes.data?.supervisorSuccessMessage === customMessage,
      'Admin can configure the supervisor confirmation message in Admin Settings'
    );

    const publicSettingsRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/settings/public',
      method: 'GET',
      headers: { Authorization: `Bearer ${supervisorToken}` },
    });
    assert(
      publicSettingsRes.statusCode === 200 && publicSettingsRes.data?.supervisorSuccessMessage === customMessage,
      'Supervisor interface receives updated confirmation message from public endpoint'
    );

    console.log('\n====================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution failed with unexpected error:', err);
    process.exit(1);
  }
}

runTestSuite();
