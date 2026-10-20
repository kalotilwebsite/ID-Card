import React, { useState, useRef, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Settings,
  Printer,
  Upload,
  RefreshCw,
  Eye,
  Layers,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Sliders,
  Table as TableIcon,
  CheckCircle,
  AlertTriangle,
  Image as ImageIcon,
  Lock,
  LogOut,
  Users,
  Database,
  IdCard,
  UserCheck,
  Shield,
  ShieldAlert,
  Briefcase,
} from 'lucide-react';
import {
  EmployeeCardData,
  ColumnMapping,
  PrintSettings,
  CompanyTemplateConfig,
  CardCalibrationSettings,
  CARD_WIDTH,
  CARD_HEIGHT,
  AuthUser,
  UserRole,
} from './types';
import { SAMPLE_EMPLOYEES, DEFAULT_COMPANY_CONFIG } from './data/sampleEmployees';
import { FRONT_TEMPLATE_SVG, BACK_TEMPLATE_SVG } from './data/cardTemplates';
import { DEFAULT_CALIBRATION } from './types';
import { CardFront } from './components/CardFront';
import { CardBack } from './components/CardBack';
import { DataImportModal } from './components/DataImportModal';
import { ColumnMappingModal } from './components/ColumnMappingModal';
import { PrintSettingsModal, DEFAULT_PRINT_SETTINGS } from './components/PrintSettingsModal';
import { EmployeeTableEditor } from './components/EmployeeTableEditor';
import { ExportModal } from './components/ExportModal';
import { FieldCalibrationModal } from './components/FieldCalibrationModal';
import { DataEntryForm } from './components/DataEntryForm';
import { SupervisorSubmissionForm } from './components/SupervisorSubmissionForm';
import { EmployeeDatabaseSection } from './components/EmployeeDatabaseSection';
import { UserManagementSection } from './components/UserManagementSection';
import { SubmissionsSection } from './components/SubmissionsSection';
import { LoginModal } from './components/LoginModal';
import { apiService, getStoredUser, getStoredToken } from './services/apiService';

type MainNavTab =
  | 'submissions'
  | 'data_entry_form'
  | 'supervisor_submission'
  | 'employee_data'
  | 'user_management'
  | 'card_studio';

export default function App() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getStoredUser());
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Active Main Navigation Tab
  const [activeNavTab, setActiveNavTab] = useState<MainNavTab>('submissions');

  // Main Card Studio data state
  const [employees, setEmployees] = useState<EmployeeCardData[]>(SAMPLE_EMPLOYEES);
  const [selectedEmpIndex, setSelectedEmpIndex] = useState(0);
  const [printSettings, setPrintSettings] = useState<PrintSettings>(DEFAULT_PRINT_SETTINGS);
  const [companyConfig, setCompanyConfig] = useState<CompanyTemplateConfig>(DEFAULT_COMPANY_CONFIG);

  // Template images
  const [frontTemplateUrl, setFrontTemplateUrl] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('id_card_front_template');
      if (saved) return saved;
    } catch (e) {}
    return FRONT_TEMPLATE_SVG;
  });
  const [backTemplateUrl, setBackTemplateUrl] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('id_card_back_template');
      if (saved) return saved;
    } catch (e) {}
    return BACK_TEMPLATE_SVG;
  });

  const handleUploadFrontImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      setFrontTemplateUrl(url);
      try {
        localStorage.setItem('id_card_front_template', url);
      } catch (err) {}
    };
    reader.readAsDataURL(file);
  };

  // Calibration settings
  const [calibration, setCalibration] = useState<CardCalibrationSettings>(() => {
    try {
      const saved = localStorage.getItem('id_card_calibration_settings');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_CALIBRATION;
  });

  // Raw imported data state for mapping in Studio
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [currentSourceName, setCurrentSourceName] = useState<string>('Demo Sample Data');
  const [importWarnings, setImportWarnings] = useState<string[]>([]);

  // Studio UI state
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'table' | 'gallery'>('table');
  const [previewSide, setPreviewSide] = useState<'both' | 'front' | 'back'>('both');
  const [previewZoom, setPreviewZoom] = useState(0.85);

  // Modals
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isCalibrationModalOpen, setIsCalibrationModalOpen] = useState(false);

  // Ref to hidden export container
  const exportRenderRef = useRef<HTMLDivElement>(null);

  // Auto-authenticate on initial mount
  useEffect(() => {
    const initAuth = async () => {
      setIsAuthLoading(true);
      const token = getStoredToken();
      if (token) {
        const user = await apiService.getCurrentUser();
        if (user) {
          setCurrentUser(user);
          if (user.role === 'supervisor') {
            setActiveNavTab('supervisor_submission');
          } else if (user.role === 'data_entry') {
            setActiveNavTab('data_entry_form');
          }
          setIsAuthLoading(false);
          return;
        }
      }

      // Default quick auto-login as admin for instant ready-to-test experience
      try {
        const loginRes = await apiService.login('admin', 'admin123');
        setCurrentUser(loginRes.user);
      } catch (err) {
        console.error('Initial auto-login error:', err);
      } finally {
        setIsAuthLoading(false);
      }
    };

    initAuth();
  }, []);

  // Enforce role-based tab restrictions:
  // Data Entry users can ONLY access data_entry_form
  // Supervisors can ONLY access supervisor_submission
  useEffect(() => {
    if (currentUser?.role === 'data_entry' && activeNavTab !== 'data_entry_form') {
      setActiveNavTab('data_entry_form');
    } else if (currentUser?.role === 'supervisor' && activeNavTab !== 'supervisor_submission') {
      setActiveNavTab('supervisor_submission');
    }
  }, [currentUser, activeNavTab]);

  const handleSwitchAccount = async (targetRole: UserRole) => {
    try {
      setIsAuthLoading(true);
      if (targetRole === 'admin') {
        const res = await apiService.login('admin', 'admin123');
        setCurrentUser(res.user);
        setActiveNavTab('submissions');
      } else if (targetRole === 'supervisor') {
        const res = await apiService.supervisorLogin('SUP-2026-01', 'supervisor123');
        setCurrentUser(res.user);
        setActiveNavTab('supervisor_submission');
      } else {
        const res = await apiService.login('operator1', 'operator123');
        setCurrentUser(res.user);
        setActiveNavTab('data_entry_form');
      }
    } catch (err) {
      console.error('Switch account error:', err);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = () => {
    apiService.logout();
    setCurrentUser(null);
    setIsLoginModalOpen(true);
  };

  const currentEmployee = employees[selectedEmpIndex] || employees[0] || SAMPLE_EMPLOYEES[0];

  const handleDataLoaded = (data: {
    headers: string[];
    rows: Record<string, any>[];
    sourceName: string;
    embeddedImagesCount?: number;
    warnings?: string[];
  }) => {
    setRawHeaders(data.headers);
    setRawRows(data.rows);
    setCurrentSourceName(data.sourceName);
    setImportWarnings(data.warnings || []);
    setIsMappingModalOpen(true);
  };

  const handleConfirmMapping = (mappings: ColumnMapping[]) => {
    const formatCardDate = (val: string, fallback: string): string => {
      if (!val || !val.trim()) return fallback;
      const trimmed = val.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const [y, m, d] = trimmed.split('-');
        return `${d}/${m}/${y}`;
      }
      return trimmed;
    };

    const sourceRows: Record<string, any>[] =
      rawRows.length > 0
        ? rawRows
        : employees.map((emp) => ({
            'Employee Name': emp.name,
            'Designation': emp.designation,
            'Department': emp.department,
            'Job Type': emp.jobType,
            'Join Date': emp.joiningDate,
            'Enroll ID': emp.enrollId,
            'Card Issue Date': emp.cardIssue,
            'Contact Number': emp.emergencyContact,
            'Permanent Address': emp.permanentAddress || 'Mukkhopur, Trishal, Mymensingh',
            'National ID': emp.nationalId,
            'Blood Group': emp.bloodGroup,
            'Employee Photo': emp.photoUrl || '',
            'Employee Signature': emp.signatureUrl || '',
          }));

    const generated: EmployeeCardData[] = sourceRows.map((row, idx) => {
      const getVal = (key: string): string => {
        const m = mappings.find((item) => item.fieldKey === key);
        if (!m) return '';
        const col = m.sourceColumn;
        if (!col) return m.fallbackValue || '';

        // 1. Direct property match
        const raw = row[col];
        if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
          return String(raw).trim();
        }

        // 2. Lookup inside dedicated __cell_images__ object
        if (row.__cell_images__) {
          if (row.__cell_images__[col]) {
            return String(row.__cell_images__[col]).trim();
          }
          const letterMatch = col.match(/(?:Column|Col)?\s*([A-Za-z]+)/i);
          if (letterMatch && letterMatch[1]) {
            const letter = letterMatch[1].toUpperCase();
            if (row.__cell_images__[letter]) {
              return String(row.__cell_images__[letter]).trim();
            }
          }
        }

        // 3. Fallback column letter variants
        const colMatch = col.match(/(?:Column|Col)?\s*([A-Za-z]+)/i);
        if (colMatch && colMatch[1]) {
          const letter = colMatch[1].toUpperCase();
          const variants = [`Column ${letter}`, `Col ${letter}`, letter];
          for (const v of variants) {
            if (row[v] !== undefined && row[v] !== null && String(row[v]).trim() !== '') {
              return String(row[v]).trim();
            }
          }
        }

        return m.fallbackValue || '';
      };

      const name = getVal('name');
      const designation = getVal('designation');
      const department = getVal('department');
      const enrollId = getVal('enrollId');

      // Resolve Photo URL
      let photoUrl = getVal('photoUrl');
      const photoMap = mappings.find((m) => m.fieldKey === 'photoUrl');
      if (!photoMap?.sourceColumn && !photoUrl && row['__embedded_photo__']) {
        photoUrl = row['__embedded_photo__'];
      }

      // Resolve Signature URL
      let signatureUrl = getVal('signatureUrl');
      const sigMap = mappings.find((m) => m.fieldKey === 'signatureUrl');
      if (!sigMap?.sourceColumn && !signatureUrl && row['__embedded_signature__']) {
        signatureUrl = row['__embedded_signature__'];
      }

      const isValid = Boolean(name && designation && department && enrollId);

      return {
        id: `card-${idx + 1}-${Date.now()}`,
        name: name || `EMPLOYEE #${idx + 1}`,
        designation: designation || 'Staff',
        department: department || 'General',
        jobType: getVal('jobType') || 'Permanent',
        joiningDate: formatCardDate(getVal('joiningDate'), '01/03/2026'),
        enrollId: enrollId || String(100000 + idx),
        cardIssue: formatCardDate(getVal('cardIssue'), '19/10/2026'),
        photoUrl: photoUrl || undefined,
        permanentAddress: getVal('permanentAddress') || 'Mukkhopur, Trishal, Mymensingh',
        emergencyContact: getVal('emergencyContact') || '01920-694100',
        nationalId: getVal('nationalId') || '',
        bloodGroup: getVal('bloodGroup') || 'O+',
        signatureUrl: signatureUrl || undefined,
        isValid,
      };
    });

    setEmployees(generated);
    setSelectedEmpIndex(0);
    setActiveNavTab('card_studio');
  };

  const handleLoadSample = () => {
    setEmployees(SAMPLE_EMPLOYEES);
    setSelectedEmpIndex(0);
    setCurrentSourceName('Akij Ceramics & Rosa Certified Sample');
  };

  const getCardElement = (empId: string, side: 'front' | 'back'): HTMLElement | null => {
    return document.getElementById(`export-${side}-${empId}`);
  };

  // Called when Admin selects submitted cards to generate/print
  const handleSendToPrintStudio = (cardData: EmployeeCardData[], openPrintDialog: boolean = false) => {
    setEmployees(cardData);
    setSelectedEmpIndex(0);
    setCurrentSourceName(`Submitted Verified Records (${cardData.length})`);
    setActiveNavTab('card_studio');
    if (openPrintDialog) {
      setTimeout(() => setIsPrintModalOpen(true), 150);
    }
  };

  const isAdmin = currentUser?.role === 'admin';
  const isDataEntry = currentUser?.role === 'data_entry';
  const isSupervisor = currentUser?.role === 'supervisor';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Top Application Bar */}
      <header className="bg-slate-950/95 border-b border-slate-800 backdrop-blur sticky top-0 z-30 px-4 py-2 flex flex-wrap items-center justify-between gap-3 shadow-md">
        {/* Brand and Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 to-rose-400 flex items-center justify-center text-white shadow-md shadow-rose-900/40">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-black tracking-tight text-white">
                Bulk Employee ID Card Generator
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                EXACT REFERENCE TEMPLATES
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Akij Ceramics &amp; Rosa Sanitary Ware Bangladesh
            </p>
          </div>
        </div>

        {/* User Account & Quick Role Switch Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {currentUser ? (
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
              <div className="flex flex-col text-right">
                <span className="text-xs font-bold text-white">{currentUser.name}</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {currentUser.employeeId ? `Emp ID: ${currentUser.employeeId}` : `@${currentUser.username}`}
                </span>
              </div>

              {isAdmin ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-rose-400" /> Admin
                </span>
              ) : isSupervisor ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                  <Briefcase className="w-3 h-3 text-purple-400" /> Supervisor
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-sky-400" /> Data Entry
                </span>
              )}

              {/* Role Switcher Pill Buttons for fast verification */}
              <div className="h-5 w-[1px] bg-slate-800 mx-1" />
              <div className="flex items-center gap-1">
                {currentUser.role !== 'admin' && (
                  <button
                    type="button"
                    onClick={() => handleSwitchAccount('admin')}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-rose-300 text-[10px] font-semibold rounded-lg transition-colors"
                    title="Switch to Administrator view"
                  >
                    Admin
                  </button>
                )}
                {currentUser.role !== 'supervisor' && (
                  <button
                    type="button"
                    onClick={() => handleSwitchAccount('supervisor')}
                    className="px-2 py-1 bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border border-purple-800/40 text-[10px] font-semibold rounded-lg transition-colors"
                    title="Switch to Supervisor view (Employee ID: SUP-2026-01)"
                  >
                    Supervisor
                  </button>
                )}
                {currentUser.role !== 'data_entry' && (
                  <button
                    type="button"
                    onClick={() => handleSwitchAccount('data_entry')}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 text-[10px] font-semibold rounded-lg transition-colors"
                    title="Switch to Data Entry Operator view"
                  >
                    Operator
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsLoginModalOpen(true)}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </header>

      {/* Primary Role-Aware Navigation Bar */}
      <nav className="bg-slate-950 border-b border-slate-800 px-4 flex items-center justify-between overflow-x-auto shadow-inner">
        <div className="flex items-center gap-1 sm:gap-2">
          {/* 1. Admin-Only: Data Entry (Submissions Table & Printing) */}
          {isAdmin && (
            <button
              onClick={() => setActiveNavTab('submissions')}
              className={`flex items-center gap-2 px-3.5 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                activeNavTab === 'submissions'
                  ? 'border-rose-500 text-white bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
              }`}
            >
              <TableIcon className="w-4 h-4 text-rose-500" />
              <span>Data Entry (Printing)</span>
            </button>
          )}

          {/* 2. Dedicated Supervisor ID Card Submission (Supervisors and Admin) */}
          {(isSupervisor || isAdmin) && (
            <button
              onClick={() => setActiveNavTab('supervisor_submission')}
              className={`flex items-center gap-2 px-3.5 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                activeNavTab === 'supervisor_submission'
                  ? 'border-purple-500 text-white bg-purple-950/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
              }`}
            >
              <Briefcase className="w-4 h-4 text-purple-400" />
              <span>Supervisor Submission</span>
              {isSupervisor && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300">
                  Supervisor Portal
                </span>
              )}
            </button>
          )}

          {/* 3. Data Entry Form (Authorized Operators & Admin) */}
          {(isDataEntry || isAdmin) && (
            <button
              onClick={() => setActiveNavTab('data_entry_form')}
              className={`flex items-center gap-2 px-3.5 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                activeNavTab === 'data_entry_form'
                  ? 'border-rose-500 text-white bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
              }`}
            >
              <IdCard className="w-4 h-4 text-rose-500" />
              <span>Data Entry Form</span>
              {isDataEntry && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-500/20 text-sky-300">
                  Active Role
                </span>
              )}
            </button>
          )}

          {/* 4. Admin-Only: Employee Data (Master Database) */}
          {isAdmin && (
            <button
              onClick={() => setActiveNavTab('employee_data')}
              className={`flex items-center gap-2 px-3.5 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                activeNavTab === 'employee_data'
                  ? 'border-rose-500 text-white bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
              }`}
            >
              <Database className="w-4 h-4 text-rose-500" />
              <span>Employee Data</span>
            </button>
          )}

          {/* 5. Admin-Only: User Management */}
          {isAdmin && (
            <button
              onClick={() => setActiveNavTab('user_management')}
              className={`flex items-center gap-2 px-3.5 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                activeNavTab === 'user_management'
                  ? 'border-rose-500 text-white bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
              }`}
            >
              <Users className="w-4 h-4 text-rose-500" />
              <span>User Management</span>
            </button>
          )}

          {/* 6. Admin-Only: Card Studio & Designer */}
          {isAdmin && (
            <button
              onClick={() => setActiveNavTab('card_studio')}
              className={`flex items-center gap-2 px-3.5 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                activeNavTab === 'card_studio'
                  ? 'border-rose-500 text-white bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
              }`}
            >
              <Layers className="w-4 h-4 text-rose-500" />
              <span>Card Studio &amp; Designer</span>
            </button>
          )}
        </div>

        {/* Right Info Note */}
        {isSupervisor && (
          <div className="text-[11px] text-purple-300 font-medium flex items-center gap-1.5 py-2">
            <Briefcase className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span className="hidden sm:inline">Role restriction active:</span> Supervisor Submission Access Only
          </div>
        )}
        {isDataEntry && (
          <div className="text-[11px] text-amber-300/90 font-medium flex items-center gap-1.5 py-2">
            <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="hidden sm:inline">Role restriction active:</span> Data Entry Operator access
          </div>
        )}
      </nav>

      {/* Main Content Area Based on Active Section */}
      <main className="flex-1 flex flex-col overflow-auto">
        {isAuthLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 gap-3">
            <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-medium text-slate-300">Verifying session credentials...</span>
          </div>
        ) : (
          <>
            {/* SECTION 1: Admin Data Entry & Printing (Submitted Records Table, Filtering & Bulk Printing) */}
            {isAdmin && activeNavTab === 'submissions' && (
              <SubmissionsSection
                frontTemplateUrl={frontTemplateUrl}
                backTemplateUrl={backTemplateUrl}
                onSendToPrintStudio={handleSendToPrintStudio}
              />
            )}

        {/* SECTION 2: Dedicated Supervisor Submission Form */}
        {(isSupervisor || (isAdmin && activeNavTab === 'supervisor_submission')) && activeNavTab === 'supervisor_submission' && (
          <SupervisorSubmissionForm
            currentUser={currentUser}
            frontTemplateUrl={frontTemplateUrl}
            backTemplateUrl={backTemplateUrl}
            onSubmissionSuccess={() => {
              // optional callback
            }}
          />
        )}

        {/* SECTION 3: Dedicated Data Entry Form (Enrollment ID lookup, 3 fields, passport framing guide, duplicate protection) */}
        {(isDataEntry || (isAdmin && activeNavTab === 'data_entry_form')) && activeNavTab === 'data_entry_form' && (
          <DataEntryForm
            frontTemplateUrl={frontTemplateUrl}
            backTemplateUrl={backTemplateUrl}
            onSubmissionSuccess={() => {
              // optional callback
            }}
          />
        )}

        {/* SECTION 4: Admin-Only Employee Database (Master Excel import & Enrollment ID keying) */}
        {isAdmin && activeNavTab === 'employee_data' && (
          <EmployeeDatabaseSection />
        )}

        {/* SECTION 4: Admin-Only User Management (Create & manage authorized accounts) */}
        {isAdmin && activeNavTab === 'user_management' && (
          <UserManagementSection />
        )}

        {/* SECTION 5: Admin-Only Card Studio & Designer (Full Original Card Studio with Calibration & Export) */}
        {isAdmin && activeNavTab === 'card_studio' && (
          <div className="flex-1 flex flex-col">
            {/* Card Studio Subheader Toolbar */}
            <div className="bg-slate-950/80 border-b border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-slate-300">
                Active Studio Set:{' '}
                <span className="text-rose-400 font-bold">{currentSourceName}</span> (
                {employees.length} cards loaded)
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import Data</span>
                </button>

                <button
                  onClick={() => setIsMappingModalOpen(true)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all border border-slate-700 flex items-center gap-1.5"
                  title="Configure column mapping"
                >
                  <Settings className="w-3.5 h-3.5 text-rose-400" />
                  <span>Map Columns</span>
                </button>

                <button
                  onClick={() => setIsCalibrationModalOpen(true)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all border border-slate-700 flex items-center gap-1.5"
                  title="Calibrate field positions"
                >
                  <Sliders className="w-3.5 h-3.5 text-rose-400" />
                  <span>Field Calibration</span>
                </button>

                <label
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all border border-slate-700 flex items-center gap-1.5 cursor-pointer"
                  title="Upload custom Front Reference image"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Front Ref</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleUploadFrontImage(e.target.files[0]);
                      }
                    }}
                  />
                </label>

                <button
                  onClick={() => setIsPrintModalOpen(true)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all border border-slate-700 flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Layout</span>
                </button>

                <button
                  onClick={() => setIsExportModalOpen(true)}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export (PDF &amp; Word)</span>
                </button>

                <button
                  onClick={handleLoadSample}
                  title="Reset to default sample"
                  className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition-colors border border-slate-700"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Main Workspace: Left (Table/Gallery) & Right (Card Preview) */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
              {/* Left Section: Tabs and Controls */}
              <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-900/50 overflow-hidden">
                {/* Workspace Tabs Header */}
                <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/40 px-4 pt-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveWorkspaceTab('table')}
                      className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-t-lg transition-colors border-b-2 ${
                        activeWorkspaceTab === 'table'
                          ? 'border-rose-500 text-white bg-slate-800/60'
                          : 'border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <TableIcon className="w-3.5 h-3.5" />
                      Employee Table &amp; Validation ({employees.length})
                    </button>

                    <button
                      onClick={() => setActiveWorkspaceTab('gallery')}
                      className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-t-lg transition-colors border-b-2 ${
                        activeWorkspaceTab === 'gallery'
                          ? 'border-rose-500 text-white bg-slate-800/60'
                          : 'border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      All Cards Gallery
                    </button>
                  </div>

                  <div className="pb-1 text-[11px] text-slate-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Original Templates Active
                  </div>
                </div>

                {/* Tab 1: Table & Validation */}
                {activeWorkspaceTab === 'table' && (
                  <div className="flex-1 p-4 overflow-y-auto">
                    <EmployeeTableEditor
                      employees={employees}
                      onUpdateEmployees={setEmployees}
                      selectedEmployeeId={currentEmployee.id}
                      onSelectEmployeeForPreview={(id) => {
                        const idx = employees.findIndex((e) => e.id === id);
                        if (idx !== -1) setSelectedEmpIndex(idx);
                      }}
                    />
                  </div>
                )}

                {/* Tab 2: Gallery Grid */}
                {activeWorkspaceTab === 'gallery' && (
                  <div className="flex-1 p-6 overflow-y-auto">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-white">Generated ID Card Gallery</h3>
                        <p className="text-xs text-slate-400">
                          Showing {employees.length} front and back cards rendered over the exact reference templates
                        </p>
                      </div>
                      <div className="text-xs text-slate-400">Click any card to inspect</div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {employees.map((emp, index) => (
                        <div
                          key={emp.id}
                          onClick={() => setSelectedEmpIndex(index)}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                            index === selectedEmpIndex
                              ? 'border-rose-500 bg-slate-800/80 shadow-lg shadow-rose-950/20 ring-1 ring-rose-500'
                              : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3 text-xs">
                            <span className="font-bold text-white truncate max-w-[150px]">
                              {emp.name}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                              {emp.enrollId}
                            </span>
                          </div>

                          <div className="flex justify-center gap-3 overflow-hidden py-2">
                            <div className="transform scale-[0.45] origin-top -mb-64">
                              <CardFront
                                employee={emp}
                                templateUrl={frontTemplateUrl}
                                calibration={calibration.front}
                                scale={1}
                              />
                            </div>
                            <div className="transform scale-[0.45] origin-top -mb-64">
                              <CardBack
                                employee={emp}
                                templateUrl={backTemplateUrl}
                                calibration={calibration.back}
                                scale={1}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Section: Real-Time Precision Card Inspector & Preview */}
              <div className="w-full lg:w-[480px] xl:w-[540px] bg-slate-950 border-l border-slate-800 p-4 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-4">
                  {/* Card Navigation & Selection */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Inspecting Card {selectedEmpIndex + 1} of {employees.length}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSelectedEmpIndex((prev) => Math.max(0, prev - 1))}
                        disabled={selectedEmpIndex === 0}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg text-slate-200 transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          setSelectedEmpIndex((prev) => Math.min(employees.length - 1, prev + 1))
                        }
                        disabled={selectedEmpIndex === employees.length - 1}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg text-slate-200 transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Preview Side Switcher & Zoom */}
                  <div className="flex items-center justify-between bg-slate-900 p-1.5 rounded-xl border border-slate-800">
                    <div className="flex gap-1">
                      <button
                        onClick={() => setPreviewSide('both')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          previewSide === 'both'
                            ? 'bg-rose-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Both Sides
                      </button>
                      <button
                        onClick={() => setPreviewSide('front')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          previewSide === 'front'
                            ? 'bg-rose-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Front Only
                      </button>
                      <button
                        onClick={() => setPreviewSide('back')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          previewSide === 'back'
                            ? 'bg-rose-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Back Only
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 pr-1">
                      <button
                        onClick={() => setPreviewZoom((z) => Math.max(0.5, z - 0.1))}
                        className="p-1 text-slate-400 hover:text-white"
                        title="Zoom out"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[11px] font-mono text-slate-300 w-10 text-center">
                        {Math.round(previewZoom * 100)}%
                      </span>
                      <button
                        onClick={() => setPreviewZoom((z) => Math.min(1.4, z + 0.1))}
                        className="p-1 text-slate-400 hover:text-white"
                        title="Zoom in"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Rendered Live Cards */}
                  <div className="flex flex-col items-center justify-center gap-6 py-4 min-h-[460px]">
                    {(previewSide === 'both' || previewSide === 'front') && (
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                          Front Side (Official)
                        </span>
                        <div
                          style={{
                            width: CARD_WIDTH * previewZoom,
                            height: CARD_HEIGHT * previewZoom,
                          }}
                          className="relative transition-all"
                        >
                          <CardFront
                            employee={currentEmployee}
                            templateUrl={frontTemplateUrl}
                            calibration={calibration.front}
                            scale={previewZoom}
                          />
                        </div>
                      </div>
                    )}

                    {(previewSide === 'both' || previewSide === 'back') && (
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                          Back Side (Emergency &amp; Blood Group)
                        </span>
                        <div
                          style={{
                            width: CARD_WIDTH * previewZoom,
                            height: CARD_HEIGHT * previewZoom,
                          }}
                          className="relative transition-all"
                        >
                          <CardBack
                            employee={currentEmployee}
                            templateUrl={backTemplateUrl}
                            calibration={calibration.back}
                            scale={previewZoom}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Card Status & Export Action */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-400">
                    {currentEmployee.isValid ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Valid &amp; Ready
                      </span>
                    ) : (
                      <span className="text-rose-400 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Missing required fields
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => setIsExportModalOpen(true)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow transition-colors flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export All ({employees.length})</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
          </>
        )}
      </main>

      {/* Offscreen Container for Export Rendering */}
      <div
        ref={exportRenderRef}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          zIndex: -9999,
          pointerEvents: 'none',
          opacity: 1,
        }}
        aria-hidden="true"
      >
        {employees.map((emp) => (
          <div key={emp.id} className="flex">
            <CardFront
              id={`export-front-${emp.id}`}
              employee={emp}
              templateUrl={frontTemplateUrl}
              calibration={calibration.front}
              scale={1}
            />
            <CardBack
              id={`export-back-${emp.id}`}
              employee={emp}
              templateUrl={backTemplateUrl}
              calibration={calibration.back}
              scale={1}
            />
          </div>
        ))}
      </div>

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          if (user.role === 'supervisor') {
            setActiveNavTab('supervisor_submission');
          } else if (user.role === 'data_entry') {
            setActiveNavTab('data_entry_form');
          } else {
            setActiveNavTab('submissions');
          }
          setIsLoginModalOpen(false);
        }}
      />

      {/* Studio Modals */}
      <DataImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onDataLoaded={handleDataLoaded}
        onLoadSample={handleLoadSample}
      />

      {(() => {
        const effectiveHeaders =
          rawHeaders.length > 0
            ? rawHeaders
            : [
                'Employee Name',
                'Designation',
                'Department',
                'Job Type',
                'Join Date',
                'Enroll ID',
                'Card Issue Date',
                'Contact Number',
                'Permanent Address',
                'National ID',
                'Blood Group',
                'Employee Photo',
                'Employee Signature',
              ];

        const effectiveRows =
          rawRows.length > 0
            ? rawRows
            : employees.map((emp) => ({
                'Employee Name': emp.name,
                'Designation': emp.designation,
                'Department': emp.department,
                'Job Type': emp.jobType,
                'Join Date': emp.joiningDate,
                'Enroll ID': emp.enrollId,
                'Card Issue Date': emp.cardIssue,
                'Contact Number': emp.emergencyContact,
                'Permanent Address': emp.permanentAddress || 'Mukkhopur, Trishal, Mymensingh',
                'National ID': emp.nationalId,
                'Blood Group': emp.bloodGroup,
                'Employee Photo': emp.photoUrl || '',
                'Employee Signature': emp.signatureUrl || '',
              }));

        return (
          <ColumnMappingModal
            isOpen={isMappingModalOpen}
            onClose={() => setIsMappingModalOpen(false)}
            headers={effectiveHeaders}
            sampleRows={effectiveRows}
            sourceName={currentSourceName}
            warnings={importWarnings}
            onConfirmMapping={handleConfirmMapping}
          />
        );
      })()}

      <FieldCalibrationModal
        isOpen={isCalibrationModalOpen}
        onClose={() => setIsCalibrationModalOpen(false)}
        calibration={calibration}
        onChangeCalibration={setCalibration}
        frontTemplateUrl={frontTemplateUrl}
        backTemplateUrl={backTemplateUrl}
        onUpdateFrontTemplate={setFrontTemplateUrl}
        onUpdateBackTemplate={setBackTemplateUrl}
        onResetTemplates={() => {
          setFrontTemplateUrl(FRONT_TEMPLATE_SVG);
          setBackTemplateUrl(BACK_TEMPLATE_SVG);
        }}
      />

      <PrintSettingsModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        settings={printSettings}
        onChangeSettings={setPrintSettings}
        totalCardsCount={employees.length}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        employees={employees}
        settings={printSettings}
        companyConfig={companyConfig}
        getCardElement={getCardElement}
      />
    </div>
  );
}
