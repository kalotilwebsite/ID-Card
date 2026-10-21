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

async function runAuditTests() {
  console.log('=================================================================');
  console.log('AUDITING ROLES, PERMISSIONS, RESTRICTED EDITING & DELETION APIS');
  console.log('=================================================================');

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
    // 1. Admin login
    const adminRes = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { enrollmentId: 'Admin', password: '466035' }
    );
    assert(adminRes.statusCode === 200, 'Admin can login');
    const adminToken = adminRes.data?.token;

    // 2. Test Master Employees list
    const empListRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/master-employees',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(empListRes.statusCode === 200 && Array.isArray(empListRes.data), 'Admin can get master employees');

    // 3. Test Restricted Edit of an employee (Emergency Contact & Blood Group only)
    console.log('\n--- Testing Restricted Employee Editing ---');
    const targetEmpId = '586665';
    const updateRes = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: `/api/master-employees/${targetEmpId}`,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      },
      {
        emergencyContact: '01999-123456',
        bloodGroup: 'B+',
        // Attempt to illicitly change restricted fields
        name: 'HACKED NAME',
        designation: 'CEO',
      }
    );
    assert(updateRes.statusCode === 200, 'Update contact number & blood group succeeds');
    assert(updateRes.data?.employee?.emergencyContact === '01999-123456', 'Emergency contact updated');
    assert(updateRes.data?.employee?.bloodGroup === 'B+', 'Blood group updated');
    assert(updateRes.data?.employee?.name === 'MD. RABIUL AWAL', 'Protected field Name was NOT modified');
    assert(updateRes.data?.employee?.designation === 'Asst.Caster', 'Protected field Designation was NOT modified');

    // Revert employee 586665 back to original
    await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: `/api/master-employees/${targetEmpId}`,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      },
      { emergencyContact: '01920-694100', bloodGroup: 'O+' }
    );

    // Test invalid blood group rejection
    const invalidBgRes = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: `/api/master-employees/${targetEmpId}`,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      },
      { bloodGroup: 'XYZ_INVALID' }
    );
    assert(invalidBgRes.statusCode === 400, 'Invalid blood group rejected with 400');

    // 4. Test Employee Deletion: Add a temporary employee, delete it, and verify
    console.log('\n--- Testing Individual Employee Deletion ---');
    const tempEnrollId = 'TEST_EMP_999';
    await makeRequest(
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
      {
        employees: [
          {
            enrollId: tempEnrollId,
            name: 'Temporary Test Employee',
            designation: 'Tester',
            department: 'QA',
            jobType: 'Contract',
            joiningDate: '01/01/2026',
            cardIssue: '01/01/2026',
            emergencyContact: '01700-000000',
            bloodGroup: 'AB+',
          },
        ],
      }
    );

    // Delete single employee
    const deleteSingleRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: `/api/master-employees/${tempEnrollId}`,
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(deleteSingleRes.statusCode === 200, 'Individual employee deletion succeeds');

    // Verify deletion
    const verifyDeleteRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: `/api/lookup-employee/${tempEnrollId}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(verifyDeleteRes.statusCode === 404, 'Deleted employee no longer exists in database');

    // Test Delete All functionality (backup current records first, clear, verify, and restore)
    console.log('\n--- Testing Delete All Employees ---');
    const existingBeforeDeleteAll = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/master-employees',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const backupEmployees = Array.isArray(existingBeforeDeleteAll.data) ? existingBeforeDeleteAll.data : [];

    // Issue Delete All
    const deleteAllRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/master-employees',
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(deleteAllRes.statusCode === 200, 'Delete All master employees succeeds with 200');

    // Verify database is empty
    const checkEmptyRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/master-employees',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      checkEmptyRes.statusCode === 200 && Array.isArray(checkEmptyRes.data) && checkEmptyRes.data.length === 0,
      'Database is confirmed empty after Delete All'
    );

    // Restore backed-up records
    if (backupEmployees.length > 0) {
      await makeRequest(
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
        { employees: backupEmployees }
      );
    }

    // Verify restored records
    const checkRestoredRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/master-employees',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      checkRestoredRes.statusCode === 200 &&
        Array.isArray(checkRestoredRes.data) &&
        checkRestoredRes.data.length === backupEmployees.length,
      `Master employees restored successfully (${backupEmployees.length} records preserved)`
    );

    // 5. Test Data Entry Role & Tab Permissions (Create, Assign, Enforce)
    console.log('\n--- Testing Data Entry Role Tab Permissions ---');
    const testUsername = `de_test_${Date.now()}`;
    const createDeUserRes = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/users',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      },
      {
        username: testUsername,
        password: 'password123',
        name: 'Test Data Entry Op',
        role: 'data_entry',
        // Give access only to 'data_entry_form' and 'employee_data'
        allowedTabs: ['data_entry_form', 'employee_data'],
      }
    );
    assert(createDeUserRes.statusCode === 201, 'Admin can create Data Entry user with specific allowedTabs');
    const deUserId = createDeUserRes.data?.id;

    // Login as new Data Entry user
    const deLoginRes = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { username: testUsername, password: 'password123' }
    );
    assert(deLoginRes.statusCode === 200, 'Data Entry user can login');
    const deToken = deLoginRes.data?.token;

    // Test allowed endpoint (employee_data)
    const deAllowedAccess = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/master-employees',
      method: 'GET',
      headers: { Authorization: `Bearer ${deToken}` },
    });
    assert(deAllowedAccess.statusCode === 200, 'Data Entry user can access permitted tab endpoint (/api/master-employees)');

    // Test forbidden endpoint (user_management)
    const deForbiddenAccess1 = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/users',
      method: 'GET',
      headers: { Authorization: `Bearer ${deToken}` },
    });
    assert(deForbiddenAccess1.statusCode === 403, 'Data Entry user is blocked from unpermitted tab endpoint (/api/users) with 403');

    // Test forbidden endpoint (submissions)
    const deForbiddenAccess2 = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/submissions',
      method: 'GET',
      headers: { Authorization: `Bearer ${deToken}` },
    });
    assert(deForbiddenAccess2.statusCode === 403, 'Data Entry user is blocked from unpermitted tab endpoint (/api/submissions) with 403');

    // Admin updates the Data Entry user to grant 'submissions' tab access as well
    const updateDeUserRes = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: `/api/users/${deUserId}`,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      },
      {
        allowedTabs: ['data_entry_form', 'employee_data', 'submissions'],
      }
    );
    assert(updateDeUserRes.statusCode === 200, 'Admin can update Data Entry allowedTabs');

    // Now test that Data Entry user can access submissions
    const deNowAllowedAccess = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/submissions',
      method: 'GET',
      headers: { Authorization: `Bearer ${deToken}` },
    });
    assert(deNowAllowedAccess.statusCode === 200, 'Data Entry user can now access newly permitted tab endpoint (/api/submissions)');

    // Clean up test user
    await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: `/api/users/${deUserId}`,
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    console.log('\n=================================================================');
    console.log(`AUDIT TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('=================================================================');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Audit failed with error:', err);
    process.exit(1);
  }
}

runAuditTests();
