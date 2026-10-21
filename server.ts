import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import mongoose, { Schema } from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const DATA_DIR = path.resolve(__dirname, 'data');

// Ensure data directory exists for local fallback
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MASTER_FILE = path.join(DATA_DIR, 'master_employees.json');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// =========================================================================
// MONGOOSE SCHEMAS & MODELS
// =========================================================================

export interface IUser {
  id: string;
  username: string;
  employeeId?: string;
  passwordHash: string;
  name: string;
  email?: string;
  role: 'admin' | 'supervisor' | 'data_entry';
  status: 'active' | 'inactive';
  createdAt: string;
}

const UserSchema = new Schema<IUser>(
  {
    id: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true, unique: true, index: true },
    employeeId: { type: String, index: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, default: '' },
    role: { type: String, enum: ['admin', 'supervisor', 'data_entry'], required: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    createdAt: { type: String, default: () => new Date().toISOString() },
  },
  { timestamps: false, collection: 'users' }
);

export interface IMasterEmployee {
  enrollId: string;
  name: string;
  designation: string;
  department: string;
  jobType: string;
  joiningDate: string;
  cardIssue: string;
  emergencyContact: string;
  permanentAddress: string;
  bloodGroup: string;
  nationalId?: string;
  photo?: string;
  signature?: string;
  importedAt: string;
  updatedAt?: string;
}

const MasterEmployeeSchema = new Schema<IMasterEmployee>(
  {
    enrollId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    designation: { type: String, default: '' },
    department: { type: String, default: '' },
    jobType: { type: String, default: 'Permanent' },
    joiningDate: { type: String, default: '01/03/2026' },
    cardIssue: { type: String, default: '19/10/2026' },
    emergencyContact: { type: String, default: '' },
    permanentAddress: { type: String, default: '' },
    bloodGroup: { type: String, default: 'O+' },
    nationalId: { type: String, default: '' },
    photo: { type: String, default: '' },
    signature: { type: String, default: '' },
    importedAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String },
  },
  { timestamps: false, collection: 'master_employees' }
);

export interface ISubmission {
  id: string;
  enrollId: string;
  nationalId: string;
  photoUrl: string;
  signatureUrl: string;
  employee: any;
  submittedBy: {
    id: string;
    name: string;
    username: string;
    employeeId: string;
    role: string;
  };
  submittedAt: string;
  printStatus: 'pending' | 'printed';
  printCount: number;
  printedAt: string | null;
  reprintHistory: Array<{
    printedAt: string;
    printedBy: string;
    action: string;
    note: string;
  }>;
}

const SubmissionSchema = new Schema<ISubmission>(
  {
    id: { type: String, required: true, index: true },
    enrollId: { type: String, required: true, unique: true, index: true },
    nationalId: { type: String, required: true },
    photoUrl: { type: String, required: true },
    signatureUrl: { type: String, required: true },
    employee: { type: Schema.Types.Mixed, required: true },
    submittedBy: {
      id: String,
      name: String,
      username: String,
      employeeId: String,
      role: String,
    },
    submittedAt: { type: String, default: () => new Date().toISOString() },
    printStatus: { type: String, enum: ['pending', 'printed'], default: 'pending' },
    printCount: { type: Number, default: 0 },
    printedAt: { type: String, default: null },
    reprintHistory: [
      {
        printedAt: { type: String, required: true },
        printedBy: { type: String, required: true },
        action: { type: String, required: true },
        note: { type: String, default: '' },
      },
    ],
  },
  { timestamps: false, collection: 'submissions' }
);

export interface ISession {
  token: string;
  userId: string;
  expiresAt: number;
}

const SessionSchema = new Schema<ISession>(
  {
    token: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true },
    expiresAt: { type: Number, required: true },
  },
  { timestamps: false, collection: 'sessions' }
);

export interface IAppSettings {
  key: string;
  supervisorSuccessMessage: string;
  supervisorFormEnabled: boolean;
  supervisorFormDisabledMessage: string;
  pdfPrintLayout: 'side_by_side' | 'top_bottom';
  loginBackgroundImage: string;
  paperSize: string;
  cardsPerPage: number;
}

const AppSettingsSchema = new Schema<IAppSettings>(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    supervisorSuccessMessage: {
      type: String,
      default:
        'Employee ID Card data has been submitted successfully and queued for administrative review and printing. Thank you!',
    },
    supervisorFormEnabled: { type: Boolean, default: true },
    supervisorFormDisabledMessage: {
      type: String,
      default:
        'সাময়িক রক্ষণাবেক্ষণের জন্য আইডি কার্ড আবেদন কার্যক্রম বন্ধ রয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।',
    },
    pdfPrintLayout: { type: String, enum: ['side_by_side', 'top_bottom'], default: 'side_by_side' },
    loginBackgroundImage: { type: String, default: '/assets/default_login_bg.jpg' },
    paperSize: { type: String, default: 'a4' },
    cardsPerPage: { type: Number, default: 9 },
  },
  { timestamps: false, collection: 'settings' }
);

const UserModel = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
const MasterEmployeeModel =
  mongoose.models.MasterEmployee || mongoose.model<IMasterEmployee>('MasterEmployee', MasterEmployeeSchema);
const SubmissionModel =
  mongoose.models.Submission || mongoose.model<ISubmission>('Submission', SubmissionSchema);
const SessionModel =
  mongoose.models.Session || mongoose.model<ISession>('Session', SessionSchema);
const AppSettingsModel =
  mongoose.models.AppSettings || mongoose.model<IAppSettings>('AppSettings', AppSettingsSchema);

// Connection Status Flag
let isMongoConnected = false;

// =========================================================================
// LOCAL FALLBACK HELPER FUNCTIONS
// =========================================================================

const DEFAULT_SETTINGS: Omit<IAppSettings, 'key'> = {
  supervisorSuccessMessage:
    'Employee ID Card data has been submitted successfully and queued for administrative review and printing. Thank you!',
  supervisorFormEnabled: true,
  supervisorFormDisabledMessage:
    'সাময়িক রক্ষণাবেক্ষণের জন্য আইডি কার্ড আবেদন কার্যক্রম বন্ধ রয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।',
  pdfPrintLayout: 'side_by_side' as const,
  loginBackgroundImage: '/assets/default_login_bg.jpg',
  paperSize: 'a4',
  cardsPerPage: 9,
};

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

// Seed Records for Initial Setup
const INITIAL_ADMIN = {
  id: 'user-admin-1',
  username: 'Idcard@nuralam.com',
  employeeId: 'admin',
  passwordHash: hashPassword('@466035$'),
  name: 'System Administrator',
  email: 'Idcard@nuralam.com',
  role: 'admin' as const,
  status: 'active' as const,
  createdAt: new Date().toISOString(),
};

const INITIAL_SUPERVISOR = {
  id: 'user-supervisor-1',
  username: 'supervisor1',
  employeeId: 'SUP-2026-01',
  passwordHash: hashPassword('supervisor123'),
  name: 'Production Shift Supervisor',
  email: 'supervisor@company.com',
  role: 'supervisor' as const,
  status: 'active' as const,
  createdAt: new Date().toISOString(),
};

const INITIAL_MASTER_EMPLOYEES: Record<string, any> = {
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

// Initialize Local JSON files so fallback is always populated
function initializeLocalDatabase(): void {
  // 1. Users
  const users = readJsonFile<any[]>(USERS_FILE, []);
  let admin = users.find((u) => u.role === 'admin');
  if (!admin) {
    users.unshift({ ...INITIAL_ADMIN, employeeId: 'admin' });
  } else {
    admin.email = INITIAL_ADMIN.email;
    admin.username = INITIAL_ADMIN.username;
    admin.employeeId = 'admin';
    admin.passwordHash = INITIAL_ADMIN.passwordHash;
    admin.status = 'active';
  }

  if (!users.some((u) => u.role === 'supervisor')) {
    users.push({ ...INITIAL_SUPERVISOR });
  }
  writeJsonFile(USERS_FILE, users);

  // 2. Master Employees
  const master = readJsonFile<Record<string, any>>(MASTER_FILE, {});
  if (Object.keys(master).length === 0) {
    writeJsonFile(MASTER_FILE, INITIAL_MASTER_EMPLOYEES);
  }

  // 3. Submissions
  readJsonFile<Record<string, any>>(SUBMISSIONS_FILE, {});

  // 4. Settings
  const settings = readJsonFile<any>(SETTINGS_FILE, DEFAULT_SETTINGS);
  writeJsonFile(SETTINGS_FILE, { ...DEFAULT_SETTINGS, ...settings });
}

initializeLocalDatabase();

// =========================================================================
// MONGODB CONNECTION & SEEDING
// =========================================================================

async function seedMongoDatabase(): Promise<void> {
  try {
    // 1. Users seeding
    const userCount = await UserModel.countDocuments();
    if (userCount === 0) {
      // Seed from local users.json if populated, otherwise use initial records
      const localUsers = readJsonFile<any[]>(USERS_FILE, []);
      const usersToSeed = localUsers.length > 0 ? localUsers : [INITIAL_ADMIN, INITIAL_SUPERVISOR];
      await UserModel.insertMany(usersToSeed);
      console.log(`[MongoDB] Seeded ${usersToSeed.length} user accounts into MongoDB.`);
    } else {
      // Ensure required admin credentials always match
      await UserModel.findOneAndUpdate(
        { role: 'admin' },
        {
          $set: {
            username: INITIAL_ADMIN.username,
            employeeId: 'admin',
            email: INITIAL_ADMIN.email,
            passwordHash: INITIAL_ADMIN.passwordHash,
            status: 'active',
          },
        },
        { upsert: true }
      );
    }

    // 2. Master Employees seeding
    const empCount = await MasterEmployeeModel.countDocuments();
    if (empCount === 0) {
      const localMaster = readJsonFile<Record<string, any>>(MASTER_FILE, INITIAL_MASTER_EMPLOYEES);
      const employeesToSeed = Object.values(localMaster);
      if (employeesToSeed.length > 0) {
        await MasterEmployeeModel.insertMany(employeesToSeed);
        console.log(`[MongoDB] Seeded ${employeesToSeed.length} master employee records into MongoDB.`);
      }
    }

    // 3. Settings seeding
    const existingSettings = await AppSettingsModel.findOne({ key: 'global' });
    if (!existingSettings) {
      const localSettings = readJsonFile<any>(SETTINGS_FILE, DEFAULT_SETTINGS);
      await AppSettingsModel.create({
        key: 'global',
        ...DEFAULT_SETTINGS,
        ...localSettings,
      });
      console.log('[MongoDB] Seeded application settings into MongoDB.');
    }
  } catch (err: any) {
    console.error('[MongoDB] Seeding error:', err.message);
  }
}

async function connectMongoDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri || !uri.trim()) {
    console.log('[MongoDB] MONGODB_URI is not configured. Server running gracefully with local persistent storage.');
    isMongoConnected = false;
    return;
  }

  try {
    // Fail fast if offline, preventing hanging queries
    mongoose.set('bufferCommands', false);
    console.log('[MongoDB] Connecting to MongoDB Atlas...');
    await mongoose.connect(uri.trim(), {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 8000,
    });

    isMongoConnected = true;
    console.log('[MongoDB] Connected successfully to MongoDB Atlas.');
    await seedMongoDatabase();
  } catch (err: any) {
    isMongoConnected = false;
    console.warn('[MongoDB] Could not establish connection to MongoDB Atlas:', err.message);
    console.warn('[MongoDB] Falling back gracefully to local file storage. All features remain 100% operational.');
  }
}

// =========================================================================
// UNIFIED DATA ACCESS LAYER (MongoDB with Graceful Local Fallback)
// =========================================================================

// --- SESSIONS ---
async function createToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days

  // Always update local sessions file
  const localSessions = readJsonFile<Record<string, { userId: string; expiresAt: number }>>(SESSIONS_FILE, {});
  localSessions[token] = { userId, expiresAt };
  writeJsonFile(SESSIONS_FILE, localSessions);

  if (isMongoConnected) {
    try {
      await SessionModel.create({ token, userId, expiresAt });
    } catch (e) {
      // Non-fatal
    }
  }
  return token;
}

async function validateAndGetSession(token: string): Promise<{ userId: string; expiresAt: number } | null> {
  if (isMongoConnected) {
    try {
      const session = await SessionModel.findOne({ token }).lean();
      if (session) {
        if (session.expiresAt < Date.now()) {
          await SessionModel.deleteOne({ token });
          return null;
        }
        return { userId: session.userId, expiresAt: session.expiresAt };
      }
    } catch (e) {
      // Fallback below
    }
  }

  // Local fallback
  const localSessions = readJsonFile<Record<string, { userId: string; expiresAt: number }>>(SESSIONS_FILE, {});
  const session = localSessions[token];
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    delete localSessions[token];
    writeJsonFile(SESSIONS_FILE, localSessions);
    return null;
  }
  return session;
}

// --- USERS ---
async function findUserByCredentials(loginInput: string, passwordHash: string): Promise<IUser | null> {
  const clean = loginInput.trim().toLowerCase();

  if (isMongoConnected) {
    try {
      const user = await UserModel.findOne({
        $or: [
          { username: clean },
          { email: clean },
          { employeeId: clean },
        ],
        passwordHash,
      }).lean();
      if (user) return user as IUser;
    } catch (e) {
      // Fallback below
    }
  }

  // Local fallback
  const users = readJsonFile<IUser[]>(USERS_FILE, []);
  const user = users.find(
    (u) =>
      (u.username.toLowerCase() === clean ||
        (u.email && u.email.toLowerCase() === clean) ||
        (u.employeeId && u.employeeId.toLowerCase() === clean)) &&
      u.passwordHash === passwordHash
  );
  return user || null;
}

async function findSupervisorByCredentials(employeeId: string, passwordHash: string): Promise<IUser | null> {
  const cleanId = String(employeeId).trim().toLowerCase();

  if (isMongoConnected) {
    try {
      const sup = await UserModel.findOne({
        role: 'supervisor',
        $or: [
          { employeeId: cleanId },
          { username: cleanId },
          { email: cleanId },
        ],
        passwordHash,
      }).lean();
      if (sup) return sup as IUser;
    } catch (e) {
      // Fallback below
    }
  }

  // Local fallback
  const users = readJsonFile<IUser[]>(USERS_FILE, []);
  const sup = users.find(
    (u) =>
      u.role === 'supervisor' &&
      ((u.employeeId && u.employeeId.toLowerCase() === cleanId) ||
        u.username.toLowerCase() === cleanId ||
        (u.email && u.email.toLowerCase() === cleanId)) &&
      u.passwordHash === passwordHash
  );
  return sup || null;
}

async function findUserById(id: string): Promise<IUser | null> {
  if (isMongoConnected) {
    try {
      const user = await UserModel.findOne({ id }).lean();
      if (user) return user as IUser;
    } catch (e) {
      // Fallback below
    }
  }

  const users = readJsonFile<IUser[]>(USERS_FILE, []);
  return users.find((u) => u.id === id) || null;
}

async function getAllUsersList(): Promise<IUser[]> {
  if (isMongoConnected) {
    try {
      const users = await UserModel.find().lean();
      if (users && users.length > 0) return users as IUser[];
    } catch (e) {
      // Fallback below
    }
  }
  return readJsonFile<IUser[]>(USERS_FILE, []);
}

async function insertUserRecord(userData: IUser): Promise<IUser> {
  // Sync to local file
  const localUsers = readJsonFile<IUser[]>(USERS_FILE, []);
  localUsers.push(userData);
  writeJsonFile(USERS_FILE, localUsers);

  if (isMongoConnected) {
    try {
      await UserModel.create(userData);
    } catch (e) {
      console.warn('[MongoDB] User create error:', e);
    }
  }
  return userData;
}

async function updateUserRecord(id: string, updates: Partial<IUser>): Promise<IUser | null> {
  // Sync local file
  const localUsers = readJsonFile<IUser[]>(USERS_FILE, []);
  const idx = localUsers.findIndex((u) => u.id === id);
  let updatedUser: IUser | null = null;
  if (idx !== -1) {
    localUsers[idx] = { ...localUsers[idx], ...updates };
    updatedUser = localUsers[idx];
    writeJsonFile(USERS_FILE, localUsers);
  }

  if (isMongoConnected) {
    try {
      const res = await UserModel.findOneAndUpdate({ id }, { $set: updates }, { new: true }).lean();
      if (res) updatedUser = res as IUser;
    } catch (e) {
      console.warn('[MongoDB] User update error:', e);
    }
  }
  return updatedUser;
}

async function deleteUserRecord(id: string): Promise<boolean> {
  const localUsers = readJsonFile<IUser[]>(USERS_FILE, []);
  const filtered = localUsers.filter((u) => u.id !== id);
  writeJsonFile(USERS_FILE, filtered);

  if (isMongoConnected) {
    try {
      await UserModel.deleteOne({ id });
    } catch (e) {
      console.warn('[MongoDB] User delete error:', e);
    }
  }
  return true;
}

// --- MASTER EMPLOYEES ---
async function getMasterEmployeeRecord(enrollId: string): Promise<IMasterEmployee | null> {
  const cleanId = String(enrollId).trim();

  if (isMongoConnected) {
    try {
      const emp = await MasterEmployeeModel.findOne({ enrollId: cleanId }).lean();
      if (emp) return emp as IMasterEmployee;
    } catch (e) {
      // Fallback below
    }
  }

  const master = readJsonFile<Record<string, any>>(MASTER_FILE, {});
  return master[cleanId] || null;
}

async function insertMasterEmployeeRecord(emp: IMasterEmployee): Promise<IMasterEmployee> {
  const cleanId = String(emp.enrollId).trim();

  // Local sync
  const master = readJsonFile<Record<string, any>>(MASTER_FILE, {});
  master[cleanId] = emp;
  writeJsonFile(MASTER_FILE, master);

  if (isMongoConnected) {
    try {
      await MasterEmployeeModel.create(emp);
    } catch (e: any) {
      console.warn('[MongoDB] Master employee insert error:', e.message);
    }
  }

  return emp;
}

async function getAllMasterEmployeesList(): Promise<IMasterEmployee[]> {
  if (isMongoConnected) {
    try {
      const records = await MasterEmployeeModel.find().lean();
      if (records && records.length > 0) return records as IMasterEmployee[];
    } catch (e) {
      // Fallback below
    }
  }

  const master = readJsonFile<Record<string, any>>(MASTER_FILE, {});
  return Object.values(master);
}

async function updateMasterEmployeeRecord(enrollId: string, updates: Partial<IMasterEmployee>): Promise<IMasterEmployee | null> {
  const cleanId = String(enrollId).trim();

  // Local sync
  const master = readJsonFile<Record<string, any>>(MASTER_FILE, {});
  let updated: IMasterEmployee | null = null;
  if (master[cleanId]) {
    master[cleanId] = { ...master[cleanId], ...updates, updatedAt: new Date().toISOString() };
    updated = master[cleanId];
    writeJsonFile(MASTER_FILE, master);
  }

  if (isMongoConnected) {
    try {
      const res = await MasterEmployeeModel.findOneAndUpdate(
        { enrollId: cleanId },
        { $set: { ...updates, updatedAt: new Date().toISOString() } },
        { new: true }
      ).lean();
      if (res) updated = res as IMasterEmployee;
    } catch (e) {
      console.warn('[MongoDB] Master employee update error:', e);
    }
  }
  return updated;
}

async function deleteMasterEmployeeRecord(enrollId: string): Promise<boolean> {
  const cleanId = String(enrollId).trim();

  const master = readJsonFile<Record<string, any>>(MASTER_FILE, {});
  delete master[cleanId];
  writeJsonFile(MASTER_FILE, master);

  if (isMongoConnected) {
    try {
      await MasterEmployeeModel.deleteOne({ enrollId: cleanId });
    } catch (e) {
      console.warn('[MongoDB] Master employee delete error:', e);
    }
  }
  return true;
}

async function clearAllMasterEmployeesRecords(): Promise<void> {
  writeJsonFile(MASTER_FILE, {});

  if (isMongoConnected) {
    try {
      await MasterEmployeeModel.deleteMany({});
    } catch (e) {
      console.warn('[MongoDB] Clear master employees error:', e);
    }
  }
}

// --- SUBMISSIONS ---
async function getSubmissionRecord(enrollId: string): Promise<ISubmission | null> {
  const cleanId = String(enrollId).trim();

  if (isMongoConnected) {
    try {
      const sub = await SubmissionModel.findOne({ enrollId: cleanId }).lean();
      if (sub) return sub as ISubmission;
    } catch (e) {
      // Fallback below
    }
  }

  const submissions = readJsonFile<Record<string, any>>(SUBMISSIONS_FILE, {});
  return submissions[cleanId] || null;
}

async function getAllSubmissionsList(): Promise<ISubmission[]> {
  if (isMongoConnected) {
    try {
      const list = await SubmissionModel.find().lean();
      if (list && list.length > 0) return list as ISubmission[];
    } catch (e) {
      // Fallback below
    }
  }

  const submissions = readJsonFile<Record<string, any>>(SUBMISSIONS_FILE, {});
  return Object.values(submissions);
}

async function createSubmissionRecord(submissionData: ISubmission): Promise<ISubmission> {
  // Local sync
  const submissions = readJsonFile<Record<string, any>>(SUBMISSIONS_FILE, {});
  submissions[submissionData.enrollId] = submissionData;
  writeJsonFile(SUBMISSIONS_FILE, submissions);

  if (isMongoConnected) {
    try {
      await SubmissionModel.create(submissionData);
    } catch (e) {
      console.warn('[MongoDB] Submission create error:', e);
    }
  }
  return submissionData;
}

async function updateSubmissionRecord(enrollId: string, updates: Partial<ISubmission>): Promise<ISubmission | null> {
  const cleanId = String(enrollId).trim();

  const submissions = readJsonFile<Record<string, any>>(SUBMISSIONS_FILE, {});
  let updated: ISubmission | null = null;
  if (submissions[cleanId]) {
    submissions[cleanId] = { ...submissions[cleanId], ...updates };
    updated = submissions[cleanId];
    writeJsonFile(SUBMISSIONS_FILE, submissions);
  }

  if (isMongoConnected) {
    try {
      const res = await SubmissionModel.findOneAndUpdate(
        { enrollId: cleanId },
        { $set: updates },
        { new: true }
      ).lean();
      if (res) updated = res as ISubmission;
    } catch (e) {
      console.warn('[MongoDB] Submission update error:', e);
    }
  }
  return updated;
}

async function deleteSubmissionRecord(enrollId: string): Promise<boolean> {
  const cleanId = String(enrollId).trim();

  const submissions = readJsonFile<Record<string, any>>(SUBMISSIONS_FILE, {});
  delete submissions[cleanId];
  writeJsonFile(SUBMISSIONS_FILE, submissions);

  if (isMongoConnected) {
    try {
      await SubmissionModel.deleteOne({ enrollId: cleanId });
    } catch (e) {
      console.warn('[MongoDB] Submission delete error:', e);
    }
  }
  return true;
}

// --- SETTINGS ---
async function getApplicationSettings(): Promise<IAppSettings> {
  if (isMongoConnected) {
    try {
      const settings = await AppSettingsModel.findOne({ key: 'global' }).lean();
      if (settings) {
        return {
          key: 'global',
          supervisorSuccessMessage: settings.supervisorSuccessMessage || DEFAULT_SETTINGS.supervisorSuccessMessage,
          supervisorFormEnabled: settings.supervisorFormEnabled !== false,
          supervisorFormDisabledMessage: settings.supervisorFormDisabledMessage || DEFAULT_SETTINGS.supervisorFormDisabledMessage,
          pdfPrintLayout: settings.pdfPrintLayout || DEFAULT_SETTINGS.pdfPrintLayout,
          loginBackgroundImage: settings.loginBackgroundImage || DEFAULT_SETTINGS.loginBackgroundImage,
          paperSize: settings.paperSize || DEFAULT_SETTINGS.paperSize,
          cardsPerPage: Number(settings.cardsPerPage) || DEFAULT_SETTINGS.cardsPerPage,
        };
      }
    } catch (e) {
      // Fallback below
    }
  }

  const local = readJsonFile<any>(SETTINGS_FILE, DEFAULT_SETTINGS);
  return {
    key: 'global',
    supervisorSuccessMessage: local.supervisorSuccessMessage || DEFAULT_SETTINGS.supervisorSuccessMessage,
    supervisorFormEnabled: local.supervisorFormEnabled !== false,
    supervisorFormDisabledMessage: local.supervisorFormDisabledMessage || DEFAULT_SETTINGS.supervisorFormDisabledMessage,
    pdfPrintLayout: local.pdfPrintLayout || DEFAULT_SETTINGS.pdfPrintLayout,
    loginBackgroundImage: local.loginBackgroundImage || DEFAULT_SETTINGS.loginBackgroundImage,
    paperSize: local.paperSize || DEFAULT_SETTINGS.paperSize,
    cardsPerPage: Number(local.cardsPerPage) || DEFAULT_SETTINGS.cardsPerPage,
  };
}

async function updateApplicationSettings(updates: Partial<IAppSettings>): Promise<IAppSettings> {
  const current = await getApplicationSettings();
  const merged: IAppSettings = {
    key: 'global',
    supervisorSuccessMessage:
      updates.supervisorSuccessMessage !== undefined
        ? String(updates.supervisorSuccessMessage).trim()
        : current.supervisorSuccessMessage,
    supervisorFormEnabled:
      updates.supervisorFormEnabled !== undefined ? Boolean(updates.supervisorFormEnabled) : current.supervisorFormEnabled,
    supervisorFormDisabledMessage:
      updates.supervisorFormDisabledMessage !== undefined
        ? String(updates.supervisorFormDisabledMessage).trim()
        : current.supervisorFormDisabledMessage,
    pdfPrintLayout: updates.pdfPrintLayout === 'top_bottom' ? 'top_bottom' : 'side_by_side',
    loginBackgroundImage:
      updates.loginBackgroundImage !== undefined
        ? String(updates.loginBackgroundImage).trim()
        : current.loginBackgroundImage,
    paperSize: updates.paperSize !== undefined ? String(updates.paperSize).trim() : current.paperSize,
    cardsPerPage:
      updates.cardsPerPage !== undefined ? Number(updates.cardsPerPage) || 9 : current.cardsPerPage,
  };

  writeJsonFile(SETTINGS_FILE, merged);

  if (isMongoConnected) {
    try {
      await AppSettingsModel.findOneAndUpdate({ key: 'global' }, { $set: merged }, { upsert: true, new: true }).lean();
    } catch (e) {
      console.warn('[MongoDB] Settings update error:', e);
    }
  }
  return merged;
}

// =========================================================================
// EXPRESS MIDDLEWARE
// =========================================================================

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

interface AuthenticatedRequest extends Request {
  user?: any;
}

// Authentication Middleware
async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  const session = await validateAndGetSession(token);
  if (!session) {
    res.status(401).json({ error: 'Session expired. Please sign in again.' });
    return;
  }

  const user = await findUserById(session.userId);

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

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const loginInput = req.body.enroll || req.body.username || req.body.employeeId;
  const { password } = req.body;
  if (!loginInput || !String(loginInput).trim() || !password) {
    res.status(400).json({ error: 'Please enter Enroll and Password.' });
    return;
  }

  const pwHash = hashPassword(password);
  const user = await findUserByCredentials(String(loginInput).trim(), pwHash);

  if (!user) {
    res.status(401).json({ error: 'Invalid Enroll or Password.' });
    return;
  }

  if (user.status !== 'active') {
    res.status(403).json({ error: 'This user account has been deactivated.' });
    return;
  }

  const token = await createToken(user.id);

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
app.post('/api/auth/supervisor-login', async (req: Request, res: Response) => {
  const { employeeId, password } = req.body;
  if (!employeeId || !String(employeeId).trim() || !password) {
    res.status(400).json({ error: 'Supervisor Employee ID/Enrollment Number and password are required.' });
    return;
  }

  const pwHash = hashPassword(password);
  const supervisor = await findSupervisorByCredentials(employeeId, pwHash);

  if (!supervisor) {
    // Check if account exists with non-supervisor role or invalid password
    const allUsers = await getAllUsersList();
    const cleanId = String(employeeId).trim().toLowerCase();
    const otherAccount = allUsers.find(
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

  const token = await createToken(supervisor.id);

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

app.get('/api/users', authenticateToken, requireAdminRole, async (_req: Request, res: Response) => {
  const users = await getAllUsersList();
  const safeUsers = users.map(({ passwordHash, ...u }) => u);
  res.json(safeUsers);
});

app.post('/api/users', authenticateToken, requireAdminRole, async (req: Request, res: Response) => {
  const { username, password, name, email, role, employeeId } = req.body;

  if (!username || !password || !name) {
    res.status(400).json({ error: 'Username, password, and name are required.' });
    return;
  }

  const cleanUsername = username.trim().toLowerCase();
  const allUsers = await getAllUsersList();

  if (allUsers.some((u) => u.username.toLowerCase() === cleanUsername)) {
    res.status(409).json({ error: `Username "${username}" is already taken.` });
    return;
  }

  let assignedRole: 'admin' | 'data_entry' | 'supervisor' = 'data_entry';
  if (role === 'admin') assignedRole = 'admin';
  else if (role === 'supervisor') assignedRole = 'supervisor';

  const cleanEmployeeId = employeeId ? String(employeeId).trim() : cleanUsername;

  const newUser: IUser = {
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

  await insertUserRecord(newUser);

  const { passwordHash: _, ...safeUser } = newUser;
  res.status(201).json(safeUser);
});

app.put('/api/users/:id', authenticateToken, requireAdminRole, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, email, role, status, password, employeeId } = req.body;

  const existing = await findUserById(id);
  if (!existing) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const updates: Partial<IUser> = {};
  if (name !== undefined) updates.name = name.trim();
  if (email !== undefined) updates.email = email.trim();
  if (role !== undefined) {
    if (role === 'admin') updates.role = 'admin';
    else if (role === 'supervisor') updates.role = 'supervisor';
    else updates.role = 'data_entry';
  }
  if (employeeId !== undefined) updates.employeeId = String(employeeId).trim();
  if (status !== undefined) updates.status = status === 'inactive' ? 'inactive' : 'active';
  if (password && password.trim() !== '') {
    updates.passwordHash = hashPassword(password.trim());
  }

  const updated = await updateUserRecord(id, updates);
  if (!updated) {
    res.status(500).json({ error: 'Failed to update user.' });
    return;
  }

  const { passwordHash: _, ...safeUser } = updated;
  res.json(safeUser);
});

app.delete('/api/users/:id', authenticateToken, requireAdminRole, async (req: Request, res: Response) => {
  const { id } = req.params;
  const target = await findUserById(id);
  if (!target) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  // Prevent deleting the last admin
  if (target.role === 'admin') {
    const allUsers = await getAllUsersList();
    const adminCount = allUsers.filter((u) => u.role === 'admin').length;
    if (adminCount <= 1) {
      res.status(400).json({ error: 'Cannot delete the only administrator account.' });
      return;
    }
  }

  await deleteUserRecord(id);
  res.json({ success: true, message: 'User deleted successfully.' });
});

// --- EMPLOYEE MASTER DATABASE (ADMIN ONLY FOR MANAGEMENT) ---

app.get('/api/master-employees', authenticateToken, requireAdminRole, async (_req: Request, res: Response) => {
  const records = await getAllMasterEmployeesList();
  res.json(records);
});

app.post('/api/master-employees/import', authenticateToken, requireAdminRole, async (req: Request, res: Response) => {
  const { employees } = req.body;

  if (!Array.isArray(employees) || employees.length === 0) {
    res.status(400).json({ error: 'Expected non-empty array of employee records.' });
    return;
  }

  // Fetch current database records to prevent overwriting
  const currentRecords = await getAllMasterEmployeesList();
  const existingMap = new Map<string, IMasterEmployee>();
  for (const r of currentRecords) {
    existingMap.set(r.enrollId, r);
  }

  const seenInBatch = new Set<string>();
  let addedCount = 0;
  let duplicateCount = 0;
  let failedCount = 0;

  const sampleDuplicates: string[] = [];
  const sampleFailed: string[] = [];
  const recordsToInsert: IMasterEmployee[] = [];

  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    if (!emp || typeof emp !== 'object') {
      failedCount++;
      continue;
    }

    const rawEnrollId = emp.enrollId !== undefined && emp.enrollId !== null ? String(emp.enrollId).trim() : '';
    const rawName = emp.name !== undefined && emp.name !== null ? String(emp.name).trim() : '';

    // Validate required fields
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
    if (existingMap.has(rawEnrollId)) {
      duplicateCount++;
      if (sampleDuplicates.length < 15) {
        sampleDuplicates.push(`${rawEnrollId} (already in database)`);
      }
      continue;
    }

    const record: IMasterEmployee = {
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

    recordsToInsert.push(record);
    existingMap.set(rawEnrollId, record);
    addedCount++;
  }

  // Atomically persist to MongoDB collection if connected
  if (isMongoConnected && recordsToInsert.length > 0) {
    try {
      await MasterEmployeeModel.insertMany(recordsToInsert);
    } catch (err: any) {
      console.warn('[MongoDB] Batch import insert error:', err.message);
    }
  }

  // Sync to local JSON file
  const localMaster = readJsonFile<Record<string, any>>(MASTER_FILE, {});
  for (const r of recordsToInsert) {
    localMaster[r.enrollId] = r;
  }
  writeJsonFile(MASTER_FILE, localMaster);

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
    totalRecords: existingMap.size,
  });
});

// Admin-only: add individual employee to master database
app.post('/api/master-employees', authenticateToken, requireAdminRole, async (req: Request, res: Response) => {
  const {
    enrollId,
    name,
    designation,
    department,
    jobType,
    joiningDate,
    cardIssue,
    emergencyContact,
    contactNumber,
    permanentAddress,
    bloodGroup,
    nationalId,
    photo,
    photoUrl,
    signature,
    signatureUrl,
  } = req.body;

  const cleanEnrollId = enrollId !== undefined && enrollId !== null ? String(enrollId).trim() : '';
  const cleanName = name !== undefined && name !== null ? String(name).trim() : '';

  if (!cleanEnrollId || !cleanName) {
    res.status(400).json({ error: 'Enrollment ID and Name are required.' });
    return;
  }

  // Prevent duplicate Enrollment ID
  const existing = await getMasterEmployeeRecord(cleanEnrollId);
  if (existing) {
    res.status(409).json({ error: `An employee with Enrollment ID "${cleanEnrollId}" already exists in the master database.` });
    return;
  }

  const finalPhoto = String(photo || photoUrl || '').trim();
  const finalSignature = String(signature || signatureUrl || '').trim();

  // Validate photo size (200 KB target with 250 KB ceiling)
  if (finalPhoto && finalPhoto.startsWith('data:image')) {
    const photoBytes = Math.round((finalPhoto.length * 3) / 4);
    if (photoBytes > 250 * 1024) {
      res.status(400).json({
        error: 'Employee photo size exceeds 200 KB limit. Please upload a compressed photo.',
      });
      return;
    }
  }

  // Validate signature size (200 KB target with 250 KB ceiling)
  if (finalSignature && finalSignature.startsWith('data:image')) {
    const sigBytes = Math.round((finalSignature.length * 3) / 4);
    if (sigBytes > 250 * 1024) {
      res.status(400).json({
        error: 'Employee signature size exceeds 200 KB limit. Please upload a compressed signature.',
      });
      return;
    }
  }

  const newEmployee: IMasterEmployee = {
    enrollId: cleanEnrollId,
    name: cleanName,
    designation: String(designation || '').trim(),
    department: String(department || '').trim(),
    jobType: String(jobType || 'Permanent').trim(),
    joiningDate: String(joiningDate || '01/03/2026').trim(),
    cardIssue: String(cardIssue || '19/10/2026').trim(),
    emergencyContact: String(emergencyContact || contactNumber || '').trim(),
    permanentAddress: String(permanentAddress || '').trim(),
    bloodGroup: String(bloodGroup || 'O+').trim(),
    nationalId: String(nationalId || '').trim(),
    photo: finalPhoto,
    signature: finalSignature,
    importedAt: new Date().toISOString(),
  };

  await insertMasterEmployeeRecord(newEmployee);

  res.status(201).json({
    success: true,
    message: `Employee "${cleanEnrollId} - ${cleanName}" added to master database.`,
    employee: newEmployee,
  });
});

app.put('/api/master-employees/:enrollId', authenticateToken, requireAdminRole, async (req: Request, res: Response) => {
  const { enrollId } = req.params;
  const existing = await getMasterEmployeeRecord(enrollId);

  if (!existing) {
    res.status(404).json({ error: `Employee with Enrollment ID "${enrollId}" not found.` });
    return;
  }

  const b = req.body;
  const updates: Partial<IMasterEmployee> = {};

  if (b.name !== undefined) updates.name = String(b.name).trim();
  if (b.designation !== undefined) updates.designation = String(b.designation).trim();
  if (b.department !== undefined) updates.department = String(b.department).trim();
  if (b.jobType !== undefined) updates.jobType = String(b.jobType).trim();
  if (b.joiningDate !== undefined) updates.joiningDate = String(b.joiningDate).trim();
  if (b.cardIssue !== undefined) updates.cardIssue = String(b.cardIssue).trim();
  if (b.emergencyContact !== undefined) updates.emergencyContact = String(b.emergencyContact).trim();
  if (b.permanentAddress !== undefined) updates.permanentAddress = String(b.permanentAddress).trim();
  if (b.bloodGroup !== undefined) updates.bloodGroup = String(b.bloodGroup).trim();
  if (b.nationalId !== undefined) updates.nationalId = String(b.nationalId).trim();
  if (b.photo !== undefined) updates.photo = String(b.photo).trim();
  if (b.signature !== undefined) updates.signature = String(b.signature).trim();

  const updated = await updateMasterEmployeeRecord(enrollId, updates);

  res.json({
    success: true,
    message: `Employee ${enrollId} updated successfully.`,
    employee: updated,
  });
});

app.delete('/api/master-employees/:enrollId', authenticateToken, requireAdminRole, async (req: Request, res: Response) => {
  const { enrollId } = req.params;
  const existing = await getMasterEmployeeRecord(enrollId);

  if (!existing) {
    res.status(404).json({ error: `Employee with Enrollment ID "${enrollId}" not found.` });
    return;
  }

  await deleteMasterEmployeeRecord(enrollId);
  res.json({ success: true, message: `Employee ${enrollId} deleted from master database.` });
});

app.delete('/api/master-employees', authenticateToken, requireAdminRole, async (_req: Request, res: Response) => {
  await clearAllMasterEmployeesRecords();
  res.json({ success: true, message: 'All master employee records have been cleared.' });
});

// --- SEARCH MASTER EMPLOYEES (AUTHENTICATED SUPERVISOR, DATA ENTRY & ADMIN) ---
app.get('/api/master-employees/search', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  // Reject employee searches from supervisor if form is in maintenance mode
  if (req.user?.role === 'supervisor') {
    const settings = await getApplicationSettings();
    if (settings.supervisorFormEnabled === false) {
      res.status(403).json({
        error:
          settings.supervisorFormDisabledMessage ||
          'সাময়িক রক্ষণাবেক্ষণের জন্য আইডি কার্ড আবেদন কার্যক্রম বন্ধ রয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।',
        formDisabled: true,
      });
      return;
    }
  }

  const query = String(req.query.q || req.query.query || '').trim().toLowerCase();
  if (!query) {
    res.json({ results: [] });
    return;
  }

  const allEmployees = await getAllMasterEmployeesList();
  const allSubmissions = await getAllSubmissionsList();
  const submissionSet = new Set(allSubmissions.map((s) => String(s.enrollId).trim()));

  const matches = allEmployees.filter((emp) => {
    const id = String(emp.enrollId || '').toLowerCase();
    const name = String(emp.name || '').toLowerCase();
    const nid = String(emp.nationalId || '').toLowerCase();
    return id.includes(query) || name.includes(query) || (nid && nid.includes(query));
  });

  const limited = matches.slice(0, 10).map((emp) => ({
    enrollId: emp.enrollId,
    name: emp.name,
    designation: emp.designation,
    department: emp.department,
    bloodGroup: emp.bloodGroup,
    alreadySubmitted: submissionSet.has(String(emp.enrollId).trim()),
  }));

  res.json({ results: limited });
});

// Alias for search
app.get('/api/employees/search', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role === 'supervisor') {
    const settings = await getApplicationSettings();
    if (settings.supervisorFormEnabled === false) {
      res.status(403).json({
        error:
          settings.supervisorFormDisabledMessage ||
          'সাময়িক রক্ষণাবেক্ষণের জন্য আইডি কার্ড আবেদন কার্যক্রম বন্ধ রয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।',
        formDisabled: true,
      });
      return;
    }
  }

  const query = String(req.query.q || '').trim().toLowerCase();
  if (!query) {
    res.json({ results: [] });
    return;
  }

  const allEmployees = await getAllMasterEmployeesList();
  const allSubmissions = await getAllSubmissionsList();
  const submissionSet = new Set(allSubmissions.map((s) => String(s.enrollId).trim()));

  const matches = allEmployees.filter((emp) => {
    const id = String(emp.enrollId || '').toLowerCase();
    const name = String(emp.name || '').toLowerCase();
    const nid = String(emp.nationalId || '').toLowerCase();
    return id.includes(query) || name.includes(query) || (nid && nid.includes(query));
  });

  const limited = matches.slice(0, 10).map((emp) => ({
    enrollId: emp.enrollId,
    name: emp.name,
    designation: emp.designation,
    department: emp.department,
    bloodGroup: emp.bloodGroup,
    alreadySubmitted: submissionSet.has(String(emp.enrollId).trim()),
  }));

  res.json({ results: limited });
});

// --- LOOKUP EMPLOYEE (AUTHENTICATED SUPERVISOR, DATA ENTRY & ADMIN) ---
app.get('/api/lookup-employee/:enrollId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  // Reject lookup from supervisor if form is in maintenance mode
  if (req.user?.role === 'supervisor') {
    const settings = await getApplicationSettings();
    if (settings.supervisorFormEnabled === false) {
      res.status(403).json({
        error:
          settings.supervisorFormDisabledMessage ||
          'সাময়িক রক্ষণাবেক্ষণের জন্য আইডি কার্ড আবেদন কার্যক্রম বন্ধ রয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।',
        formDisabled: true,
      });
      return;
    }
  }

  const enrollId = req.params.enrollId.trim();
  const employee = await getMasterEmployeeRecord(enrollId);
  const submission = await getSubmissionRecord(enrollId);

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

// --- SUBMISSIONS (SUPERVISOR, DATA ENTRY & ADMIN) ---

app.post('/api/submissions', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  // SERVER-SIDE SUPERVISOR FORM ON/OFF CONTROL
  if (req.user?.role === 'supervisor') {
    const settings = await getApplicationSettings();
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
  const masterEmp = await getMasterEmployeeRecord(cleanEnrollId);
  if (!masterEmp) {
    res.status(404).json({
      error: `Cannot submit: Enrollment ID "${cleanEnrollId}" does not exist in the Master Employee Database.`,
    });
    return;
  }

  // SERVER-SIDE DUPLICATE PROTECTION: Block if already submitted
  const existingSub = await getSubmissionRecord(cleanEnrollId);
  if (existingSub) {
    res.status(409).json({
      error: `Already submitted for Enrollment ID "${cleanEnrollId}". This record was submitted on ${new Date(
        existingSub.submittedAt
      ).toLocaleDateString()} by ${existingSub.submittedBy?.name || 'Operator'}. Duplicate submissions are strictly blocked.`,
      alreadySubmitted: true,
      submission: {
        submittedAt: existingSub.submittedAt,
        submittedBy: existingSub.submittedBy?.name,
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

  // Validate maximum image payload size (200 KB target with safe margin)
  const photoSize = Math.round((photoUrl.length * 3) / 4);
  const sigSize = Math.round((signatureUrl.length * 3) / 4);
  if (photoSize > 350 * 1024 || sigSize > 350 * 1024) {
    res.status(400).json({
      error: 'ছবি বা সিগনেচারের সাইজ অনেক বেশি বড়! অনুগ্রহ করে ২০০ কিলোবাইটের (200 KB) নিচের ছবি বা সিগনেচার আপলোড করুন।',
      sizeExceeded: true,
    });
    return;
  }

  const newSubmission: ISubmission = {
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

  await createSubmissionRecord(newSubmission);

  const currentSettings = await getApplicationSettings();

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
app.get('/api/submissions', authenticateToken, requireAdminRole, async (_req: Request, res: Response) => {
  const submissions = await getAllSubmissionsList();
  const normalized = submissions.map((sub: any) => ({
    ...sub,
    printStatus: sub.printStatus === 'printed' ? 'printed' : 'pending',
    printCount: typeof sub.printCount === 'number' ? sub.printCount : sub.printStatus === 'printed' ? 1 : 0,
    reprintHistory: Array.isArray(sub.reprintHistory) ? sub.reprintHistory : [],
  }));
  res.json(normalized);
});

// Admin-only: mark single submission as printed
app.post('/api/submissions/:enrollId/mark-printed', authenticateToken, requireAdminRole, async (req: AuthenticatedRequest, res: Response) => {
  const { enrollId } = req.params;
  const record = await getSubmissionRecord(enrollId);

  if (!record) {
    res.status(404).json({ error: `Submission for Enrollment ID "${enrollId}" not found.` });
    return;
  }

  const now = new Date().toISOString();
  const isFirstPrint = record.printStatus !== 'printed';
  const newPrintCount = (record.printCount || 0) + 1;
  const reprintHistory = Array.isArray(record.reprintHistory) ? [...record.reprintHistory] : [];

  reprintHistory.push({
    printedAt: now,
    printedBy: req.user.name || req.user.username,
    action: isFirstPrint ? 'initial_print' : 'reprint',
    note: req.body?.note || (isFirstPrint ? 'Initial ID card printed' : 'Card reprint completed'),
  });

  const updated = await updateSubmissionRecord(enrollId, {
    printStatus: 'printed',
    printedAt: now,
    printCount: newPrintCount,
    reprintHistory,
  });

  res.json({
    success: true,
    message: `Card for ${enrollId} marked as printed.`,
    record: updated,
  });
});

// Admin-only: log a reprint action
app.post('/api/submissions/:enrollId/reprint', authenticateToken, requireAdminRole, async (req: AuthenticatedRequest, res: Response) => {
  const { enrollId } = req.params;
  const record = await getSubmissionRecord(enrollId);

  if (!record) {
    res.status(404).json({ error: `Submission for Enrollment ID "${enrollId}" not found.` });
    return;
  }

  const now = new Date().toISOString();
  const newPrintCount = (record.printCount || 1) + 1;
  const reprintHistory = Array.isArray(record.reprintHistory) ? [...record.reprintHistory] : [];

  reprintHistory.push({
    printedAt: now,
    printedBy: req.user.name || req.user.username,
    action: 'reprint',
    note: req.body?.note || 'Reprint issued by administrator',
  });

  const updated = await updateSubmissionRecord(enrollId, {
    printStatus: 'printed',
    printedAt: now,
    printCount: newPrintCount,
    reprintHistory,
  });

  res.json({
    success: true,
    message: `Card for ${enrollId} marked as reprinted (Print #${newPrintCount}).`,
    record: updated,
  });
});

// Admin-only: bulk mark multiple submissions as printed
app.post('/api/submissions/bulk-mark-printed', authenticateToken, requireAdminRole, async (req: AuthenticatedRequest, res: Response) => {
  const { enrollIds, note } = req.body;
  if (!Array.isArray(enrollIds) || enrollIds.length === 0) {
    res.status(400).json({ error: 'Expected non-empty array of enrollIds.' });
    return;
  }

  const now = new Date().toISOString();
  let updatedCount = 0;

  for (const enrollId of enrollIds) {
    const record = await getSubmissionRecord(enrollId);
    if (record) {
      const isFirstPrint = record.printStatus !== 'printed';
      const newPrintCount = (record.printCount || 0) + 1;
      const reprintHistory = Array.isArray(record.reprintHistory) ? [...record.reprintHistory] : [];

      reprintHistory.push({
        printedAt: now,
        printedBy: req.user.name || req.user.username,
        action: isFirstPrint ? 'initial_print' : 'reprint',
        note: note || (isFirstPrint ? 'Batch print output' : 'Batch reprint output'),
      });

      await updateSubmissionRecord(enrollId, {
        printStatus: 'printed',
        printedAt: now,
        printCount: newPrintCount,
        reprintHistory,
      });

      updatedCount++;
    }
  }

  res.json({
    success: true,
    message: `Successfully marked ${updatedCount} submissions as printed.`,
    updatedCount,
  });
});

// Admin-only: delete submission to allow resubmission if needed
app.delete('/api/submissions/:enrollId', authenticateToken, requireAdminRole, async (req: Request, res: Response) => {
  const { enrollId } = req.params;
  const existing = await getSubmissionRecord(enrollId);

  if (!existing) {
    res.status(404).json({ error: `Submission for Enrollment ID "${enrollId}" not found.` });
    return;
  }

  await deleteSubmissionRecord(enrollId);
  res.json({ success: true, message: `Submission for ${enrollId} deleted.` });
});

// --- SETTINGS (ADMIN CONFIGURABLE & PUBLIC CONFIRMATION MESSAGE) ---

// Public settings endpoint: get public confirmation message & form status without requiring authentication
app.get('/api/settings/public', async (_req: Request, res: Response) => {
  const settings = await getApplicationSettings();
  res.json({
    supervisorSuccessMessage: settings.supervisorSuccessMessage,
    supervisorFormEnabled: settings.supervisorFormEnabled !== false,
    supervisorFormDisabledMessage: settings.supervisorFormDisabledMessage,
    pdfPrintLayout: settings.pdfPrintLayout,
    loginBackgroundImage: settings.loginBackgroundImage || '/assets/default_login_bg.jpg',
    paperSize: settings.paperSize || 'a4',
    cardsPerPage: settings.cardsPerPage || 9,
  });
});

// Admin-only: get full application settings
app.get('/api/settings', authenticateToken, requireAdminRole, async (_req: Request, res: Response) => {
  const settings = await getApplicationSettings();
  res.json(settings);
});

// Admin-only: update application settings
app.put('/api/settings', authenticateToken, requireAdminRole, async (req: Request, res: Response) => {
  const updated = await updateApplicationSettings({
    supervisorSuccessMessage: req.body.supervisorSuccessMessage,
    supervisorFormEnabled: req.body.supervisorFormEnabled,
    supervisorFormDisabledMessage: req.body.supervisorFormDisabledMessage,
    pdfPrintLayout: req.body.pdfPrintLayout,
    loginBackgroundImage: req.body.loginBackgroundImage,
    paperSize: req.body.paperSize,
    cardsPerPage: req.body.cardsPerPage,
  });
  res.json(updated);
});

// Database status endpoint (Admin view)
app.get('/api/system/db-status', authenticateToken, requireAdminRole, (_req: Request, res: Response) => {
  res.json({
    databaseType: isMongoConnected ? 'MongoDB Atlas' : 'Local Persistent Storage (Fallback)',
    isMongoConnected,
    hasMongoUriConfigured: Boolean(process.env.MONGODB_URI),
  });
});

// Database offline error middleware for graceful resilience
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err && (err.name === 'MongooseError' || err.name === 'MongoNetworkError' || (typeof err.message === 'string' && err.message.includes('buffering timed out')))) {
    console.warn('[AI Studio] Database offline or buffering error — returning graceful response');
    if (req.method === 'GET') {
      return res.json(req.path.endsWith('s') || req.path.endsWith('s/') ? [] : {});
    }
    return res.status(503).json({ error: 'Service temporarily unavailable (database offline)' });
  }
  next(err);
});

// =========================================================================
// VITE SPA INTEGRATION & SERVER STARTUP
// =========================================================================

async function startServer() {
  // Asynchronously connect to MongoDB Atlas on startup
  await connectMongoDB();

  const isProduction = process.env.NODE_ENV === 'production';
  const distPath = path.resolve(__dirname, 'dist');

  if (isProduction && fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    // Mount Vite middleware in development (HMR WebSocket disabled to prevent port collisions)
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
    if (isMongoConnected) {
      console.log(`Connected to MongoDB Atlas using collections: users, master_employees, submissions, settings`);
    } else {
      console.log(`Running with local storage. Set MONGODB_URI in environment to connect to MongoDB Atlas.`);
    }
  });
}

startServer();
