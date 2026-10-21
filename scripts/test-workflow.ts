import http from 'http';

function makeRequest(
  options: http.RequestOptions,
  postData?: any
): Promise<{ statusCode: number; data: any; headers: http.IncomingHttpHeaders }> {
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
  console.log('STARTING UPDATED SECURITY & WORKFLOW VERIFICATION');
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
    // 1. Test Admin Login with Approved Numeric Credentials: 466035 / 803517
    console.log('\n--- 1. Testing Administrator Authentication ---');
    const adminLoginRes = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { enroll: '466035', password: '803517' }
    );
    assert(
      adminLoginRes.statusCode === 200 &&
        adminLoginRes.data?.user?.role === 'admin' &&
        adminLoginRes.data?.user?.employeeId === '466035',
      'Admin logs in successfully with numeric Enroll "466035" and numeric password "803517"',
      JSON.stringify(adminLoginRes.data)
    );
    const adminToken = adminLoginRes.data?.token;

    // Test unified login: Admin logs in with legacy alias enroll: 'admin'
    const adminEnrollLogin = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { enroll: 'admin', password: '803517' }
    );
    assert(
      adminEnrollLogin.statusCode === 200 && adminEnrollLogin.data?.user?.role === 'admin',
      'Unified login: Admin logs in successfully using legacy alias "admin"',
      JSON.stringify(adminEnrollLogin.data)
    );

    // Test invalid admin password
    const badAdminLogin = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { username: 'Idcard@nuralam.com', password: 'wrongpassword' }
    );
    assert(badAdminLogin.statusCode === 401, 'Invalid admin password rejected with 401');

    // 2. Test Supervisor Authentication
    console.log('\n--- 2. Testing Supervisor Authentication ---');
    // Test unified login: Supervisor logs in using Enroll field
    const supUnifiedLogin = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { enroll: 'SUP-2026-01', password: 'supervisor123' }
    );
    assert(
      supUnifiedLogin.statusCode === 200 && supUnifiedLogin.data?.user?.role === 'supervisor',
      'Unified login: Supervisor logs in successfully using Enroll field "SUP-2026-01"',
      JSON.stringify(supUnifiedLogin.data)
    );

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
    const badSupLogin = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/supervisor-login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { employeeId: 'SUP-2026-01', password: 'wrongpassword' }
    );
    assert(badSupLogin.statusCode === 401, 'Invalid supervisor password rejected with 401');

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
      lookupExisting.statusCode === 200 &&
        lookupExisting.data?.found === true &&
        lookupExisting.data?.employee?.enrollId === '586665',
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

    // 4. Test Bulk Import & Duplicate Prevention
    console.log('\n--- 4. Testing Employee Data Bulk Import & Duplicate Prevention ---');
    // Clean up test records if present from earlier runs
    await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/master-employees/BULK-TEST-001',
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/master-employees/BULK-TEST-002',
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    // Prepare test records:
    // - 2 new unique records
    // - 1 record duplicating 586665 (existing in database, must NOT overwrite)
    // - 1 internal duplicate in the batch
    // - 1 invalid record (missing enrollId)
    const importPayload = [
      {
        enrollId: 'BULK-TEST-001',
        name: 'Bulk Worker One',
        designation: 'Technician',
        department: 'Maintenance',
      },
      {
        enrollId: 'BULK-TEST-002',
        name: 'Bulk Worker Two',
        designation: 'Operator',
        department: 'Packaging',
      },
      {
        enrollId: '586665', // Existing in DB!
        name: 'MD. RABIUL AWAL (ATTEMPTED OVERWRITE)',
        designation: 'Hacker',
        department: 'Illegal',
      },
      {
        enrollId: 'BULK-TEST-001', // Duplicate in batch!
        name: 'Bulk Worker One Duplicate',
      },
      {
        enrollId: '', // Invalid record
        name: 'Missing ID Worker',
      },
    ];

    const importRes = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/master-employees/import',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      },
      { employees: importPayload }
    );

    assert(
      importRes.statusCode === 200 &&
        importRes.data?.summary?.successful === 2 &&
        importRes.data?.summary?.duplicates === 2 &&
        importRes.data?.summary?.failed === 1,
      'Bulk import correctly processed: 2 added, 2 duplicates skipped, 1 invalid skipped',
      JSON.stringify(importRes.data)
    );

    // Verify existing record 586665 was NOT overwritten!
    const verifyNotOverwritten = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/lookup-employee/586665',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      verifyNotOverwritten.statusCode === 200 &&
        verifyNotOverwritten.data?.employee?.name === 'MD. RABIUL AWAL',
      'Existing employee 586665 was preserved and NEVER silently overwritten',
      verifyNotOverwritten.data?.employee?.name
    );

    // Test Employee Editing Endpoint (PUT /api/master-employees/:enrollId)
    console.log('\n--- 5. Testing Employee Record Editing (Admin) ---');
    const editRes = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/master-employees/BULK-TEST-001',
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      },
      {
        designation: 'Senior Lead Technician',
        emergencyContact: '01700-112233',
        bloodGroup: 'AB+',
        nationalId: '1998543210123',
      }
    );
    assert(
      editRes.statusCode === 200 &&
        editRes.data?.employee?.designation === 'Senior Lead Technician' &&
        editRes.data?.employee?.bloodGroup === 'AB+',
      'Admin can edit employee record fields',
      JSON.stringify(editRes.data)
    );

    // 5b. Test Admin-Only Individual Employee Creation, Duplicate Prevention & Immediate Searchability
    console.log('\n--- 5b. Testing Admin-Only Individual Employee Creation & Searchability ---');
    // Clean up test record if present from earlier runs
    await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/master-employees/INDIV-TEST-001',
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    // 1. Missing required field (missing name) -> must return 400
    const missingNameRes = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/master-employees',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      },
      { enrollId: 'INDIV-TEST-001', name: '' }
    );
    assert(missingNameRes.statusCode === 400, 'Employee creation without name rejected with 400 Bad Request');

    // 2. Missing required field (missing enrollId) -> must return 400
    const missingIdRes = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/master-employees',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      },
      { enrollId: '', name: 'Test Person' }
    );
    assert(missingIdRes.statusCode === 400, 'Employee creation without Enrollment ID rejected with 400 Bad Request');

    // 3. Non-admin (supervisor) attempting creation -> must return 403
    const supCreateRes = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/master-employees',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supervisorToken}`,
        },
      },
      { enrollId: 'INDIV-TEST-001', name: 'Unauthorized Person' }
    );
    assert(supCreateRes.statusCode === 403, 'Supervisor forbidden from creating master employee records (403)');

    // 4. Successful Admin individual creation
    const createSuccessRes = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/master-employees',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      },
      {
        enrollId: 'INDIV-TEST-001',
        name: 'MOKLESUR RAHMAN',
        designation: 'Senior QC Auditor',
        department: 'Quality Assurance',
        jobType: 'Permanent',
        bloodGroup: 'B+',
        joiningDate: '01/01/2026',
        cardIssue: '19/10/2026',
        emergencyContact: '01711-223344',
        permanentAddress: 'Dhanmondi, Dhaka',
        nationalId: '19902691500001234',
      }
    );
    assert(
      createSuccessRes.statusCode === 201 && createSuccessRes.data?.employee?.enrollId === 'INDIV-TEST-001',
      'Admin creates individual employee record successfully with 201 Created',
      JSON.stringify(createSuccessRes.data)
    );

    // 5. Duplicate Enrollment ID creation blocked -> must return 409 Conflict
    const duplicateCreateRes = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/master-employees',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      },
      {
        enrollId: 'INDIV-TEST-001',
        name: 'ATTEMPTED DUPLICATE MOKLESUR',
        designation: 'Impostor',
      }
    );
    assert(
      duplicateCreateRes.statusCode === 409,
      'Duplicate Enrollment ID creation strictly rejected with 409 Conflict'
    );

    // 6. Immediate Searchability: Supervisor search finds newly created employee
    const supSearchNew = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/master-employees/search?q=MOKLESUR',
      method: 'GET',
      headers: { Authorization: `Bearer ${supervisorToken}` },
    });
    assert(
      supSearchNew.statusCode === 200 &&
        supSearchNew.data?.results?.some((r: any) => r.enrollId === 'INDIV-TEST-001'),
      'Newly created employee is IMMEDIATELY available for supervisor search',
      JSON.stringify(supSearchNew.data)
    );

    // 7. Immediate Lookup: Supervisor lookup returns full record
    const supLookupNew = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/lookup-employee/INDIV-TEST-001',
      method: 'GET',
      headers: { Authorization: `Bearer ${supervisorToken}` },
    });
    assert(
      supLookupNew.statusCode === 200 &&
        supLookupNew.data?.found === true &&
        supLookupNew.data?.employee?.name === 'MOKLESUR RAHMAN',
      'Newly created employee is IMMEDIATELY available for supervisor lookup with complete details',
      JSON.stringify(supLookupNew.data)
    );

    // 8. Edit individual employee
    const editIndivRes = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/master-employees/INDIV-TEST-001',
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      },
      {
        designation: 'Principal Quality Auditor',
        bloodGroup: 'O+',
      }
    );
    assert(
      editIndivRes.statusCode === 200 &&
        editIndivRes.data?.employee?.designation === 'Principal Quality Auditor' &&
        editIndivRes.data?.employee?.bloodGroup === 'O+',
      'Admin updates individual employee fields successfully'
    );

    // 9. Edit with empty name rejected
    const editEmptyNameRes = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/master-employees/INDIV-TEST-001',
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      },
      { name: '   ' }
    );
    assert(editEmptyNameRes.statusCode === 400, 'Updating employee with empty name rejected with 400 Bad Request');


    // 6. Test Supervisor Form ON/OFF Control
    console.log('\n--- 6. Testing Supervisor Form ON/OFF Control ---');
    const customDisabledMessage = 'Maintenance Mode: ID Card submissions are currently disabled.';

    // Turn form OFF
    const disableFormRes = await makeRequest(
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
      {
        supervisorFormEnabled: false,
        supervisorFormDisabledMessage: customDisabledMessage,
      }
    );
    assert(
      disableFormRes.statusCode === 200 && disableFormRes.data?.supervisorFormEnabled === false,
      'Admin turns Supervisor Form OFF in Settings'
    );

    // Verify public endpoint reflects form OFF
    const checkPublicDisabled = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/settings/public',
      method: 'GET',
      headers: { Authorization: `Bearer ${supervisorToken}` },
    });
    assert(
      checkPublicDisabled.statusCode === 200 &&
        checkPublicDisabled.data?.supervisorFormEnabled === false &&
        checkPublicDisabled.data?.supervisorFormDisabledMessage === customDisabledMessage,
      'Public settings endpoint reflects form disabled and custom message'
    );

    // Clear submission test ID
    await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/submissions/BULK-TEST-001',
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    // Try submitting when Form is OFF -> Must be blocked with 403 on server side!
    const submitWhenDisabled = await makeRequest(
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
        enrollId: 'BULK-TEST-001',
        nationalId: '1998543210123',
        photoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        signatureUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      }
    );
    assert(
      submitWhenDisabled.statusCode === 403 && submitWhenDisabled.data?.formDisabled === true,
      'Supervisor submission strictly blocked on server side (403) when form is OFF',
      JSON.stringify(submitWhenDisabled.data)
    );

    // Turn form back ON
    const enableFormRes = await makeRequest(
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
      {
        supervisorFormEnabled: true,
      }
    );
    assert(
      enableFormRes.statusCode === 200 && enableFormRes.data?.supervisorFormEnabled === true,
      'Admin turns Supervisor Form back ON'
    );

    // 7. Test Supervisor Submission & Duplicate Prevention
    console.log('\n--- 7. Testing Supervisor Submission & Duplicate Prevention ---');
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
        enrollId: 'BULK-TEST-001',
        nationalId: '1998543210123',
        photoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        signatureUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      }
    );
    assert(
      submitRes.statusCode === 201 && submitRes.data?.success === true,
      'Supervisor submits ID card data successfully when form is ON',
      JSON.stringify(submitRes.data)
    );

    // Test duplicate submission blocked with 409
    const duplicateSubmitRes = await makeRequest(
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
        enrollId: 'BULK-TEST-001',
        nationalId: '1998543210123',
        photoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        signatureUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      }
    );
    assert(
      duplicateSubmitRes.statusCode === 409,
      'Duplicate submission for same Enrollment ID blocked with 409 Conflict'
    );

    // Test Oversized Image Payload Rejection (defense-in-depth)
    const oversizedBase64 = 'data:image/jpeg;base64,' + 'A'.repeat(2 * 1024 * 1024);
    const oversizeRes = await makeRequest(
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
        enrollId: 'BULK-TEST-002',
        nationalId: '1998543210123',
        photoUrl: oversizedBase64,
        signatureUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      }
    );
    assert(
      oversizeRes.statusCode === 400 && oversizeRes.data?.sizeExceeded === true,
      'Oversized image payload strictly rejected on server with Bangla size alert message'
    );

    // 8. Test PDF Print Layout Settings
    console.log('\n--- 8. Testing PDF Print Layout Settings ---');
    const updateLayoutTopBottom = await makeRequest(
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
      { pdfPrintLayout: 'top_bottom' }
    );
    assert(
      updateLayoutTopBottom.statusCode === 200 &&
        updateLayoutTopBottom.data?.pdfPrintLayout === 'top_bottom',
      'Admin can configure and save PDF Print Layout as Top and Bottom'
    );

    const updateLayoutSideBySide = await makeRequest(
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
      { pdfPrintLayout: 'side_by_side' }
    );
    assert(
      updateLayoutSideBySide.statusCode === 200 &&
        updateLayoutSideBySide.data?.pdfPrintLayout === 'side_by_side',
      'Admin can configure and save PDF Print Layout as Side by Side'
    );

    // 9. Test Server-Side RBAC Restrictions for Supervisor
    console.log('\n--- 9. Testing Server-Side RBAC Restrictions for Supervisor ---');
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

    // 10. Test Admin Submission Management, Printing, and Reprinting
    console.log('\n--- 10. Testing Admin Print & Reprint Management ---');
    const adminGetSubmissions = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/submissions',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      adminGetSubmissions.statusCode === 200 && Array.isArray(adminGetSubmissions.data),
      'Admin retrieves list of submitted records'
    );

    const testCard = adminGetSubmissions.data.find((s: any) => s.enrollId === 'BULK-TEST-001');
    assert(
      testCard && testCard.printStatus === 'pending',
      'Submitted card is identified with printStatus="pending"'
    );

    // Mark as printed
    const markPrintedRes = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/submissions/BULK-TEST-001/mark-printed',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      },
      { note: 'Test initial print' }
    );
    assert(
      markPrintedRes.statusCode === 200 && markPrintedRes.data?.record?.printStatus === 'printed',
      'Admin marks card as Printed, updating printStatus to "printed"'
    );

    // Reprint action
    const reprintRes = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/submissions/BULK-TEST-001/reprint',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      },
      { note: 'Reprint verification test' }
    );
    assert(
      reprintRes.statusCode === 200 &&
        reprintRes.data?.record?.printCount >= 2 &&
        reprintRes.data?.record?.reprintHistory?.length >= 2,
      'Admin issues Reprint, preserving printed status, incrementing print count, and logging history'
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
