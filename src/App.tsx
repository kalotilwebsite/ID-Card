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
  Copy,
  Check,
  Loader2,
  Clock,
  FileDown,
  AlertCircle,
} from 'lucide-react';
import { copyCardSideBySideToClipboard } from './services/cardImageCopyService';
import { generateBulkCardsPdf, downloadBlob } from './services/bulkPdfDownloadService';
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
  const [isAdminSettingsOpen, setIsAdminSettingsOpen] = useState(false);
  const [loginBackgroundImage, setLoginBackgroundImage] = useState<string>(() => {
    try {
      return localStorage.getItem('id_card_login_bg') || '';
    } catch {
      return '';
    }
  });

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

  // Single card copy state (combines front and back side-by-side for Word)
  const [copyingCardId, setCopyingCardId] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<{
    id: string;
    status: 'copied' | 'downloaded';
    message: string;
  } | null>(null);

  // Bulk PDF download state (up to 18 cards, 6 cards per landscape page, max 3 pages)
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(() => {
    return new Set(SAMPLE_EMPLOYEES.map((e) => e.id));
  });
  const [isBulkPdfGenerating, setIsBulkPdfGenerating] = useState(false);
  const [bulkPdfProgress, setBulkPdfProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });
  const [bulkPdfFeedback, setBulkPdfFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

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
            const allowed = Array.isArray(user.allowedTabs) && user.allowedTabs.length > 0
              ? (user.allowedTabs as MainNavTab[])
              : ['data_entry_form'];
            setActiveNavTab((allowed[0] || 'data_entry_form') as MainNavTab);
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

  // Fetch public settings for login background image on boot
  useEffect(() => {
    apiService
      .getPublicSettings()
      .then((settings) => {
        if (settings?.loginBackgroundImage !== undefined) {
          setLoginBackgroundImage(settings.loginBackgroundImage || '');
          try {
            if (settings.loginBackgroundImage) {
              localStorage.setItem('id_card_login_bg', settings.loginBackgroundImage);
            } else {
              localStorage.removeItem('id_card_login_bg');
            }
          } catch {}
        }
      })
      .catch((err) => {
        console.warn('Could not fetch public settings on start:', err);
      });
  }, []);

  // Helper to verify if current authenticated user has access to a specific tab
  const canAccessTab = (tabId: MainNavTab): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    if (currentUser.role === 'supervisor') return tabId === 'supervisor_submission';
    if (currentUser.role === 'data_entry') {
      const allowed = Array.isArray(currentUser.allowedTabs) && currentUser.allowedTabs.length > 0
        ? (currentUser.allowedTabs as MainNavTab[])
        : ['data_entry_form'];
      return allowed.includes(tabId);
    }
    return false;
  };

  // Enforce role-based tab restrictions:
  // Data Entry users can access only their explicitly allowed tabs
  // Supervisors can strictly access only supervisor_submission
  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === 'supervisor') {
      if (activeNavTab !== 'supervisor_submission') {
        setActiveNavTab('supervisor_submission');
      }
    } else if (currentUser.role === 'data_entry') {
      const allowed = Array.isArray(currentUser.allowedTabs) && currentUser.allowedTabs.length > 0
        ? (currentUser.allowedTabs as MainNavTab[])
        : ['data_entry_form'];
      if (!allowed.includes(activeNavTab)) {
        setActiveNavTab((allowed[0] || 'data_entry_form') as MainNavTab);
      }
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

  const handleCopyCard = async (emp: EmployeeCardData) => {
    if (copyingCardId) return;
    setCopyingCardId(emp.id);
    setCopyFeedback(null);

    try {
      const res = await copyCardSideBySideToClipboard(emp, getCardElement, {
        scale: 3,
        gap: 32,
        padding: 16,
      });

      setCopyFeedback({
        id: emp.id,
        status: res.method === 'clipboard' ? 'copied' : 'downloaded',
        message: res.message,
      });

      // Auto-dismiss after 4 seconds
      setTimeout(() => {
        setCopyFeedback((prev) => (prev?.id === emp.id ? null : prev));
      }, 4000);
    } catch (err: any) {
      console.error('Failed to copy card image:', err);
      setCopyFeedback({
        id: emp.id,
        status: 'downloaded',
        message: err.message || 'Failed to capture card image.',
      });
    } finally {
      setCopyingCardId(null);
    }
  };

  const handleToggleSelectCard = (id: string) => {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setBulkPdfFeedback(null);
  };

  const handleSelectAllCards = (ids: string[]) => {
    setSelectedCardIds(new Set(ids));
    setBulkPdfFeedback(null);
  };

  const handleClearSelectedCards = () => {
    setSelectedCardIds(new Set());
    setBulkPdfFeedback(null);
  };

  const handleTriggerBulkPdfDownload = async () => {
    if (isBulkPdfGenerating) return;

    if (selectedCardIds.size === 0) {
      setBulkPdfFeedback({
        type: 'warning',
        message: 'Please select cards from the table (up to 18) to download as a print-ready bulk PDF.',
      });
      return;
    }

    if (selectedCardIds.size > 18) {
      setBulkPdfFeedback({
        type: 'warning',
        message: `Maximum 18 cards per PDF download. Please select no more than 18 cards (currently selected: ${selectedCardIds.size}).`,
      });
      return;
    }

    const selectedList = employees.filter((e) => selectedCardIds.has(e.id));
    if (selectedList.length === 0) {
      setBulkPdfFeedback({
        type: 'warning',
        message: 'No matching cards found for the selected items.',
      });
      return;
    }

    setIsBulkPdfGenerating(true);
    setBulkPdfProgress({ current: 0, total: selectedList.length });
    setBulkPdfFeedback(null);

    try {
      const result = await generateBulkCardsPdf(
        selectedList,
        getCardElement,
        (current, total, msg) => {
          setBulkPdfProgress({ current, total });
        }
      );

      downloadBlob(result.blob, result.filename);

      setBulkPdfFeedback({
        type: 'success',
        message: `Bulk PDF downloaded successfully: ${result.cardCount} cards across ${result.pageCount} landscape page${result.pageCount > 1 ? 's' : ''}!`,
      });

      // Auto dismiss success feedback after 6 seconds
      setTimeout(() => {
        setBulkPdfFeedback((prev) => (prev?.type === 'success' ? null : prev));
      }, 6000);
    } catch (err: any) {
      console.error('Bulk PDF download failed:', err);
      setBulkPdfFeedback({
        type: 'error',
        message: err.message || 'Failed to generate bulk PDF download.',
      });
    } finally {
      setIsBulkPdfGenerating(false);
    }
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

  const handleCardsMarkedPrinted = (enrollIds: string[]) => {
    const enrollSet = new Set(enrollIds);
    const now = new Date().toISOString();
    setEmployees((prev) =>
      prev.map((e) => {
        if (enrollSet.has(e.enrollId)) {
          const newCount = (e.printCount || 0) + 1;
          return {
            ...e,
            printStatus: 'printed',
            printCount: newCount,
            printedAt: now,
            reprintHistory: [
              ...(e.reprintHistory || []),
              {
                printedAt: now,
                printedBy: currentUser?.name || 'Admin',
                action: (e.printCount || 0) > 0 ? 'reprint' : 'initial_print',
              },
            ],
          };
        }
        return e;
      })
    );
  };

  const handleMarkSinglePrintOk = async (emp: EmployeeCardData) => {
    const now = new Date().toISOString();
    try {
      if (emp.enrollId) {
        await apiService.markSubmissionPrinted(emp.enrollId, 'Marked Print OK from Card Studio');
      }
    } catch (err) {
      console.warn('Backend mark note:', err);
    }

    setEmployees((prev) =>
      prev.map((e) => {
        if (e.id === emp.id || (emp.enrollId && e.enrollId === emp.enrollId)) {
          const newCount = (e.printCount || 0) + 1;
          return {
            ...e,
            printStatus: 'printed',
            printCount: newCount,
            printedAt: now,
            reprintHistory: [
              ...(e.reprintHistory || []),
              {
                printedAt: now,
                printedBy: currentUser?.name || 'Admin',
                action: (e.printCount || 0) > 0 ? 'reprint' : 'initial_print',
                note: 'Marked Print OK from Card Studio',
              },
            ],
          };
        }
        return e;
      })
    );
  };

  const handleToggleCardPrintStatus = async (emp: EmployeeCardData) => {
    try {
      if (emp.enrollId) {
        await apiService.resetSubmissionPrintStatus(emp.enrollId);
      }
    } catch (err) {
      console.warn('Backend reset note:', err);
    }

    setEmployees((prev) =>
      prev.map((e) => {
        if (e.id === emp.id || (emp.enrollId && e.enrollId === emp.enrollId)) {
          return {
            ...e,
            printStatus: 'pending',
          };
        }
        return e;
      })
    );
  };

  const isAdmin = currentUser?.role === 'admin';
  const isDataEntry = currentUser?.role === 'data_entry';
  const isSupervisor = currentUser?.role === 'supervisor';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      {/* Top Application Bar - Clean Header */}
      <header className="bg-slate-50/95 backdrop-blur-md border-b border-slate-200/90 sticky top-0 z-30 px-4 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        {/* Brand and Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 to-rose-500 flex items-center justify-center text-white shadow-xs shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 leading-none">
              ID Card Generator
            </h1>
          </div>
        </div>

        {/* User Account, Settings & Authentication Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {currentUser ? (
            <div className="flex items-center gap-2.5 bg-white border border-slate-200/90 px-3 py-1.5 rounded-xl shadow-2xs">
              <div className="flex flex-col text-right">
                <span className="text-xs font-bold text-slate-900">{currentUser.name}</span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {currentUser.employeeId ? `Emp ID: ${currentUser.employeeId}` : `@${currentUser.username}`}
                </span>
              </div>

              {isAdmin ? (
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1.5 shadow-2xs">
                  <Shield className="w-3.5 h-3.5 text-rose-600" />
                  <span>Admin</span>
                </span>
              ) : isSupervisor ? (
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1.5 shadow-2xs">
                  <Briefcase className="w-3.5 h-3.5 text-purple-600" />
                  <span>Supervisor</span>
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200 flex items-center gap-1.5 shadow-2xs">
                  <Lock className="w-3.5 h-3.5 text-sky-600" />
                  <span>Data Entry</span>
                </span>
              )}

              {/* Admin-only System Settings Button */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setIsAdminSettingsOpen(true)}
                  className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 hover:border-slate-300 shadow-2xs"
                  title="Configure System Settings, Availability & Notifications"
                >
                  <Settings className="w-3.5 h-3.5 text-rose-600" />
                  <span className="hidden sm:inline">Settings</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleLogout}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-0.5"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsLoginModalOpen(true)}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </header>

      {/* Primary Navigation Bar - Clean & Short Labels */}
      <nav className="bg-white border-b border-slate-200 px-4 flex items-center justify-between overflow-x-auto shadow-2xs">
        <div className="flex items-center gap-1 sm:gap-2">
          {/* SUPERVISOR ROLE: Strictly ONE menu only: Add Card */}
          {isSupervisor && (
            <button
              onClick={() => setActiveNavTab('supervisor_submission')}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 border-purple-600 text-purple-700 bg-purple-50/60 transition-all whitespace-nowrap"
            >
              <IdCard className="w-4 h-4 text-purple-600" />
              <span>Add Card</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-200/70 text-purple-800">
                Supervisor
              </span>
            </button>
          )}

          {/* ADMIN & DATA ENTRY NAVIGATION TABS (ENFORCED BY ROLE & TAB PERMISSIONS) */}
          {!isSupervisor && (
            <>
              {/* 1. Print Queue */}
              {canAccessTab('submissions') && (
                <button
                  onClick={() => setActiveNavTab('submissions')}
                  className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                    activeNavTab === 'submissions'
                      ? 'border-rose-600 text-rose-700 bg-rose-50/60'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <TableIcon className="w-4 h-4 text-rose-600" />
                  <span>Print Queue</span>
                </button>
              )}

              {/* 2. Supervisor Entry */}
              {canAccessTab('supervisor_submission') && (
                <button
                  onClick={() => setActiveNavTab('supervisor_submission')}
                  className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                    activeNavTab === 'supervisor_submission'
                      ? 'border-purple-600 text-purple-700 bg-purple-50/60'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Briefcase className="w-4 h-4 text-purple-600" />
                  <span>Supervisor Entry</span>
                </button>
              )}

              {/* 3. Direct Entry */}
              {canAccessTab('data_entry_form') && (
                <button
                  onClick={() => setActiveNavTab('data_entry_form')}
                  className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                    activeNavTab === 'data_entry_form'
                      ? 'border-rose-600 text-rose-700 bg-rose-50/60'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <IdCard className="w-4 h-4 text-rose-600" />
                  <span>Direct Entry</span>
                </button>
              )}

              {/* 4. Employees */}
              {canAccessTab('employee_data') && (
                <button
                  onClick={() => setActiveNavTab('employee_data')}
                  className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                    activeNavTab === 'employee_data'
                      ? 'border-rose-600 text-rose-700 bg-rose-50/60'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Database className="w-4 h-4 text-rose-600" />
                  <span>Employees</span>
                </button>
              )}

              {/* 5. Users */}
              {canAccessTab('user_management') && (
                <button
                  onClick={() => setActiveNavTab('user_management')}
                  className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                    activeNavTab === 'user_management'
                      ? 'border-rose-600 text-rose-700 bg-rose-50/60'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Users className="w-4 h-4 text-rose-600" />
                  <span>Users</span>
                </button>
              )}

              {/* 6. Card Studio */}
              {canAccessTab('card_studio') && (
                <button
                  onClick={() => setActiveNavTab('card_studio')}
                  className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                    activeNavTab === 'card_studio'
                      ? 'border-rose-600 text-rose-700 bg-rose-50/60'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Layers className="w-4 h-4 text-rose-600" />
                  <span>Card Studio</span>
                </button>
              )}
            </>
          )}
        </div>

        {/* Right Role Indicator */}
        {isSupervisor ? (
          <div className="text-[11px] text-purple-700 font-semibold flex items-center gap-1.5 py-2">
            <Briefcase className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <span>Supervisor Portal</span>
          </div>
        ) : isDataEntry ? (
          <div className="text-[11px] text-sky-700 font-semibold flex items-center gap-1.5 py-2">
            <Lock className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span>Operator Access</span>
          </div>
        ) : null}
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
            {/* SECTION 1: Print Queue & Submissions */}
            {canAccessTab('submissions') && activeNavTab === 'submissions' && (
              <SubmissionsSection
                frontTemplateUrl={frontTemplateUrl}
                backTemplateUrl={backTemplateUrl}
                onSendToPrintStudio={handleSendToPrintStudio}
              />
            )}

            {/* SECTION 2: Dedicated Supervisor Submission Form */}
            {canAccessTab('supervisor_submission') && activeNavTab === 'supervisor_submission' && (
              <SupervisorSubmissionForm
                currentUser={currentUser}
                onSubmissionSuccess={() => {}}
              />
            )}

            {/* SECTION 3: Dedicated Data Entry Form */}
            {canAccessTab('data_entry_form') && activeNavTab === 'data_entry_form' && (
              <DataEntryForm
                frontTemplateUrl={frontTemplateUrl}
                backTemplateUrl={backTemplateUrl}
                onSubmissionSuccess={() => {}}
              />
            )}

            {/* SECTION 4: Employee Database */}
            {canAccessTab('employee_data') && activeNavTab === 'employee_data' && (
              <EmployeeDatabaseSection />
            )}

            {/* SECTION 5: User Management */}
            {canAccessTab('user_management') && activeNavTab === 'user_management' && (
              <UserManagementSection />
            )}

            {/* SECTION 6: Card Studio & Designer */}
            {canAccessTab('card_studio') && activeNavTab === 'card_studio' && (
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
                      Table ({employees.length})
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
                      Gallery
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
                      selectedCardIds={selectedCardIds}
                      onToggleSelectCard={handleToggleSelectCard}
                      onSelectAllCards={handleSelectAllCards}
                      onClearSelectedCards={handleClearSelectedCards}
                      onBulkPdfDownload={handleTriggerBulkPdfDownload}
                      isBulkPdfGenerating={isBulkPdfGenerating}
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Card {selectedEmpIndex + 1} of {employees.length}
                      </span>

                      {/* Print Status Badge & Action in Inspector Header */}
                      {currentEmployee.printStatus === 'printed' ? (
                        <div className="flex items-center gap-1">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            <span>Print OK</span>
                            {currentEmployee.printCount && currentEmployee.printCount > 1 ? (
                              <span className="text-[9px] opacity-80">({currentEmployee.printCount}x)</span>
                            ) : null}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleCardPrintStatus(currentEmployee)}
                            title="Reset status back to Print Pending"
                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-slate-500 hover:text-amber-800 hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-colors"
                          >
                            Reset
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Print Pending</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleMarkSinglePrintOk(currentEmployee)}
                            title="Mark this card as Print OK"
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            <span>Mark Print OK</span>
                          </button>
                        </div>
                      )}

                      {/* Minimal Copy Icon Button */}
                      <button
                        type="button"
                        onClick={() => handleCopyCard(currentEmployee)}
                        disabled={copyingCardId === currentEmployee.id}
                        title="Copy Front & Back combined side-by-side to Clipboard (paste into Word with Ctrl+V)"
                        className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 transition-all flex items-center gap-1.5 shadow-2xs active:scale-95 disabled:opacity-50"
                      >
                        {copyingCardId === currentEmployee.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                        ) : copyFeedback?.id === currentEmployee.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-slate-500 hover:text-slate-900" />
                        )}
                        <span className="text-[10px] font-semibold">
                          {copyingCardId === currentEmployee.id
                            ? 'Combining...'
                            : copyFeedback?.id === currentEmployee.id
                            ? (copyFeedback.status === 'copied' ? 'Copied!' : 'Downloaded!')
                            : 'Copy'}
                        </span>
                      </button>

                      {/* Bulk PDF Download Button (Clearly labeled near Copy option) */}
                      <button
                        type="button"
                        onClick={handleTriggerBulkPdfDownload}
                        disabled={isBulkPdfGenerating}
                        title={
                          selectedCardIds.size > 18
                            ? 'Maximum 18 cards per PDF. Please select no more than 18 cards.'
                            : selectedCardIds.size === 0
                            ? 'Select cards from the table to download Bulk PDF'
                            : 'Download selected cards (up to 18) as a print-ready landscape PDF'
                        }
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 shadow-2xs active:scale-95 disabled:opacity-50 ${
                          selectedCardIds.size > 18
                            ? 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse'
                            : 'bg-rose-600 hover:bg-rose-700 text-white'
                        }`}
                      >
                        {isBulkPdfGenerating ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                        ) : (
                          <FileDown className="w-3.5 h-3.5 text-white" />
                        )}
                        <span>
                          {isBulkPdfGenerating
                            ? `Generating (${bulkPdfProgress.current}/${bulkPdfProgress.total})...`
                            : `Bulk PDF Download${selectedCardIds.size > 0 ? ` (${selectedCardIds.size})` : ''}`}
                        </span>
                      </button>
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

                  {/* Copy Feedback Notification */}
                  {copyFeedback && copyFeedback.id === currentEmployee.id && (
                    <div
                      className={`p-2.5 rounded-xl text-[11px] font-medium flex items-center gap-2 transition-all shadow-xs ${
                        copyFeedback.status === 'copied'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-sky-50 text-sky-800 border border-sky-200'
                      }`}
                    >
                      <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                      <span className="flex-1 font-semibold">{copyFeedback.message}</span>
                    </div>
                  )}

                  {/* Bulk PDF Feedback Notification */}
                  {bulkPdfFeedback && (
                    <div
                      className={`p-2.5 rounded-xl text-[11px] font-medium flex items-center gap-2 transition-all shadow-xs ${
                        bulkPdfFeedback.type === 'success'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : bulkPdfFeedback.type === 'warning'
                          ? 'bg-amber-50 text-amber-800 border border-amber-300'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {bulkPdfFeedback.type === 'success' ? (
                        <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                      ) : bulkPdfFeedback.type === 'warning' ? (
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      )}
                      <span className="flex-1 font-semibold">{bulkPdfFeedback.message}</span>
                      <button
                        type="button"
                        onClick={() => setBulkPdfFeedback(null)}
                        className="text-slate-400 hover:text-slate-700 font-bold px-1"
                      >
                        ✕
                      </button>
                    </div>
                  )}

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
                        <div className="flex items-center justify-between w-full max-w-[280px] mb-1.5 px-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                            Front Side (Official)
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyCard(currentEmployee)}
                            disabled={copyingCardId === currentEmployee.id}
                            title="Copy Front & Back combined side-by-side to Clipboard (for Word Ctrl+V)"
                            className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 active:scale-95 transition-all flex items-center gap-1"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div
                          style={{
                            width: CARD_WIDTH * previewZoom,
                            height: CARD_HEIGHT * previewZoom,
                          }}
                          className="relative transition-all shadow-md rounded-2xl overflow-hidden group"
                        >
                          <CardFront
                            id={`inspect-front-${currentEmployee.id}`}
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
                        <div className="flex items-center justify-between w-full max-w-[280px] mb-1.5 px-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                            Back Side (Emergency &amp; Blood Group)
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyCard(currentEmployee)}
                            disabled={copyingCardId === currentEmployee.id}
                            title="Copy Front & Back combined side-by-side to Clipboard (for Word Ctrl+V)"
                            className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 active:scale-95 transition-all flex items-center gap-1"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div
                          style={{
                            width: CARD_WIDTH * previewZoom,
                            height: CARD_HEIGHT * previewZoom,
                          }}
                          className="relative transition-all shadow-md rounded-2xl overflow-hidden group"
                        >
                          <CardBack
                            id={`inspect-back-${currentEmployee.id}`}
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
        backgroundImageUrl={loginBackgroundImage}
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
        onConfirmPrintOk={async () => {
          const validIds = employees.map((e) => e.enrollId).filter(Boolean);
          if (validIds.length > 0) {
            try {
              await apiService.bulkMarkPrinted(validIds, 'Marked Print OK from Print Settings');
            } catch (err) {
              console.warn('Backend mark note:', err);
            }
            handleCardsMarkedPrinted(validIds);
          }
        }}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        employees={employees}
        settings={printSettings}
        companyConfig={companyConfig}
        getCardElement={getCardElement}
        onCardsPrinted={handleCardsMarkedPrinted}
      />

      {/* Admin Settings Modal (Configures supervisor submission confirmation message & settings) */}
      <AdminSettingsModal
        isOpen={isAdminSettingsOpen}
        onClose={() => setIsAdminSettingsOpen(false)}
        onSettingsSaved={() => {
          apiService.getPublicSettings().then((settings) => {
            if (settings?.loginBackgroundImage !== undefined) {
              setLoginBackgroundImage(settings.loginBackgroundImage || '');
            }
          });
        }}
      />
    </div>
  );
}
