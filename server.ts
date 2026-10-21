import express, { Request, Response, NextFunction } from 'express';
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
  loginBackgroundImage?: string;
  generalSuccessMessage?: string;
  loginNoticeEnabled?: boolean;
  loginNoticeMessage?: string;
  supervisorEntryEnabled?: boolean;
  supervisorEntryDisabledMessage?: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  supervisorSuccessMessage:
    'Employee ID Card data has been submitted successfully and queued for administrative review and printing. Thank you!',
  loginBackgroundImage: '',
  generalSuccessMessage:
    'Operation completed successfully and database records updated.',
  loginNoticeEnabled: false,
  loginNoticeMessage:
    'Welcome to the ID Card Portal. Please contact Administration if you need credential assistance.',
  supervisorEntryEnabled: true,
  supervisorEntryDisabledMessage:
    'Supervisor data entry is temporarily closed by Administration. Please check back later or contact the admin office.',
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
  // 1. Users
  const users = readJsonFile<any[]>(USERS_FILE, []);
  if (users.length === 0) {
    const adminUser = {
      id: 'user-admin-1',
      username: 'admin',
      passwordHash: hashPassword('admin123'),
      name: 'System Administrator',
      email: 'ajkerpage@gmail.com',
      role: 'admin',
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    const demoDataEntryUser = {
      id: 'user-dataentry-1',
      username: 'operator1',
      employeeId: 'OP-101',
      passwordHash: hashPassword('operator123'),
      name: 'Data Entry Operator',
      email: 'operator1@company.com',
      role: 'data_entry',
      status: 'active',
      createdAt: new Date().toISOString(),
    };
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
    writeJsonFile(USERS_FILE, [adminUser, demoDataEntryUser, demoSupervisorUser]);
  } else if (!users.some((u) => u.role === 'supervisor')) {
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
    writeJsonFile(USERS_FILE, users);
  }

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
  if (!settings.supervisorSuccessMessage) {
    writeJsonFile(SETTINGS_FILE, DEFAULT_SETTINGS);
  }
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

const VALID_APP_TABS = [
  'submissions',
  'supervisor_submission',
  'data_entry_form',
  'employee_data',
  'user_management',
  'card_studio',
];

function getEffectiveAllowedTabs(user: any): string[] {
  if (user.role === 'admin') {
    return [...VALID_APP_TABS];
  }
  if (user.role === 'supervisor') {
    return ['supervisor_submission'];
  }
  if (Array.isArray(user.allowedTabs) && user.allowedTabs.length > 0) {
    const valid = user.allowedTabs.filter((t: string) => VALID_APP_TABS.includes(t));
    if (valid.length > 0) return valid;
  }
  return ['data_entry_form'];
}

// Tab Permission Enforcement Middleware
function requireTabAccess(tabId: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required. Please sign in.' });
      return;
    }
    if (req.user.role === 'admin') {
      return next();
    }
    if (req.user.role === 'supervisor') {
      if (tabId === 'supervisor_submission') {
        return next();
      }
      res.status(403).json({ error: 'Access forbidden for supervisor role.' });
      return;
    }
    if (req.user.role === 'data_entry') {
      const allowed = getEffectiveAllowedTabs(req.user);
      if (allowed.includes(tabId)) {
        return next();
      }
      res.status(403).json({ error: `Access forbidden. You do not have permission to access the ${tabId} module.` });
      return;
    }
    res.status(403).json({ error: 'Unauthorized role.' });
  };
}

// =========================================================================
// API ROUTES
// =========================================================================

// --- AUTHENTICATION ---

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { username, password, enrollmentId, employeeId } = req.body;
  const rawId = (enrollmentId || employeeId || username || '').trim();
  if (!rawId || !password) {
    res.status(400).json({ error: 'Enrollment ID and password are required.' });
    return;
  }

  const cleanInput = rawId.toLowerCase();
  const users = readJsonFile<any[]>(USERS_FILE, []);
  const user = users.find(
    (u) =>
      (u.username.toLowerCase() === cleanInput ||
        (u.email && u.email.toLowerCase() === cleanInput) ||
        (u.employeeId && u.employeeId.toLowerCase() === cleanInput)) &&
      u.passwordHash === hashPassword(password)
  );

  if (!user) {
    res.status(401).json({ error: 'Invalid Enrollment ID or password.' });
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
      allowedTabs: getEffectiveAllowedTabs(user),
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
      allowedTabs: getEffectiveAllowedTabs(supervisor),
    },
  });
});

app.get('/api/auth/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { passwordHash, ...safeUser } = req.user;
  res.json({
    user: {
      ...safeUser,
      allowedTabs: getEffectiveAllowedTabs(req.user),
    },
  });
});

// --- USER MANAGEMENT ---

app.get('/api/users', authenticateToken, requireTabAccess('user_management'), (_req: Request, res: Response) => {
  const users = readJsonFile<any[]>(USERS_FILE, []);
  const safeUsers = users.map(({ passwordHash, ...u }) => ({
    ...u,
    allowedTabs: getEffectiveAllowedTabs(u),
  }));
  res.json(safeUsers);
});

app.post('/api/users', authenticateToken, requireTabAccess('user_management'), (req: Request, res: Response) => {
  const { username, password, name, email, role, employeeId, allowedTabs } = req.body;

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

  // Determine permitted tabs
  let sanitizedAllowedTabs: string[];
  if (assignedRole === 'admin') {
    sanitizedAllowedTabs = [...VALID_APP_TABS];
  } else if (assignedRole === 'supervisor') {
    sanitizedAllowedTabs = ['supervisor_submission'];
  } else {
    sanitizedAllowedTabs = Array.isArray(allowedTabs)
      ? allowedTabs.filter((t: string) => VALID_APP_TABS.includes(t))
      : ['data_entry_form'];
    if (sanitizedAllowedTabs.length === 0) {
      sanitizedAllowedTabs = ['data_entry_form'];
    }
  }

  const newUser = {
    id: `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    username: cleanUsername,
    employeeId: cleanEmployeeId,
    passwordHash: hashPassword(password),
    name: name.trim(),
    email: (email || '').trim(),
    role: assignedRole,
    status: 'active',
    allowedTabs: sanitizedAllowedTabs,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  writeJsonFile(USERS_FILE, users);

  const { passwordHash, ...safeUser } = newUser;
  res.status(201).json({
    ...safeUser,
    allowedTabs: getEffectiveAllowedTabs(newUser),
  });
});

app.put('/api/users/:id', authenticateToken, requireTabAccess('user_management'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, email, role, status, password, employeeId, allowedTabs } = req.body;

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

  if (existing.role === 'data_entry') {
    if (Array.isArray(allowedTabs)) {
      const sanitized = allowedTabs.filter((t: string) => VALID_APP_TABS.includes(t));
      existing.allowedTabs = sanitized.length > 0 ? sanitized : ['data_entry_form'];
    }
  } else if (existing.role === 'admin') {
    existing.allowedTabs = [...VALID_APP_TABS];
  } else if (existing.role === 'supervisor') {
    existing.allowedTabs = ['supervisor_submission'];
  }

  users[index] = existing;
  writeJsonFile(USERS_FILE, users);

  const { passwordHash, ...safeUser } = existing;
  res.json({
    ...safeUser,
    allowedTabs: getEffectiveAllowedTabs(existing),
  });
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

// --- EMPLOYEE MASTER DATABASE ---

app.get('/api/master-employees', authenticateToken, requireTabAccess('employee_data'), (_req: Request, res: Response) => {
  const master = readJsonFile<Record<string, any>>(MASTER_FILE, {});
  res.json(Object.values(master));
});

app.post('/api/master-employees/import', authenticateToken, requireTabAccess('employee_data'), (req: Request, res: Response) => {
  const { employees } = req.body;

  if (!Array.isArray(employees) || employees.length === 0) {
    res.status(400).json({ error: 'Expected non-empty array of employee records.' });
    return;
  }

  const master = readJsonFile<Record<string, any>>(MASTER_FILE, {});
  let addedCount = 0;
  let updatedCount = 0;

  for (const emp of employees) {
    const enrollId = String(emp.enrollId || '').trim();
    if (!enrollId) continue;

    const record = {
      enrollId,
      name: String(emp.name || '').trim(),
      designation: String(emp.designation || '').trim(),
      department: String(emp.department || '').trim(),
      jobType: String(emp.jobType || 'Permanent').trim(),
      joiningDate: String(emp.joiningDate || '01/03/2026').trim(),
      cardIssue: String(emp.cardIssue || '19/10/2026').trim(),
      emergencyContact: String(emp.emergencyContact || '01920-694100').trim(),
      permanentAddress: String(emp.permanentAddress || 'Mukkhopur, Trishal, Mymensingh').trim(),
      bloodGroup: String(emp.bloodGroup || 'O+').trim(),
      nationalId: String(emp.nationalId || '').trim(),
      importedAt: new Date().toISOString(),
    };

    if (master[enrollId]) {
      updatedCount++;
    } else {
      addedCount++;
    }
    master[enrollId] = record;
  }

  writeJsonFile(MASTER_FILE, master);
  res.json({
    success: true,
    message: `Imported ${addedCount} new and updated ${updatedCount} employee records.`,
    totalRecords: Object.keys(master).length,
  });
});

// Restricted Employee Edit: ONLY Contact Number and Blood Group can be updated
app.put('/api/master-employees/:enrollId', authenticateToken, requireTabAccess('employee_data'), (req: Request, res: Response) => {
  const { enrollId } = req.params;
  const master = readJsonFile<Record<string, any>>(MASTER_FILE, {});

  if (!master[enrollId]) {
    res.status(404).json({ error: `Employee with Enrollment ID "${enrollId}" not found.` });
    return;
  }

  const { emergencyContact, bloodGroup } = req.body;

  // Validate Contact Number (required, non-empty)
  if (emergencyContact !== undefined) {
    const contactStr = String(emergencyContact).trim();
    if (!contactStr) {
      res.status(400).json({ error: 'Contact Number is required and cannot be empty.' });
      return;
    }
    master[enrollId].emergencyContact = contactStr;
  }

  // Validate Blood Group (required, valid blood group format)
  if (bloodGroup !== undefined) {
    const validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
    const bgStr = String(bloodGroup).trim().toUpperCase();
    if (!validBloodGroups.includes(bgStr)) {
      res.status(400).json({
        error: `Invalid Blood Group "${bloodGroup}". Must be one of: ${validBloodGroups.join(', ')}`,
      });
      return;
    }
    master[enrollId].bloodGroup = bgStr;
  }

  // Strictly enforce that NO OTHER employee fields can be altered via edit
  master[enrollId].updatedAt = new Date().toISOString();

  writeJsonFile(MASTER_FILE, master);
  res.json({
    success: true,
    message: `Employee ${enrollId} updated successfully (Contact Number & Blood Group).`,
    employee: master[enrollId],
  });
});

app.delete('/api/master-employees/:enrollId', authenticateToken, requireTabAccess('employee_data'), (req: Request, res: Response) => {
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

app.delete('/api/master-employees', authenticateToken, requireTabAccess('employee_data'), (_req: Request, res: Response) => {
  writeJsonFile(MASTER_FILE, {});
  res.json({ success: true, message: 'All master employee records have been cleared.' });
});

// --- LOOKUP EMPLOYEE (AUTHENTICATED DATA ENTRY & ADMIN) ---
// Retrieves employee read-only info, checks if already submitted
app.get('/api/lookup-employee/:enrollId', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role === 'data_entry') {
    const allowed = getEffectiveAllowedTabs(req.user);
    if (!allowed.includes('data_entry_form') && !allowed.includes('supervisor_submission')) {
      res.status(403).json({ error: 'Access forbidden. You do not have permission for employee lookup.' });
      return;
    }
  }

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
  const { enrollId, nationalId, photoUrl, signatureUrl } = req.body;

  // Enforce Data Entry tab permissions
  if (req.user?.role === 'data_entry') {
    const allowed = getEffectiveAllowedTabs(req.user);
    if (!allowed.includes('data_entry_form') && !allowed.includes('supervisor_submission')) {
      res.status(403).json({ error: 'Access forbidden. You do not have permission to submit records.' });
      return;
    }
  }

  // Enforce Admin-controlled Supervisor Entry availability
  const currentSettings = readJsonFile<AppSettings>(SETTINGS_FILE, DEFAULT_SETTINGS);
  if (currentSettings.supervisorEntryEnabled === false && req.user?.role === 'supervisor') {
    res.status(403).json({
      error:
        currentSettings.supervisorEntryDisabledMessage ||
        'Supervisor data entry is currently disabled by Administration.',
      entryDisabled: true,
    });
    return;
  }

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
  // currentSettings already read at start of handler

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

// Print Queue & Submissions: authorized staff with 'submissions' tab access
app.get('/api/submissions', authenticateToken, requireTabAccess('submissions'), (_req: Request, res: Response) => {
  const submissions = readJsonFile<Record<string, any>>(SUBMISSIONS_FILE, {});
  const normalized = Object.values(submissions).map((sub: any) => ({
    ...sub,
    printStatus: sub.printStatus === 'printed' ? 'printed' : 'pending',
    printCount: typeof sub.printCount === 'number' ? sub.printCount : sub.printStatus === 'printed' ? 1 : 0,
    reprintHistory: Array.isArray(sub.reprintHistory) ? sub.reprintHistory : [],
  }));
  res.json(normalized);
});

// Mark single submission as printed
app.post('/api/submissions/:enrollId/mark-printed', authenticateToken, requireTabAccess('submissions'), (req: AuthenticatedRequest, res: Response) => {
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

// Log a reprint action
app.post('/api/submissions/:enrollId/reprint', authenticateToken, requireTabAccess('submissions'), (req: AuthenticatedRequest, res: Response) => {
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

// Bulk mark multiple submissions as printed
app.post('/api/submissions/bulk-mark-printed', authenticateToken, requireTabAccess('submissions'), (req: AuthenticatedRequest, res: Response) => {
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

// Reset print status back to pending
app.post('/api/submissions/:enrollId/reset-print', authenticateToken, requireTabAccess('submissions'), (req: AuthenticatedRequest, res: Response) => {
  const { enrollId } = req.params;
  const submissions = readJsonFile<Record<string, any>>(SUBMISSIONS_FILE, {});
  const record = submissions[enrollId];

  if (!record) {
    res.status(404).json({ error: `Submission for Enrollment ID "${enrollId}" not found.` });
    return;
  }

  record.printStatus = 'pending';
  submissions[enrollId] = record;
  writeJsonFile(SUBMISSIONS_FILE, submissions);

  res.json({
    success: true,
    message: `Print status for ${enrollId} reset to pending.`,
    record,
  });
});

// Delete submission to allow resubmission if needed
app.delete('/api/submissions/:enrollId', authenticateToken, requireTabAccess('submissions'), (req: Request, res: Response) => {
  const targetId = decodeURIComponent(String(req.params.enrollId)).trim();
  const submissions = readJsonFile<Record<string, any>>(SUBMISSIONS_FILE, {});

  // Robust lookup by key or enrollId or id
  const matchedKey = Object.keys(submissions).find(
    (k) =>
      k.toLowerCase() === targetId.toLowerCase() ||
      submissions[k]?.enrollId?.toLowerCase() === targetId.toLowerCase() ||
      submissions[k]?.id === targetId
  );

  if (!matchedKey) {
    res.status(404).json({ error: `Submission for Enrollment ID "${targetId}" not found.` });
    return;
  }

  delete submissions[matchedKey];
  writeJsonFile(SUBMISSIONS_FILE, submissions);
  res.json({ success: true, message: `Submission for ${targetId} deleted successfully.` });
});

// --- SETTINGS (ADMIN CONFIGURABLE & PUBLIC CONFIRMATION MESSAGE) ---

// Public endpoint (accessible before login): returns confirmation message, login background, and availability
app.get('/api/settings/public', (_req: Request, res: Response) => {
  const settings = readJsonFile<AppSettings>(SETTINGS_FILE, DEFAULT_SETTINGS);
  res.json({
    supervisorSuccessMessage: settings.supervisorSuccessMessage || DEFAULT_SETTINGS.supervisorSuccessMessage,
    loginBackgroundImage: settings.loginBackgroundImage || '',
    generalSuccessMessage: settings.generalSuccessMessage || DEFAULT_SETTINGS.generalSuccessMessage,
    loginNoticeEnabled: Boolean(settings.loginNoticeEnabled),
    loginNoticeMessage: settings.loginNoticeMessage || DEFAULT_SETTINGS.loginNoticeMessage,
    supervisorEntryEnabled: settings.supervisorEntryEnabled !== false,
    supervisorEntryDisabledMessage:
      settings.supervisorEntryDisabledMessage || DEFAULT_SETTINGS.supervisorEntryDisabledMessage,
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
    loginBackgroundImage:
      req.body.loginBackgroundImage !== undefined
        ? String(req.body.loginBackgroundImage)
        : (current.loginBackgroundImage || ''),
    generalSuccessMessage:
      req.body.generalSuccessMessage !== undefined
        ? String(req.body.generalSuccessMessage).trim()
        : current.generalSuccessMessage,
    loginNoticeEnabled:
      req.body.loginNoticeEnabled !== undefined
        ? Boolean(req.body.loginNoticeEnabled)
        : current.loginNoticeEnabled,
    loginNoticeMessage:
      req.body.loginNoticeMessage !== undefined
        ? String(req.body.loginNoticeMessage).trim()
        : current.loginNoticeMessage,
    supervisorEntryEnabled:
      req.body.supervisorEntryEnabled !== undefined
        ? Boolean(req.body.supervisorEntryEnabled)
        : current.supervisorEntryEnabled !== false,
    supervisorEntryDisabledMessage:
      req.body.supervisorEntryDisabledMessage !== undefined
        ? String(req.body.supervisorEntryDisabledMessage).trim()
        : current.supervisorEntryDisabledMessage,
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
