// Set up in-memory localStorage and window mock for Node test environment
const mockStorage: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, val: string) => {
    mockStorage[key] = String(val);
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    for (const k in mockStorage) delete mockStorage[k];
  },
};
(global as any).window = {
  location: { origin: 'http://localhost:3000' },
  dispatchEvent: (_evt: any) => true,
  addEventListener: () => {},
  removeEventListener: () => {},
};

import { apiService, getStoredToken, getStoredUser, setStoredToken, setStoredUser } from '../src/services/apiService';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('====================================================');
  console.log('TESTING INCOGNITO AUTH BYPASS FIX & ROUTE GUARDS');
  console.log('====================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`[PASS] ${msg}`);
      passed++;
    } else {
      console.error(`[FAIL] ${msg}`);
      failed++;
    }
  }

  // --- 1. Fresh Incognito Simulation (No Token Stored) ---
  console.log('\n--- 1. Simulating Fresh Incognito Window (Empty Storage) ---');
  setStoredToken(null);
  setStoredUser(null);

  assert(getStoredToken() === null, 'Storage has no token');
  assert(getStoredUser() === null, 'Storage has no user');

  // Verify that getCurrentUser without a token returns null and does NOT auto-login
  const incognitoUser = await apiService.getCurrentUser();
  assert(incognitoUser === null, 'getCurrentUser() strictly returns null when no token is present');
  assert(getStoredToken() === null, 'Storage remains strictly null (NO silent auto-login occurred)');

  // --- 2. Unauthenticated Protected Backend Endpoints ---
  console.log('\n--- 2. Unauthenticated Protected Backend Endpoints ---');
  const protectedEndpoints = [
    '/api/auth/me',
    '/api/submissions',
    '/api/users',
    '/api/master-employees',
    '/api/settings',
  ];

  for (const ep of protectedEndpoints) {
    const res = await fetch(`${BASE_URL}${ep}`);
    assert(
      res.status === 401,
      `Unauthenticated access to ${ep} returns 401 Unauthorized (got ${res.status})`
    );
    const body = await res.json().catch(() => ({}));
    assert(
      body.error !== undefined,
      `Unauthenticated access to ${ep} returns descriptive error payload: "${body.error}"`
    );
  }

  // --- 3. Forged / Invalid Token Access Rejection ---
  console.log('\n--- 3. Forged / Invalid Token Rejection ---');
  const fakeTokenRes = await fetch(`${BASE_URL}/api/submissions`, {
    headers: { Authorization: 'Bearer forged-invalid-token-12345' },
  });
  assert(
    fakeTokenRes.status === 401,
    `Forged token access returns 401 Unauthorized (got ${fakeTokenRes.status})`
  );

  // --- 4. Legitimate User Authentication ---
  console.log('\n--- 4. Legitimate User Authentication ---');
  // Admin login via HTTP endpoint
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enrollmentId: 'Admin', password: '466035' }),
  });
  assert(loginRes.status === 200, 'Admin login HTTP status is 200');
  const loginData = await loginRes.json();
  assert(Boolean(loginData?.token), 'Admin login returns a valid token');
  assert(loginData?.user?.role === 'admin', 'Admin user role is "admin"');

  // Set the valid token in storage to simulate browser state
  setStoredToken(loginData.token);
  setStoredUser(loginData.user);
  assert(getStoredToken() === loginData.token, 'Token correctly persisted in session');

  // Verify access with Bearer token
  const subsRes = await fetch(`${BASE_URL}/api/submissions`, {
    headers: { Authorization: `Bearer ${loginData.token}` },
  });
  assert(subsRes.status === 200, 'Authenticated admin can access /api/submissions (HTTP 200)');

  // --- 5. Logout & Session Invalidation ---
  console.log('\n--- 5. Sign Out / Session Clearing ---');
  apiService.logout();
  assert(getStoredToken() === null, 'Token cleared after logout');
  assert(getStoredUser() === null, 'User cleared after logout');

  const afterLogoutUser = await apiService.getCurrentUser();
  assert(afterLogoutUser === null, 'After logout, getCurrentUser() returns null');

  console.log('\n====================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Test execution failed:', e);
  process.exit(1);
});
