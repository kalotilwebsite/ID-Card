import http from 'http';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

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

async function runProductionAudit() {
  console.log('================================================================');
  console.log('FINAL PRODUCTION-READINESS AUDIT & VERIFICATION');
  console.log('================================================================');

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
    // -------------------------------------------------------------
    // AUDIT ITEM 1: Unified Login & Authentication
    // -------------------------------------------------------------
    console.log('\n--- 1. Unified Login & RBAC Audit ---');

    // 1.1 Admin login with numeric Enroll: "466035" and numeric password "803517"
    const adminLogin1 = await makeRequest(
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
      adminLogin1.statusCode === 200 &&
        adminLogin1.data?.user?.role === 'admin' &&
        adminLogin1.data?.user?.employeeId === '466035' &&
        !adminLogin1.data?.user?.passwordHash,
      'Admin authenticates via Unified Login using numeric Enroll "466035" & Password "803517"'
    );
    const adminToken = adminLogin1.data?.token;

    // 1.1b Admin login via legacy Enroll alias "admin" with approved password
    const adminLoginLegacy = await makeRequest(
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
      adminLoginLegacy.statusCode === 200 && adminLoginLegacy.data?.user?.role === 'admin',
      'Admin authenticates via legacy identifier "admin" without duplicate account creation'
    );

    // 1.2 Admin login with Email/Username "Idcard@nuralam.com"
    const adminLogin2 = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { enroll: 'Idcard@nuralam.com', password: '803517' }
    );
    assert(
      adminLogin2.statusCode === 200 && adminLogin2.data?.user?.role === 'admin',
      'Admin authenticates via Unified Login using Email/Username "Idcard@nuralam.com"'
    );

    // 1.3 Supervisor login with Enroll: "SUP-2026-01"
    const supLogin1 = await makeRequest(
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
      supLogin1.statusCode === 200 &&
        supLogin1.data?.user?.role === 'supervisor' &&
        !supLogin1.data?.user?.passwordHash,
      'Supervisor authenticates via Unified Login using Enroll "SUP-2026-01" (no passwordHash exposed)'
    );
    const supervisorToken = supLogin1.data?.token;

    // 1.4 Invalid password rejected
    const badLogin = await makeRequest(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { enroll: 'admin', password: 'wrong_password_999' }
    );
    assert(badLogin.statusCode === 401, 'Invalid password correctly rejected with 401 Unauthorized');

    // -------------------------------------------------------------
    // AUDIT ITEM 2: Database Storage & File Synchronization
    // -------------------------------------------------------------
    console.log('\n--- 2. Database Storage & File Consistency Audit ---');

    // 2.1 Check db-status endpoint
    const dbStatusRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/system/db-status',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      dbStatusRes.statusCode === 200 && typeof dbStatusRes.data?.databaseType === 'string',
      `Active Database Backend identified: "${dbStatusRes.data?.databaseType}" (Mongo Connected: ${dbStatusRes.data?.isMongoConnected})`
    );

    // 2.2 Verify data/users.json and data/user.json synchronization
    const usersJsonPath = path.resolve('data/users.json');
    const userJsonPath = path.resolve('data/user.json');
    const usersExists = fs.existsSync(usersJsonPath);
    const userExists = fs.existsSync(userJsonPath);
    assert(usersExists && userExists, 'Both data/users.json and data/user.json exist on disk');

    if (usersExists && userExists) {
      const usersData = fs.readFileSync(usersJsonPath, 'utf-8');
      const userData = fs.readFileSync(userJsonPath, 'utf-8');
      assert(usersData.trim() === userData.trim(), 'data/users.json and data/user.json are 100% identical and synchronized');
    }

    // 2.3 Verify master employee database exists and preserves production records
    const masterJsonPath = path.resolve('data/master_employees.json');
    const masterExists = fs.existsSync(masterJsonPath);
    assert(masterExists, 'data/master_employees.json exists on disk');
    if (masterExists) {
      const masterContent = JSON.parse(fs.readFileSync(masterJsonPath, 'utf-8'));
      assert(
        Boolean(masterContent['586665'] && masterContent['586665'].name === 'MD. RABIUL AWAL'),
        'Existing employee record (586665: MD. RABIUL AWAL) is intact and preserved'
      );
    }

    // -------------------------------------------------------------
    // AUDIT ITEM 3: Image Optimization & Output Size Verification
    // -------------------------------------------------------------
    console.log('\n--- 3. Image Optimization & Size Verification Audit ---');

    // Create a realistic high-detail image buffer (~400 KB) using sharp with diverse pixel data
    const noiseData = Buffer.alloc(900 * 900 * 3);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = (i * 47 + (i % 255)) % 256;
    }
    const highResBuffer = await sharp(noiseData, {
      raw: { width: 900, height: 900, channels: 3 },
    })
      .jpeg({ quality: 90 })
      .toBuffer();

    const highResDataUrl = `data:image/jpeg;base64,${highResBuffer.toString('base64')}`;
    const initialBytes = highResBuffer.length;
    console.log(`Initial high-detail test image size: ${(initialBytes / 1024).toFixed(1)} KB (exceeds 200 KB target)`);

    // Clean up temporary audit record if present
    await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/master-employees/AUDIT-TEMP-001',
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    // Submit employee with this >300 KB image
    const createWithOversize = await makeRequest(
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
        enrollId: 'AUDIT-TEMP-001',
        name: 'AUDIT IMAGE WORKER',
        designation: 'Test Engineer',
        photo: highResDataUrl,
      }
    );

    assert(
      createWithOversize.statusCode === 201 && Boolean(createWithOversize.data?.employee?.photo),
      'Server accepts oversized image (>300 KB) and successfully optimizes it instead of unnecessarily rejecting it'
    );

    // Verify stored output size
    const storedPhoto = createWithOversize.data?.employee?.photo || '';
    const storedBase64 = storedPhoto.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
    const storedBytes = Math.round((storedBase64.length * 3) / 4);
    console.log(`Stored optimized image output size: ${(storedBytes / 1024).toFixed(1)} KB`);

    assert(
      storedBytes <= 200 * 1024,
      `Stored image output size (${(storedBytes / 1024).toFixed(1)} KB) strictly satisfies <= 200 KB limit`
    );

    // Clean up temporary audit record
    await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/master-employees/AUDIT-TEMP-001',
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    // Create an unsubmitted master record for the oversized payload rejection test
    await makeRequest(
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
        enrollId: 'AUDIT-UNSUB-001',
        name: 'AUDIT UNSUBMITTED WORKER',
      }
    );

    // Test rejection of non-image junk payload > 1.5MB with Bangla alert
    const junkOversized = 'data:image/jpeg;base64,' + 'X'.repeat(2 * 1024 * 1024);
    const oversizeRejectRes = await makeRequest(
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
        enrollId: 'AUDIT-UNSUB-001',
        nationalId: '19852691234567890',
        photoUrl: junkOversized,
        signatureUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      }
    );

    assert(
      oversizeRejectRes.statusCode === 400 &&
        oversizeRejectRes.data?.sizeExceeded === true &&
        oversizeRejectRes.data?.error?.includes('২০০ কিলোবাইটের'),
      'Oversized corrupt payload rejected with Bangla size alert (২০০ কিলোবাইটের)'
    );

    // Clean up unsubmitted test employee
    await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/master-employees/AUDIT-UNSUB-001',
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    // -------------------------------------------------------------
    // AUDIT ITEM 4: Employee Database Management & Immediate Lookup
    // -------------------------------------------------------------
    console.log('\n--- 4. Employee Database & Supervisor Lookup Audit ---');

    // Create isolated test employee
    const newEmpRes = await makeRequest(
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
        enrollId: 'AUDIT-EMP-999',
        name: 'AUDIT VERIFIED OPERATOR',
        designation: 'Chief Inspector',
        department: 'Quality',
      }
    );
    assert(newEmpRes.statusCode === 201, 'Admin creates individual employee (AUDIT-EMP-999)');

    // Immediate lookup by supervisor
    const lookupRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/lookup-employee/AUDIT-EMP-999',
      method: 'GET',
      headers: { Authorization: `Bearer ${supervisorToken}` },
    });
    assert(
      lookupRes.statusCode === 200 &&
        lookupRes.data?.found === true &&
        lookupRes.data?.employee?.name === 'AUDIT VERIFIED OPERATOR',
      'Immediate availability: Supervisor looks up newly created employee successfully'
    );

    // Immediate search by supervisor
    const searchRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/master-employees/search?q=VERIFIED',
      method: 'GET',
      headers: { Authorization: `Bearer ${supervisorToken}` },
    });
    assert(
      searchRes.statusCode === 200 &&
        searchRes.data?.results?.some((r: any) => r.enrollId === 'AUDIT-EMP-999'),
      'Immediate availability: Supervisor search auto-suggest finds newly created employee'
    );

    // Duplicate creation blocked
    const duplicateRes = await makeRequest(
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
        enrollId: 'AUDIT-EMP-999',
        name: 'DUPLICATE ATTEMPT',
      }
    );
    assert(duplicateRes.statusCode === 409, 'Duplicate Enrollment ID creation prevented with 409 Conflict');

    // Clean up isolated test employee
    await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/master-employees/AUDIT-EMP-999',
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    // -------------------------------------------------------------
    // AUDIT ITEM 5: Security & Role-Based Access Control
    // -------------------------------------------------------------
    console.log('\n--- 5. Security & RBAC Enforcement Audit ---');

    const supSubmissionsRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/submissions',
      method: 'GET',
      headers: { Authorization: `Bearer ${supervisorToken}` },
    });
    assert(supSubmissionsRes.statusCode === 403, 'Supervisor forbidden from GET /api/submissions (403)');

    const supSettingsRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/settings',
      method: 'GET',
      headers: { Authorization: `Bearer ${supervisorToken}` },
    });
    assert(supSettingsRes.statusCode === 403, 'Supervisor forbidden from GET /api/settings (403)');

    const supUsersRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/users',
      method: 'GET',
      headers: { Authorization: `Bearer ${supervisorToken}` },
    });
    assert(supUsersRes.statusCode === 403, 'Supervisor forbidden from GET /api/users (403)');

    console.log('\n================================================================');
    console.log(`AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Audit execution error:', err);
    process.exit(1);
  }
}

runProductionAudit();
