import http from 'http';
import assert from 'assert';
import fs from 'fs';

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
          const json = body ? JSON.parse(body) : null;
          resolve({ statusCode: res.statusCode || 0, data: json, headers: res.headers });
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

async function verifyAuthSuite() {
  console.log('====================================================');
  console.log('COMPREHENSIVE LOGIN & AUTHENTICATION VERIFICATION');
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

  // 1. Test Admin Login with Admin / 466035
  console.log('\n--- 1. Testing Intended Admin Credentials (Admin / 466035) ---');
  const adminRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { username: 'Admin', password: '466035' }
  );

  testAssert(adminRes.statusCode === 200, 'Admin login HTTP status 200');
  testAssert(typeof adminRes.data?.token === 'string' && adminRes.data.token.length > 10, 'Valid token returned');
  testAssert(adminRes.data?.user?.role === 'admin', 'Nested user.role is "admin"');
  testAssert(adminRes.data?.role === 'admin', 'Top-level role is "admin" (dual-structure compatibility)');
  testAssert(Array.isArray(adminRes.data?.user?.allowedTabs) && adminRes.data.user.allowedTabs.length === 6, 'Admin has full 6 tabs');
  testAssert(!adminRes.data?.user?.passwordHash && !adminRes.data?.passwordHash, 'No password hashes exposed');

  // Case-insensitive check
  const adminLowerRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { enrollmentId: 'admin', password: '466035' }
  );
  testAssert(adminLowerRes.statusCode === 200 && adminLowerRes.data?.user?.role === 'admin', 'Case-insensitive enrollmentId "admin" succeeds');

  // 2. Test /api/auth/me with returned token
  console.log('\n--- 2. Testing /api/auth/me Profile Verification ---');
  const meRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/me',
    method: 'GET',
    headers: { Authorization: `Bearer ${adminRes.data.token}` },
  });

  testAssert(meRes.statusCode === 200, '/api/auth/me returns HTTP 200');
  testAssert(meRes.data?.user?.role === 'admin', 'me endpoint returns nested user with role "admin"');
  testAssert(meRes.data?.role === 'admin', 'me endpoint returns top-level role "admin"');

  // 3. Test Invalid Password Rejection (Must not bypass auth or crash)
  console.log('\n--- 3. Testing Bad Password Rejection & Security ---');
  const badLogin = await makeRequest(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { username: 'Admin', password: 'incorrect_password_999' }
  );

  testAssert(badLogin.statusCode === 401, 'Bad password cleanly rejected with 401');
  testAssert(badLogin.data?.error === 'Invalid Enrollment ID or password.', 'Descriptive error message returned');
  testAssert(!badLogin.data?.user, 'No user data returned on bad credentials');

  // 4. Test Supervisor Login
  console.log('\n--- 4. Testing Supervisor Login & Workflow Preservation ---');
  const supRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/supervisor-login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { employeeId: 'SUP-2026-01', password: 'supervisor123' }
  );

  testAssert(supRes.statusCode === 200, 'Supervisor login returns 200');
  testAssert(supRes.data?.user?.role === 'supervisor', 'Supervisor user.role is "supervisor"');
  testAssert(supRes.data?.role === 'supervisor', 'Supervisor top-level role is "supervisor"');

  // 5. Test Data Entry Operator Login
  console.log('\n--- 5. Testing Operator Login & Workflow Preservation ---');
  const opRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { username: 'operator1', password: 'operator123' }
  );

  testAssert(opRes.statusCode === 200, 'Operator login returns 200');
  testAssert(opRes.data?.user?.role === 'data_entry', 'Operator user.role is "data_entry"');
  testAssert(opRes.data?.role === 'data_entry', 'Operator top-level role is "data_entry"');

  // 6. Verify Non-Overwriting Existing Account Rule
  console.log('\n--- 6. Verifying Existing Accounts Are NOT Reset or Overwritten on Login ---');
  const usersBefore = fs.readFileSync('data/users.json', 'utf-8');
  // Attempt invalid login on existing user
  await makeRequest(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { username: 'operator1', password: '466035' }
  );
  const usersAfter = fs.readFileSync('data/users.json', 'utf-8');
  testAssert(usersBefore === usersAfter, 'Database records in data/users.json remain untouched (no overwrite)');

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

verifyAuthSuite().catch((err) => {
  console.error('Test script exception:', err);
  process.exit(1);
});
