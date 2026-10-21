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
import { AdminSettingsModal } from './components/AdminSettingsModal';
import {
  apiService,
  getStoredUser,
  getStoredToken,
  setStoredToken,
  setStoredUser,
  subscribeToUnauthorized,
} from './services/apiService';

type MainNavTab =
  | 'submissions'
  | 'data_entry_form'
  | 'supervisor_submission'
  | 'employee_data'
  | 'user_management'
  | 'card_studio';

export default function App() {
  // Authentication State: only initialize if both token and user profile exist
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    const token = getStoredToken();
    if (!token) return null;
    return getStoredUser();
  });
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isAdminSettingsOpen, setIsAdminSettingsOpen] = useState(false);

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
    let isMounted = true;

    const initAuth = async () => {
      setIsAuthLoading(true);
      const token = getStoredToken();
      if (token) {
        try {
          const user = await apiService.getCurrentUser();
          if (isMounted) {
            if (user) {
              setCurrentUser(user);
              if (user.role === 'supervisor') {
                setActiveNavTab('supervisor_submission');
              } else if (user.role === 'data_entry') {
                setActiveNavTab('data_entry_form');
              }
            } else {
              setCurrentUser(null);
            }
          }
        } catch {
          if (isMounted) {
            setCurrentUser(null);
          }
        }
      } else {
        if (isMounted) {
          setCurrentUser(null);
        }
      }

      // Sync saved print layout settings
      try {
        const settings = await apiService.getPublicSettings();
        if (isMounted && settings) {
          setPrintSettings((prev) => {
            const updated = { ...prev };
            if (settings.pdfPrintLayout === 'top_bottom') {
              updated.layoutMode = 'top-and-bottom';
            } else if (settings.pdfPrintLayout === 'side_by_side') {
              updated.layoutMode = 'side-by-side';
            }
            if (settings.paperSize) {
              updated.paperSize = settings.paperSize as any;
            }
            if (settings.cardsPerPage) {
              const cpp = Number(settings.cardsPerPage);
              if (cpp === 4) {
                updated.columnsPerPage = 2;
                updated.rowsPerPage = 2;
              } else if (cpp === 6) {
                updated.columnsPerPage = 3;
                updated.rowsPerPage = 2;
              } else if (cpp === 8) {
                updated.columnsPerPage = 4;
                updated.rowsPerPage = 2;
              } else if (cpp === 10) {
                updated.columnsPerPage = 5;
                updated.rowsPerPage = 2;
              } else {
                updated.columnsPerPage = 3;
                updated.rowsPerPage = 3;
              }
            }
            return updated;
          });
        }
      } catch (e) {}

      if (isMounted) {
        setIsAuthLoading(false);
      }
    };

    initAuth();

    // Subscribe to unauthorized session expirations
    const unsubscribe = subscribeToUnauthorized(() => {
      if (isMounted) {
        setCurrentUser(null);
        setIsLoginModalOpen(true);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
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

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginModal
        isOpen={true}
        forced={true}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          if (user.role === 'supervisor') {
            setActiveNavTab('supervisor_submission');
          } else if (user.role === 'data_entry') {
            setActiveNavTab('data_entry_form');
          } else {
            setActiveNavTab('submissions');
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      {/* Top Application Bar - Clean White Professional Header */}
      <header className="bg-white border-b border-slate-200 backdrop-blur sticky top-0 z-30 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        {/* Brand and Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xs">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
              Bulk Employee ID Card Generator
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">
              Employee ID Card Management &amp; Printing
            </p>
          </div>
        </div>

        {/* User Account, Settings & Authentication Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {currentUser && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              <div className="flex flex-col text-right">
                <span className="text-xs font-bold text-slate-900">{currentUser.name}</span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {currentUser.employeeId ? `Emp ID: ${currentUser.employeeId}` : `@${currentUser.username}`}
                </span>
              </div>

              {isAdmin ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 text-white flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Admin
                </span>
              ) : isSupervisor ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-white flex items-center gap-1">
                  <Briefcase className="w-3 h-3" /> Supervisor
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-white flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Data Entry
                </span>
              )}

              {/* Admin-only System Settings Button */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setIsAdminSettingsOpen(true)}
                  className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg transition-colors flex items-center gap-1"
                  title="Configure Admin Settings"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Settings</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleLogout}
                className="p-1 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors ml-1"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Primary Role-Aware Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 px-4 flex items-center justify-between overflow-x-auto shadow-2xs">
        <div className="flex items-center gap-1 sm:gap-2">
          {/* SUPERVISOR ROLE: Strictly ONE menu only: Data Entry → Add New Employee ID Card */}
          {isSupervisor && (
            <button
              onClick={() => setActiveNavTab('supervisor_submission')}
              className="flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 border-purple-600 text-purple-700 bg-purple-50/60 transition-all whitespace-nowrap"
            >
              <IdCard className="w-4 h-4 text-purple-600" />
              <span>Data Entry → Add New Employee ID Card</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-200/70 text-purple-800">
                Supervisor
              </span>
            </button>
          )}

          {/* ADMIN ONLY MENUS */}
          {isAdmin && (
            <>
              {/* 1. Admin: Data Entry (Printing & Submission Queue) */}
              <button
                onClick={() => setActiveNavTab('submissions')}
                className={`flex items-center gap-2 px-3.5 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                  activeNavTab === 'submissions'
                    ? 'border-rose-600 text-rose-700 bg-rose-50/60'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <TableIcon className="w-4 h-4 text-rose-600" />
                <span>Data Entry (Printing Queue)</span>
              </button>

              {/* 2. Admin: Supervisor Submission Portal view */}
              <button
                onClick={() => setActiveNavTab('supervisor_submission')}
                className={`flex items-center gap-2 px-3.5 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                  activeNavTab === 'supervisor_submission'
                    ? 'border-purple-600 text-purple-700 bg-purple-50/60'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Briefcase className="w-4 h-4 text-purple-600" />
                <span>Data Entry → Add New Employee ID Card</span>
              </button>

              {/* 3. Admin: Data Entry Form */}
              <button
                onClick={() => setActiveNavTab('data_entry_form')}
                className={`flex items-center gap-2 px-3.5 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                  activeNavTab === 'data_entry_form'
                    ? 'border-rose-600 text-rose-700 bg-rose-50/60'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <IdCard className="w-4 h-4 text-rose-600" />
                <span>Direct Data Entry</span>
              </button>

              {/* 4. Admin: Employee Data (Master Database) */}
              <button
                onClick={() => setActiveNavTab('employee_data')}
                className={`flex items-center gap-2 px-3.5 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                  activeNavTab === 'employee_data'
                    ? 'border-rose-600 text-rose-700 bg-rose-50/60'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Database className="w-4 h-4 text-rose-600" />
                <span>Master Employee Database</span>
              </button>

              {/* 5. Admin: User Management */}
              <button
                onClick={() => setActiveNavTab('user_management')}
                className={`flex items-center gap-2 px-3.5 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                  activeNavTab === 'user_management'
                    ? 'border-rose-600 text-rose-700 bg-rose-50/60'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Users className="w-4 h-4 text-rose-600" />
                <span>User Management</span>
              </button>

              {/* 6. Admin: Card Studio & Designer */}
              <button
                onClick={() => setActiveNavTab('card_studio')}
                className={`flex items-center gap-2 px-3.5 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                  activeNavTab === 'card_studio'
                    ? 'border-rose-600 text-rose-700 bg-rose-50/60'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Layers className="w-4 h-4 text-rose-600" />
                <span>Card Studio &amp; Designer</span>
              </button>
            </>
          )}

          {/* DATA ENTRY OPERATOR ROLE */}
          {isDataEntry && (
            <button
              onClick={() => setActiveNavTab('data_entry_form')}
              className="flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 border-sky-600 text-sky-700 bg-sky-50/60 transition-all whitespace-nowrap"
            >
              <IdCard className="w-4 h-4 text-sky-600" />
              <span>Data Entry Form</span>
            </button>
          )}
        </div>

        {/* Right Info Note */}
        {isSupervisor && (
          <div className="text-[11px] text-purple-700 font-medium flex items-center gap-1.5 py-2">
            <Briefcase className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <span className="hidden sm:inline">Supervisor Portal Active:</span> Add New Employee ID Card Only
          </div>
        )}
      </nav>

      {/* Main Content Area Based on Active Section */}
      <main className="flex-1 flex flex-col overflow-auto bg-slate-50">
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
                currentUser={currentUser}
              />
            )}

        {/* SECTION 2: Dedicated Supervisor Submission Form (Strictly No Card Preview) */}
        {(isSupervisor || (isAdmin && activeNavTab === 'supervisor_submission')) && activeNavTab === 'supervisor_submission' && (
          <SupervisorSubmissionForm
            currentUser={currentUser}
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
            <div className="bg-white border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
              <div className="text-xs text-slate-600 font-medium">
                Active Studio Set:{' '}
                <span className="text-rose-600 font-bold">{currentSourceName}</span> (
                {employees.length} cards loaded)
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import Data</span>
                </button>

                <button
                  onClick={() => setIsMappingModalOpen(true)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-all border border-slate-200 flex items-center gap-1.5"
                  title="Configure column mapping"
                >
                  <Settings className="w-3.5 h-3.5 text-rose-600" />
                  <span>Map Columns</span>
                </button>

                <button
                  onClick={() => setIsCalibrationModalOpen(true)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-all border border-slate-200 flex items-center gap-1.5"
                  title="Calibrate field positions"
                >
                  <Sliders className="w-3.5 h-3.5 text-rose-600" />
                  <span>Field Calibration</span>
                </button>

                <label
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-all border border-slate-200 flex items-center gap-1.5 cursor-pointer"
                  title="Upload custom Front Reference image"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
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
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-all border border-slate-200 flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Layout</span>
                </button>

                <button
                  onClick={() => setIsExportModalOpen(true)}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export (PDF &amp; Word)</span>
                </button>

                <button
                  onClick={handleLoadSample}
                  title="Reset to default sample"
                  className="p-1.5 bg-white hover:bg-slate-50 text-slate-600 rounded-xl text-xs transition-colors border border-slate-200"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Main Workspace: Left (Table/Gallery) & Right (Card Preview) */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-white">
              {/* Left Section: Tabs and Controls */}
              <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-200 bg-white overflow-hidden">
                {/* Workspace Tabs Header */}
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 pt-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveWorkspaceTab('table')}
                      className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-t-lg transition-colors border-b-2 ${
                        activeWorkspaceTab === 'table'
                          ? 'border-rose-600 text-rose-700 bg-white shadow-2xs'
                          : 'border-transparent text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <TableIcon className="w-3.5 h-3.5" />
                      Employee Table &amp; Validation ({employees.length})
                    </button>

                    <button
                      onClick={() => setActiveWorkspaceTab('gallery')}
                      className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-t-lg transition-colors border-b-2 ${
                        activeWorkspaceTab === 'gallery'
                          ? 'border-rose-600 text-rose-700 bg-white shadow-2xs'
                          : 'border-transparent text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      All Cards Gallery
                    </button>
                  </div>

                  <div className="pb-1 text-[11px] text-slate-500 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Original Templates Active
                  </div>
                </div>

                {/* Tab 1: Table & Validation */}
                {activeWorkspaceTab === 'table' && (
                  <div className="flex-1 p-4 overflow-y-auto bg-slate-50/50">
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
                  <div className="flex-1 p-6 overflow-y-auto bg-slate-50/50">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Generated ID Card Gallery</h3>
                        <p className="text-xs text-slate-500">
                          Showing {employees.length} front and back cards rendered over the exact reference templates
                        </p>
                      </div>
                      <div className="text-xs text-slate-500 font-medium">Click any card to inspect</div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {employees.map((emp, index) => (
                        <div
                          key={emp.id}
                          onClick={() => setSelectedEmpIndex(index)}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                            index === selectedEmpIndex
                              ? 'border-rose-500 bg-rose-50/30 shadow-md ring-1 ring-rose-500'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3 text-xs">
                            <span className="font-bold text-slate-900 truncate max-w-[150px]">
                              {emp.name}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-200">
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
              <div className="w-full lg:w-[480px] xl:w-[540px] bg-slate-50 border-l border-slate-200 p-4 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-4">
                  {/* Card Navigation & Selection */}
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Inspecting Card {selectedEmpIndex + 1} of {employees.length}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSelectedEmpIndex((prev) => Math.max(0, prev - 1))}
                        disabled={selectedEmpIndex === 0}
                        className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 disabled:opacity-40 rounded-lg text-slate-700 transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          setSelectedEmpIndex((prev) => Math.min(employees.length - 1, prev + 1))
                        }
                        disabled={selectedEmpIndex === employees.length - 1}
                        className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 disabled:opacity-40 rounded-lg text-slate-700 transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Preview Side Switcher & Zoom */}
                  <div className="flex items-center justify-between bg-white p-1.5 rounded-xl border border-slate-200 shadow-2xs">
                    <div className="flex gap-1">
                      <button
                        onClick={() => setPreviewSide('both')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          previewSide === 'both'
                            ? 'bg-rose-600 text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Both Sides
                      </button>
                      <button
                        onClick={() => setPreviewSide('front')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          previewSide === 'front'
                            ? 'bg-rose-600 text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Front Only
                      </button>
                      <button
                        onClick={() => setPreviewSide('back')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          previewSide === 'back'
                            ? 'bg-rose-600 text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Back Only
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 pr-1">
                      <button
                        onClick={() => setPreviewZoom((z) => Math.max(0.5, z - 0.1))}
                        className="p-1 text-slate-500 hover:text-slate-900"
                        title="Zoom out"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[11px] font-mono font-bold text-slate-700 w-10 text-center">
                        {Math.round(previewZoom * 100)}%
                      </span>
                      <button
                        onClick={() => setPreviewZoom((z) => Math.min(1.4, z + 0.1))}
                        className="p-1 text-slate-500 hover:text-slate-900"
                        title="Zoom in"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Rendered Live Cards on clean backdrop */}
                  <div className="flex flex-col items-center justify-center gap-6 py-4 min-h-[460px] bg-slate-100/70 border border-slate-200/80 rounded-2xl p-4">
                    {(previewSide === 'both' || previewSide === 'front') && (
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                          Front Side (Official)
                        </span>
                        <div
                          style={{
                            width: CARD_WIDTH * previewZoom,
                            height: CARD_HEIGHT * previewZoom,
                          }}
                          className="relative transition-all shadow-md rounded-2xl overflow-hidden"
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
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                          Back Side (Emergency &amp; Blood Group)
                        </span>
                        <div
                          style={{
                            width: CARD_WIDTH * previewZoom,
                            height: CARD_HEIGHT * previewZoom,
                          }}
                          className="relative transition-all shadow-md rounded-2xl overflow-hidden"
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
                <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-600">
                    {currentEmployee.isValid ? (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Valid &amp; Ready
                      </span>
                    ) : (
                      <span className="text-rose-700 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Missing required fields
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => setIsExportModalOpen(true)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
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

      {/* Admin Settings Modal */}
      <AdminSettingsModal
        isOpen={isAdminSettingsOpen}
        onClose={() => setIsAdminSettingsOpen(false)}
        onSettingsSaved={(newSettings) => {
          setPrintSettings((prev) => {
            const updated = { ...prev };
            if (newSettings.pdfPrintLayout === 'top_bottom') {
              updated.layoutMode = 'top-and-bottom';
            } else {
              updated.layoutMode = 'side-by-side';
            }
            if (newSettings.paperSize) {
              updated.paperSize = newSettings.paperSize as any;
            }
            if (newSettings.cardsPerPage) {
              const cpp = Number(newSettings.cardsPerPage);
              if (cpp === 4) {
                updated.columnsPerPage = 2;
                updated.rowsPerPage = 2;
              } else if (cpp === 6) {
                updated.columnsPerPage = 3;
                updated.rowsPerPage = 2;
              } else if (cpp === 8) {
                updated.columnsPerPage = 4;
                updated.rowsPerPage = 2;
              } else if (cpp === 10) {
                updated.columnsPerPage = 5;
                updated.rowsPerPage = 2;
              } else {
                updated.columnsPerPage = 3;
                updated.rowsPerPage = 3;
              }
            }
            return updated;
          });
        }}
      />
    </div>
  );
}
