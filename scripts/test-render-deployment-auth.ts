import http from 'http';
import assert from 'assert';
import { normalizeRole, getEffectiveAllowedTabs } from '../server.ts';
import { normalizeUserRole } from '../src/services/apiService.ts';

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

async function runRenderAuthTests() {
  console.log('====================================================');
  console.log('TESTING RENDER DEPLOYMENT & ROLE-BASED AUTH RESILIENCE');
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

  // 1. Role Normalization (Case-insensitivity & aliases)
  console.log('\n--- 1. Testing normalizeRole and normalizeUserRole ---');
  testAssert(normalizeRole('ADMIN') === 'admin', 'Server normalizeRole handles "ADMIN" uppercase');
  testAssert(normalizeRole('Admin') === 'admin', 'Server normalizeRole handles "Admin" capitalized');
  testAssert(normalizeRole('administrator') === 'admin', 'Server normalizeRole handles "administrator"');
  testAssert(normalizeRole('SUPERVISOR') === 'supervisor', 'Server normalizeRole handles "SUPERVISOR"');
  testAssert(normalizeRole('data_entry') === 'data_entry', 'Server normalizeRole handles "data_entry"');
  testAssert(normalizeRole('DATA-ENTRY') === 'data_entry', 'Server normalizeRole handles "DATA-ENTRY"');
  testAssert(normalizeRole('', 'admin_user') === 'admin', 'Server normalizeRole falls back on username containing admin');
  testAssert(normalizeRole('', 'supervisor_1') === 'supervisor', 'Server normalizeRole falls back on username containing supervisor');

  testAssert(normalizeUserRole('ADMIN') === 'admin', 'Client normalizeUserRole handles "ADMIN"');
  testAssert(normalizeUserRole('Supervisor') === 'supervisor', 'Client normalizeUserRole handles "Supervisor"');
  testAssert(normalizeUserRole(undefined, 'admin') === 'admin', 'Client normalizeUserRole fallback for undefined role');

  // 2. Tab Permissions
  console.log('\n--- 2. Testing Allowed Tabs Assignment ---');
  const adminTabs = getEffectiveAllowedTabs({ role: 'ADMIN' });
  testAssert(adminTabs.includes('user_management') && adminTabs.length === 6, 'Admin receives all 6 tabs even if raw role was uppercase');
  const supTabs = getEffectiveAllowedTabs({ role: 'SUPERVISOR' });
  testAssert(supTabs.includes('supervisor_submission') && supTabs.length === 1, 'Supervisor receives supervisor_submission tab');

  // 3. API Login with Admin / 466035
  console.log('\n--- 3. Testing API Login Response Payload Consistency ---');
  const res = await makeRequest(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { enrollmentId: 'Admin', password: '466035' }
  );

  testAssert(res.statusCode === 200, 'Login status is 200');
  testAssert(res.data.token && typeof res.data.token === 'string', 'Token is present');
  testAssert(res.data.role === 'admin', 'Top-level role is "admin"');
  testAssert(Boolean(res.data.id && res.data.username && res.data.employeeId && res.data.name), 'Top-level user properties (id, username, employeeId, name) are non-empty');
  testAssert(res.data.user && res.data.user.role === 'admin', 'res.data.user.role is "admin"');
  testAssert(Boolean(res.data.user.id && res.data.user.username && res.data.user.name), 'Nested user properties are non-empty');
  testAssert(Array.isArray(res.data.user.allowedTabs), 'allowedTabs is an array');

  // 4. Test /api/auth/me Response Payload
  console.log('\n--- 4. Testing /api/auth/me Response Payload ---');
  const meRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/me',
    method: 'GET',
    headers: { Authorization: `Bearer ${res.data.token}` },
  });

  testAssert(meRes.statusCode === 200, '/api/auth/me status is 200');
  testAssert(meRes.data.role === 'admin', '/api/auth/me top-level role is "admin"');
  testAssert(Boolean(meRes.data.username && meRes.data.name), '/api/auth/me top-level properties are non-empty');
  testAssert(meRes.data.user && meRes.data.user.role === 'admin', '/api/auth/me nested user.role is "admin"');

  // 5. Check Supervisor Login Response Payload
  console.log('\n--- 5. Testing Supervisor Login Response Payload ---');
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

  testAssert(supRes.statusCode === 200, 'Supervisor login status is 200');
  testAssert(supRes.data.role === 'supervisor', 'Supervisor top-level role is "supervisor"');
  testAssert(supRes.data.user && supRes.data.user.role === 'supervisor', 'Supervisor nested user.role is "supervisor"');

  console.log(`\n====================================================`);
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`====================================================`);
  if (failed > 0) process.exit(1);
}

runRenderAuthTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
