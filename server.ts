import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const DATA_DIR = path.resolve(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MASTER_FILE = path.join(DATA_DIR, 'master_employees.json');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

interface AppSettings {
  supervisorSuccessMessage: string;
  supervisorFormEnabled: boolean;
  supervisorFormDisabledMessage: string;
  pdfPrintLayout: 'side_by_side' | 'top_bottom';
}

const DEFAULT_SETTINGS: AppSettings = {
  supervisorSuccessMessage:
    'Employee ID Card data has been submitted successfully and queued for administrative review and printing. Thank you!',
  supervisorFormEnabled: true,
  supervisorFormDisabledMessage:
    'Employee ID Card submission is temporarily closed by the administrator. Please check back later.',
  pdfPrintLayout: 'side_by_side',
};

// Helper for atomic file read/write
function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), 'utf-8');
      return fallback;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return fallback;
  }
}

function writeJsonFile<T>(filePath: string, data: T): void {
  try {
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
  }
}

// Password hashing helper
function hashPassword(password: string, salt = 'idcard_salt_2026'): string {
  return crypto.scryptSync(password, salt, 32).toString('hex');
}

// Persistent token store: saved to DATA_DIR/sessions.json
function getSessions(): Record<string, { userId: string; expiresAt: number }> {
  return readJsonFile<Record<string, { userId: string; expiresAt: number }>>(SESSIONS_FILE, {});
}

function saveSessions(sessions: Record<string, { userId: string; expiresAt: number }>): void {
  writeJsonFile(SESSIONS_FILE, sessions);
}

function createToken(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const sessions = getSessions();
  // 30 days expiration
  sessions[token] = { userId, expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 };
  saveSessions(sessions);
  return token;
}

function validateAndGetSession(token: string): { userId: string; expiresAt: number } | null {
  const sessions = getSessions();
  const session = sessions[token];
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    delete sessions[token];
    saveSessions(sessions);
    return null;
  }
  return session;
}

function removeSession(token: string): void {
  const sessions = getSessions();
  if (sessions[token]) {
    delete sessions[token];
    saveSessions(sessions);
  }
}

// Initialize seed data
function initializeDatabase() {
  // 1. Users - ensure initial admin credentials: Email: Idcard@nuralam.com, Password: @466035$
  const users = readJsonFile<any[]>(USERS_FILE, []);
  let admin = users.find((u) => u.role === 'admin');
  if (!admin) {
    admin = {
      id: 'user-admin-1',
      username: 'Idcard@nuralam.com',
      passwordHash: hashPassword('@466035$'),
      name: 'System Administrator',
      email: 'Idcard@nuralam.com',
      role: 'admin',
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    users.unshift(admin);
  } else {
    // Ensure initial admin credentials match configured requirements securely
    admin.email = 'Idcard@nuralam.com';
    admin.username = 'Idcard@nuralam.com';
    admin.passwordHash = hashPassword('@466035$');
    admin.status = 'active';
  }

  // Ensure initial supervisor exists for field submissions
  if (!users.some((u) => u.role === 'supervisor')) {
    const demoSupervisorUser = {
      id: 'user-supervisor-1',
      username: 'supervisor1',
      employeeId: 'SUP-2026-01',
      passwordHash: hashPassword('supervisor123'),
      name: 'Production Shift Supervisor',
      email: 'supervisor@company.com',
      role: 'supervisor',
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    users.push(demoSupervisorUser);
  }

  writeJsonFile(USERS_FILE, users);

  // 2. Master Employees (seed with initial sample data so lookup works right out of the box)
  const masterEmployees = readJsonFile<Record<string, any>>(MASTER_FILE, {});
  if (Object.keys(masterEmployees).length === 0) {
    const seedRecords: Record<string, any> = {
      '586665': {
        enrollId: '586665',
        name: 'MD. RABIUL AWAL',
        designation: 'Asst.Caster',
        department: 'Casting',
        jobType: 'Permanent',
        joiningDate: '01/03/2026',
        cardIssue: '19/10/2026',
        emergencyContact: '01920-694100',
        permanentAddress: 'Mukkhopur, Trishal, Mymensingh',
        bloodGroup: 'O+',
        nationalId: '',
        importedAt: new Date().toISOString(),
      },
      '586666': {
        enrollId: '586666',
        name: 'MD. JAHIDUL ISLAM',
        designation: 'Senior Glazer',
        department: 'Glazing',
        jobType: 'Permanent',
        joiningDate: '15/02/2025',
        cardIssue: '19/10/2026',
        emergencyContact: '01712-345678',
        permanentAddress: 'Dhanmondi, Dhaka',
        bloodGroup: 'A+',
        nationalId: '',
        importedAt: new Date().toISOString(),
      },
      '586667': {
        enrollId: '586667',
        name: 'SHARIFUL ISLAM',
        designation: 'Quality Inspector',
        department: 'QC',
        jobType: 'Permanent',
        joiningDate: '10/01/2024',
        cardIssue: '19/10/2026',
        emergencyContact: '01819-876543',
        permanentAddress: 'Kotwali, Mymensingh',
        bloodGroup: 'B+',
        nationalId: '',
        importedAt: new Date().toISOString(),
      },
    };
    writeJsonFile(MASTER_FILE, seedRecords);
  }

  // 3. Submissions
  readJsonFile<Record<string, any>>(SUBMISSIONS_FILE, {});

  // 4. Settings
  const settings = readJsonFile<AppSettings>(SETTINGS_FILE, DEFAULT_SETTINGS);
  const updatedSettings: AppSettings = {
    supervisorSuccessMessage: settings.supervisorSuccessMessage || DEFAULT_SETTINGS.supervisorSuccessMessage,
    supervisorFormEnabled: settings.supervisorFormEnabled !== undefined ? settings.supervisorFormEnabled : true,
    supervisorFormDisabledMessage:
      settings.supervisorFormDisabledMessage || DEFAULT_SETTINGS.supervisorFormDisabledMessage,
    pdfPrintLayout: settings.pdfPrintLayout || DEFAULT_SETTINGS.pdfPrintLayout,
  };
  writeJsonFile(SETTINGS_FILE, updatedSettings);
}

initializeDatabase();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

interface AuthenticatedRequest extends Request {
  user?: any;
}

// Authentication Middleware
function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  const session = validateAndGetSession(token);
  if (!session) {
    res.status(401).json({ error: 'Session expired. Please sign in again.' });
    return;
  }

  const users = readJsonFile<any[]>(USERS_FILE, []);
  const user = users.find((u) => u.id === session.userId);

  if (!user || user.status !== 'active') {
    res.status(403).json({ error: 'Account not found or inactive.' });
    return;
  }

  req.user = user;
  next();
}

// Admin Role Middleware
function requireAdminRole(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Access forbidden. Administrator privileges required.' });
    return;
  }
  next();
}

// =========================================================================
// API ROUTES
// =========================================================================

// --- AUTHENTICATION ---

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required.' });
    return;
  }

  const cleanInput = username.trim().toLowerCase();
  const users = readJsonFile<any[]>(USERS_FILE, []);
  const user = users.find(
    (u) =>
      (u.username.toLowerCase() === cleanInput ||
        (u.email && u.email.toLowerCase() === cleanInput) ||
        (u.employeeId && u.employeeId.toLowerCase() === cleanInput)) &&
      u.passwordHash === hashPassword(password)
  );

  if (!user) {
    res.status(401).json({ error: 'Invalid username or password.' });
    return;
  }

  if (user.status !== 'active') {
    res.status(403).json({ error: 'This user account has been deactivated.' });
    return;
  }

  const token = createToken(user.id);

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      employeeId: user.employeeId || user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    },
  });
});

// Dedicated Supervisor Login using Employee ID / Enrollment Number and password
app.post('/api/auth/supervisor-login', (req: Request, res: Response) => {
  const { employeeId, password } = req.body;
  if (!employeeId || !String(employeeId).trim() || !password) {
    res.status(400).json({ error: 'Supervisor Employee ID/Enrollment Number and password are required.' });
    return;
  }

  const cleanId = String(employeeId).trim().toLowerCase();
  const users = readJsonFile<any[]>(USERS_FILE, []);

  // Find user matching employeeId, username, or email
  const supervisor = users.find(
    (u) =>
      u.role === 'supervisor' &&
      ((u.employeeId && u.employeeId.toLowerCase() === cleanId) ||
        u.username.toLowerCase() === cleanId ||
        (u.email && u.email.toLowerCase() === cleanId)) &&
      u.passwordHash === hashPassword(password)
  );

  if (!supervisor) {
    // Check if account exists with non-supervisor role or invalid password
    const otherAccount = users.find(
      (u) =>
        (u.employeeId && u.employeeId.toLowerCase() === cleanId) ||
        u.username.toLowerCase() === cleanId
    );
    if (otherAccount && otherAccount.role !== 'supervisor') {
      res.status(403).json({
        error: `Account "${employeeId}" does not have Supervisor access (${otherAccount.role.replace('_', ' ')}). Please use the System Login.`,
      });
      return;
    }

    res.status(401).json({ error: 'Invalid Supervisor Employee ID/Enrollment Number or password.' });
    return;
  }

  if (supervisor.status !== 'active') {
    res.status(403).json({ error: 'This supervisor account has been deactivated. Please contact the administrator.' });
    return;
  }

  const token = createToken(supervisor.id);

  res.json({
    token,
    user: {
      id: supervisor.id,
      username: supervisor.username,
      employeeId: supervisor.employeeId || supervisor.username,
      name: supervisor.name,
      email: supervisor.email,
      role: supervisor.role,
      status: supervisor.status,
    },
  });
});

app.get('/api/auth/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { passwordHash, ...safeUser } = req.user;
  res.json({ user: safeUser });
});

// --- USER MANAGEMENT (ADMIN ONLY) ---

app.get('/api/users', authenticateToken, requireAdminRole, (_req: Request, res: Response) => {
  const users = readJsonFile<any[]>(USERS_FILE, []);
  const safeUsers = users.map(({ passwordHash, ...u }) => u);
  res.json(safeUsers);
});

app.post('/api/users', authenticateToken, requireAdminRole, (req: Request, res: Response) => {
  const { username, password, name, email, role, employeeId } = req.body;

  if (!username || !password || !name) {
    res.status(400).json({ error: 'Username, password, and name are required.' });
    return;
  }

  const cleanUsername = username.trim().toLowerCase();
  const users = readJsonFile<any[]>(USERS_FILE, []);

  if (users.some((u) => u.username.toLowerCase() === cleanUsername)) {
    res.status(409).json({ error: `Username "${username}" is already taken.` });
    return;
  }

  let assignedRole: 'admin' | 'data_entry' | 'supervisor' = 'data_entry';
  if (role === 'admin') assignedRole = 'admin';
  else if (role === 'supervisor') assignedRole = 'supervisor';

  const cleanEmployeeId = employeeId ? String(employeeId).trim() : cleanUsername;

  const newUser = {
    id: `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    username: cleanUsername,
    employeeId: cleanEmployeeId,
    passwordHash: hashPassword(password),
    name: name.trim(),
    email: (email || '').trim(),
    role: assignedRole,
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  writeJsonFile(USERS_FILE, users);

  const { passwordHash, ...safeUser } = newUser;
  res.status(201).json(safeUser);
});

app.put('/api/users/:id', authenticateToken, requireAdminRole, (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, email, role, status, password, employeeId } = req.body;

  const users = readJsonFile<any[]>(USERS_FILE, []);
  const index = users.findIndex((u) => u.id === id);

  if (index === -1) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const existing = users[index];
  if (name !== undefined) existing.name = name.trim();
  if (email !== undefined) existing.email = email.trim();
  if (role !== undefined) {
    if (role === 'admin') existing.role = 'admin';
    else if (role === 'supervisor') existing.role = 'supervisor';
    else existing.role = 'data_entry';
  }
  if (employeeId !== undefined) existing.employeeId = String(employeeId).trim();
  if (status !== undefined) existing.status = status === 'inactive' ? 'inactive' : 'active';
  if (password && password.trim() !== '') {
    existing.passwordHash = hashPassword(password.trim());
  }

  users[index] = existing;
  writeJsonFile(USERS_FILE, users);

  const { passwordHash, ...safeUser } = existing;
  res.json(safeUser);
});

app.delete('/api/users/:id', authenticateToken, requireAdminRole, (req: Request, res: Response) => {
  const { id } = req.params;
  const users = readJsonFile<any[]>(USERS_FILE, []);

  const target = users.find((u) => u.id === id);
  if (!target) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  // Prevent deleting the last admin
  if (target.role === 'admin') {
    const adminCount = users.filter((u) => u.role === 'admin').length;
    if (adminCount <= 1) {
      res.status(400).json({ error: 'Cannot delete the only administrator account.' });
      return;
    }
  }

  const filtered = users.filter((u) => u.id !== id);
  writeJsonFile(USERS_FILE, filtered);
  res.json({ success: true, message: 'User deleted successfully.' });
});

// --- EMPLOYEE MASTER DATABASE (ADMIN ONLY FOR MANAGEMENT) ---

app.get('/api/master-employees', authenticateToken, requireAdminRole, (_req: Request, res: Response) => {
  const master = readJsonFile<Record<string, any>>(MASTER_FILE, {});
  res.json(Object.values(master));
});

app.post('/api/master-employees/import', authenticateToken, requireAdminRole, (req: Request, res: Response) => {
  const { employees } = req.body;

  if (!Array.isArray(employees) || employees.length === 0) {
    res.status(400).json({ error: 'Expected non-empty array of employee records.' });
    return;
  }

  const master = readJsonFile<Record<string, any>>(MASTER_FILE, {});
  const seenInBatch = new Set<string>();

  let addedCount = 0;
  let duplicateCount = 0;
  let failedCount = 0;

  const sampleDuplicates: string[] = [];
  const sampleFailed: string[] = [];

  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    if (!emp || typeof emp !== 'object') {
      failedCount++;
      continue;
    }

    const rawEnrollId = emp.enrollId !== undefined && emp.enrollId !== null ? String(emp.enrollId).trim() : '';
    const rawName = emp.name !== undefined && emp.name !== null ? String(emp.name).trim() : '';

    // Validate required fields: Enrollment ID and Name
    if (!rawEnrollId || !rawName) {
      failedCount++;
      if (sampleFailed.length < 10) {
        sampleFailed.push(`Row ${i + 1}: Missing Enrollment ID or Name`);
      }
      continue;
    }

    // Duplicate detection within the incoming file itself
    if (seenInBatch.has(rawEnrollId)) {
      duplicateCount++;
      if (sampleDuplicates.length < 15) {
        sampleDuplicates.push(`${rawEnrollId} (duplicate in file)`);
      }
      continue;
    }
    seenInBatch.add(rawEnrollId);

    // Duplicate detection against existing database records: NEVER silently overwrite
    if (master[rawEnrollId]) {
      duplicateCount++;
      if (sampleDuplicates.length < 15) {
        sampleDuplicates.push(`${rawEnrollId} (already in database)`);
      }
      continue;
    }

    // Valid and unique: save normalized employee record maintaining all fields
    const record = {
      enrollId: rawEnrollId,
      name: rawName,
      designation: String(emp.designation || '').trim(),
      department: String(emp.department || '').trim(),
      jobType: String(emp.jobType || 'Permanent').trim(),
      joiningDate: String(emp.joiningDate || '01/03/2026').trim(),
      cardIssue: String(emp.cardIssue || '19/10/2026').trim(),
      emergencyContact: String(emp.emergencyContact || emp.contactNumber || '').trim(),
      permanentAddress: String(emp.permanentAddress || '').trim(),
      bloodGroup: String(emp.bloodGroup || 'O+').trim(),
      nationalId: String(emp.nationalId || '').trim(),
      photo: String(emp.photo || emp.photoUrl || '').trim(),
      signature: String(emp.signature || emp.signatureUrl || '').trim(),
      importedAt: new Date().toISOString(),
    };

    master[rawEnrollId] = record;
    addedCount++;
  }

  // Atomically write once for the entire batch
  writeJsonFile(MASTER_FILE, master);

  res.json({
    success: true,
    summary: {
      total: employees.length,
      successful: addedCount,
      duplicates: duplicateCount,
      failed: failedCount,
    },
    sampleDuplicates,
    sampleFailed,
    message: `Import completed: ${addedCount} added successfully, ${duplicateCount} duplicates skipped, ${failedCount} invalid records skipped.`,
    totalRecords: Object.keys(master).length,
  });
});

app.put('/api/master-employees/:enrollId', authenticateToken, requireAdminRole, (req: Request, res: Response) => {
  const { enrollId } = req.params;
  const master = readJsonFile<Record<string, any>>(MASTER_FILE, {});

  if (!master[enrollId]) {
    res.status(404).json({ error: `Employee with Enrollment ID "${enrollId}" not found.` });
    return;
  }

  const existing = master[enrollId];
  const b = req.body;

  if (b.name !== undefined) existing.name = String(b.name).trim();
  if (b.designation !== undefined) existing.designation = String(b.designation).trim();
  if (b.department !== undefined) existing.department = String(b.department).trim();
  if (b.jobType !== undefined) existing.jobType = String(b.jobType).trim();
  if (b.joiningDate !== undefined) existing.joiningDate = String(b.joiningDate).trim();
  if (b.cardIssue !== undefined) existing.cardIssue = String(b.cardIssue).trim();
  if (b.emergencyContact !== undefined) existing.emergencyContact = String(b.emergencyContact).trim();
  if (b.permanentAddress !== undefined) existing.permanentAddress = String(b.permanentAddress).trim();
  if (b.bloodGroup !== undefined) existing.bloodGroup = String(b.bloodGroup).trim();
  if (b.nationalId !== undefined) existing.nationalId = String(b.nationalId).trim();
  if (b.photo !== undefined) existing.photo = String(b.photo).trim();
  if (b.signature !== undefined) existing.signature = String(b.signature).trim();
  existing.updatedAt = new Date().toISOString();

  master[enrollId] = existing;
  writeJsonFile(MASTER_FILE, master);

  res.json({
    success: true,
    message: `Employee ${enrollId} updated successfully.`,
    employee: existing,
  });
});

app.delete('/api/master-employees/:enrollId', authenticateToken, requireAdminRole, (req: Request, res: Response) => {
  const { enrollId } = req.params;
  const master = readJsonFile<Record<string, any>>(MASTER_FILE, {});

  if (!master[enrollId]) {
    res.status(404).json({ error: `Employee with Enrollment ID "${enrollId}" not found.` });
    return;
  }

  delete master[enrollId];
  writeJsonFile(MASTER_FILE, master);
  res.json({ success: true, message: `Employee ${enrollId} deleted from master database.` });
});

app.delete('/api/master-employees', authenticateToken, requireAdminRole, (_req: Request, res: Response) => {
  writeJsonFile(MASTER_FILE, {});
  res.json({ success: true, message: 'All master employee records have been cleared.' });
});

// --- LOOKUP EMPLOYEE (AUTHENTICATED DATA ENTRY & ADMIN) ---
// Retrieves employee read-only info, checks if already submitted
app.get('/api/lookup-employee/:enrollId', authenticateToken, (req: Request, res: Response) => {
  const enrollId = req.params.enrollId.trim();
  const master = readJsonFile<Record<string, any>>(MASTER_FILE, {});
  const submissions = readJsonFile<Record<string, any>>(SUBMISSIONS_FILE, {});

  const employee = master[enrollId];
  const submission = submissions[enrollId];

  if (!employee) {
    res.status(404).json({
      found: false,
      error: `Enrollment ID "${enrollId}" was not found in the Master Employee Database. Please check the ID or contact the Administrator.`,
    });
    return;
  }

  res.json({
    found: true,
    employee,
    alreadySubmitted: Boolean(submission),
    submissionInfo: submission
      ? {
          submittedAt: submission.submittedAt,
          submittedBy: submission.submittedBy?.name || 'Authorized Operator',
          nationalId: submission.nationalId,
          hasPhoto: Boolean(submission.photoUrl),
          hasSignature: Boolean(submission.signatureUrl),
        }
      : null,
  });
});

// --- SUBMISSIONS (DATA ENTRY & ADMIN) ---

// Server-side duplicate protection & saving
app.post('/api/submissions', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  // SERVER-SIDE SUPERVISOR FORM ON/OFF CONTROL
  if (req.user?.role === 'supervisor') {
    const settings = readJsonFile<AppSettings>(SETTINGS_FILE, DEFAULT_SETTINGS);
    if (settings.supervisorFormEnabled === false) {
      res.status(403).json({
        error:
          settings.supervisorFormDisabledMessage ||
          'Employee ID Card submission is temporarily closed by the administrator. Please check back later.',
        formDisabled: true,
      });
      return;
    }
  }

  const { enrollId, nationalId, photoUrl, signatureUrl } = req.body;

  if (!enrollId || !String(enrollId).trim()) {
    res.status(400).json({ error: 'Enrollment ID is required.' });
    return;
  }

  const cleanEnrollId = String(enrollId).trim();

  // Validate in Master Database
  const master = readJsonFile<Record<string, any>>(MASTER_FILE, {});
  const masterEmp = master[cleanEnrollId];

  if (!masterEmp) {
    res.status(404).json({
      error: `Cannot submit: Enrollment ID "${cleanEnrollId}" does not exist in the Master Employee Database.`,
    });
    return;
  }

  // SERVER-SIDE DUPLICATE PROTECTION: Block if already submitted
  const submissions = readJsonFile<Record<string, any>>(SUBMISSIONS_FILE, {});
  if (submissions[cleanEnrollId]) {
    const existing = submissions[cleanEnrollId];
    res.status(409).json({
      error: `Already submitted for Enrollment ID "${cleanEnrollId}". This record was submitted on ${new Date(
        existing.submittedAt
      ).toLocaleDateString()} by ${existing.submittedBy?.name || 'Operator'}. Duplicate submissions are strictly blocked.`,
      alreadySubmitted: true,
      submission: {
        submittedAt: existing.submittedAt,
        submittedBy: existing.submittedBy?.name,
      },
    });
    return;
  }

  // Validate the 3 required fields
  if (!nationalId || !String(nationalId).trim()) {
    res.status(400).json({ error: 'National ID Number is required.' });
    return;
  }

  if (!photoUrl || !String(photoUrl).trim().startsWith('data:image')) {
    res.status(400).json({ error: 'A valid Employee Photo is required.' });
    return;
  }

  if (!signatureUrl || !String(signatureUrl).trim().startsWith('data:image')) {
    res.status(400).json({ error: 'A valid Employee Signature Photo is required.' });
    return;
  }

  const newSubmission = {
    id: `sub-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    enrollId: cleanEnrollId,
    nationalId: String(nationalId).trim(),
    photoUrl: String(photoUrl).trim(),
    signatureUrl: String(signatureUrl).trim(),
    employee: masterEmp,
    submittedBy: {
      id: req.user.id,
      name: req.user.name,
      username: req.user.username,
      employeeId: req.user.employeeId || req.user.username,
      role: req.user.role,
    },
    submittedAt: new Date().toISOString(),
    printStatus: 'pending',
    printCount: 0,
    printedAt: null,
    reprintHistory: [],
  };

  submissions[cleanEnrollId] = newSubmission;
  writeJsonFile(SUBMISSIONS_FILE, submissions);

  // Retrieve current configured success message from settings
  const currentSettings = readJsonFile<AppSettings>(SETTINGS_FILE, DEFAULT_SETTINGS);

  res.status(201).json({
    success: true,
    message: currentSettings.supervisorSuccessMessage || `Record successfully submitted for ${masterEmp.name} (Enroll ID: ${cleanEnrollId}).`,
    submission: {
      id: newSubmission.id,
      enrollId: cleanEnrollId,
      submittedAt: newSubmission.submittedAt,
      printStatus: newSubmission.printStatus,
    },
  });
});

// Admin-only: list all submissions with normalized print status
app.get('/api/submissions', authenticateToken, requireAdminRole, (_req: Request, res: Response) => {
  const submissions = readJsonFile<Record<string, any>>(SUBMISSIONS_FILE, {});
  const normalized = Object.values(submissions).map((sub: any) => ({
    ...sub,
    printStatus: sub.printStatus === 'printed' ? 'printed' : 'pending',
    printCount: typeof sub.printCount === 'number' ? sub.printCount : sub.printStatus === 'printed' ? 1 : 0,
    reprintHistory: Array.isArray(sub.reprintHistory) ? sub.reprintHistory : [],
  }));
  res.json(normalized);
});

// Admin-only: mark single submission as printed
app.post('/api/submissions/:enrollId/mark-printed', authenticateToken, requireAdminRole, (req: AuthenticatedRequest, res: Response) => {
  const { enrollId } = req.params;
  const submissions = readJsonFile<Record<string, any>>(SUBMISSIONS_FILE, {});
  const record = submissions[enrollId];

  if (!record) {
    res.status(404).json({ error: `Submission for Enrollment ID "${enrollId}" not found.` });
    return;
  }

  const now = new Date().toISOString();
  const isFirstPrint = record.printStatus !== 'printed';
  record.printStatus = 'printed';
  record.printedAt = now;
  record.printCount = (record.printCount || 0) + 1;
  if (!Array.isArray(record.reprintHistory)) record.reprintHistory = [];

  record.reprintHistory.push({
    printedAt: now,
    printedBy: req.user.name || req.user.username,
    action: isFirstPrint ? 'initial_print' : 'reprint',
    note: req.body?.note || (isFirstPrint ? 'Initial ID card printed' : 'Card reprint completed'),
  });

  submissions[enrollId] = record;
  writeJsonFile(SUBMISSIONS_FILE, submissions);

  res.json({
    success: true,
    message: `Card for ${enrollId} marked as printed.`,
    record,
  });
});

// Admin-only: log a reprint action
app.post('/api/submissions/:enrollId/reprint', authenticateToken, requireAdminRole, (req: AuthenticatedRequest, res: Response) => {
  const { enrollId } = req.params;
  const submissions = readJsonFile<Record<string, any>>(SUBMISSIONS_FILE, {});
  const record = submissions[enrollId];

  if (!record) {
    res.status(404).json({ error: `Submission for Enrollment ID "${enrollId}" not found.` });
    return;
  }

  const now = new Date().toISOString();
  record.printStatus = 'printed';
  record.printedAt = now;
  record.printCount = (record.printCount || 1) + 1;
  if (!Array.isArray(record.reprintHistory)) record.reprintHistory = [];

  record.reprintHistory.push({
    printedAt: now,
    printedBy: req.user.name || req.user.username,
    action: 'reprint',
    note: req.body?.note || 'Reprint issued by administrator',
  });

  submissions[enrollId] = record;
  writeJsonFile(SUBMISSIONS_FILE, submissions);

  res.json({
    success: true,
    message: `Card for ${enrollId} marked as reprinted (Print #${record.printCount}).`,
    record,
  });
});

// Admin-only: bulk mark multiple submissions as printed
app.post('/api/submissions/bulk-mark-printed', authenticateToken, requireAdminRole, (req: AuthenticatedRequest, res: Response) => {
  const { enrollIds, note } = req.body;
  if (!Array.isArray(enrollIds) || enrollIds.length === 0) {
    res.status(400).json({ error: 'Expected non-empty array of enrollIds.' });
    return;
  }

  const submissions = readJsonFile<Record<string, any>>(SUBMISSIONS_FILE, {});
  const now = new Date().toISOString();
  let updatedCount = 0;

  for (const enrollId of enrollIds) {
    const record = submissions[enrollId];
    if (record) {
      const isFirstPrint = record.printStatus !== 'printed';
      record.printStatus = 'printed';
      record.printedAt = now;
      record.printCount = (record.printCount || 0) + 1;
      if (!Array.isArray(record.reprintHistory)) record.reprintHistory = [];

      record.reprintHistory.push({
        printedAt: now,
        printedBy: req.user.name || req.user.username,
        action: isFirstPrint ? 'initial_print' : 'reprint',
        note: note || (isFirstPrint ? 'Batch print output' : 'Batch reprint output'),
      });

      submissions[enrollId] = record;
      updatedCount++;
    }
  }

  writeJsonFile(SUBMISSIONS_FILE, submissions);
  res.json({
    success: true,
    message: `Successfully marked ${updatedCount} submissions as printed.`,
    updatedCount,
  });
});

// Admin-only: delete submission to allow resubmission if needed
app.delete('/api/submissions/:enrollId', authenticateToken, requireAdminRole, (req: Request, res: Response) => {
  const { enrollId } = req.params;
  const submissions = readJsonFile<Record<string, any>>(SUBMISSIONS_FILE, {});

  if (!submissions[enrollId]) {
    res.status(404).json({ error: `Submission for Enrollment ID "${enrollId}" not found.` });
    return;
  }

  delete submissions[enrollId];
  writeJsonFile(SUBMISSIONS_FILE, submissions);
  res.json({ success: true, message: `Submission for ${enrollId} deleted.` });
});

// --- SETTINGS (ADMIN CONFIGURABLE & PUBLIC CONFIRMATION MESSAGE) ---

// Authenticated users (including supervisors): get public confirmation message & form status
app.get('/api/settings/public', authenticateToken, (_req: Request, res: Response) => {
  const settings = readJsonFile<AppSettings>(SETTINGS_FILE, DEFAULT_SETTINGS);
  res.json({
    supervisorSuccessMessage: settings.supervisorSuccessMessage || DEFAULT_SETTINGS.supervisorSuccessMessage,
    supervisorFormEnabled: settings.supervisorFormEnabled !== false,
    supervisorFormDisabledMessage:
      settings.supervisorFormDisabledMessage || DEFAULT_SETTINGS.supervisorFormDisabledMessage,
    pdfPrintLayout: settings.pdfPrintLayout || DEFAULT_SETTINGS.pdfPrintLayout,
  });
});

// Admin-only: get full application settings
app.get('/api/settings', authenticateToken, requireAdminRole, (_req: Request, res: Response) => {
  const settings = readJsonFile<AppSettings>(SETTINGS_FILE, DEFAULT_SETTINGS);
  res.json(settings);
});

// Admin-only: update application settings
app.put('/api/settings', authenticateToken, requireAdminRole, (req: Request, res: Response) => {
  const current = readJsonFile<AppSettings>(SETTINGS_FILE, DEFAULT_SETTINGS);
  const updated: AppSettings = {
    ...current,
    supervisorSuccessMessage:
      req.body.supervisorSuccessMessage !== undefined
        ? String(req.body.supervisorSuccessMessage).trim()
        : current.supervisorSuccessMessage,
    supervisorFormEnabled:
      req.body.supervisorFormEnabled !== undefined
        ? Boolean(req.body.supervisorFormEnabled)
        : current.supervisorFormEnabled !== false,
    supervisorFormDisabledMessage:
      req.body.supervisorFormDisabledMessage !== undefined
        ? String(req.body.supervisorFormDisabledMessage).trim()
        : current.supervisorFormDisabledMessage,
    pdfPrintLayout: req.body.pdfPrintLayout === 'top_bottom' ? 'top_bottom' : 'side_by_side',
  };
  writeJsonFile(SETTINGS_FILE, updated);
  res.json(updated);
});

// =========================================================================
// VITE SPA INTEGRATION & SERVER STARTUP
// =========================================================================

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';
  const distPath = path.resolve(__dirname, 'dist');

  if (isProduction && fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    // Mount Vite middleware in development (HMR WebSocket disabled to prevent port 24678 collisions)
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
