import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Search,
  CheckCircle,
  AlertTriangle,
  Upload,
  Camera,
  PenTool,
  RotateCcw,
  Send,
  User,
  ShieldAlert,
  IdCard,
  Building,
  Briefcase,
  Calendar,
  Phone,
  Droplet,
  MapPin,
  RefreshCw,
  FileCheck,
  Check,
  X,
  Clock,
  ShieldOff,
  ChevronRight,
  Info,
} from 'lucide-react';
import { apiService } from '../services/apiService';
import { AuthUser, MasterEmployee } from '../types';
import { CameraCaptureModal } from './CameraCaptureModal';
import { SignaturePadModal } from './SignaturePadModal';
import { BanglaSizeAlertModal } from './BanglaSizeAlertModal';
import {
  compressImageFile,
  compressDataUrl,
  getDataUrlSizeBytes,
  MAX_FILE_SIZE_BYTES,
} from '../utils/imageCompression';

interface SupervisorSubmissionFormProps {
  currentUser?: AuthUser | null;
  onSubmissionSuccess?: () => void;
}

interface SearchEmployeeResult {
  enrollId: string;
  name: string;
  designation: string;
  department: string;
  bloodGroup: string;
  alreadySubmitted: boolean;
}

export function SupervisorSubmissionForm({
  currentUser,
  onSubmissionSuccess,
}: SupervisorSubmissionFormProps) {
  // Search & Auto-Suggest State
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<SearchEmployeeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const searchRequestIdRef = useRef(0);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Selected Employee & Submission Status
  const [employee, setEmployee] = useState<MasterEmployee | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [submissionInfo, setSubmissionInfo] = useState<any | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Form input fields
  const [nationalId, setNationalId] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [signatureUrl, setSignatureUrl] = useState('');

  // Modals & Capture State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraType, setCameraType] = useState<'photo' | 'signature'>('photo');
  const [isSignaturePadOpen, setIsSignaturePadOpen] = useState(false);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Size Alert State
  const [isSizeAlertOpen, setIsSizeAlertOpen] = useState(false);

  // Confirmation Popup State (Strictly NO ID Card Preview)
  const [confirmationPopup, setConfirmationPopup] = useState<{
    isOpen: boolean;
    message: string;
    employeeName: string;
    enrollId: string;
  }>({
    isOpen: false,
    message: '',
    employeeName: '',
    enrollId: '',
  });

  // Maintenance Mode (Form Availability) State
  const [formEnabled, setFormEnabled] = useState(true);
  const [disabledMessage, setDisabledMessage] = useState(
    'সাময়িক রক্ষণাবেক্ষণের জন্য আইডি কার্ড আবেদন কার্যক্রম বন্ধ রয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।'
  );
  const [isMaintenancePopupOpen, setIsMaintenancePopupOpen] = useState(false);
  const hasShownMaintenancePopupRef = useRef(false);

  // Configured success message from Admin Settings
  const [adminConfiguredMessage, setAdminConfiguredMessage] = useState(
    'Employee ID Card data has been submitted successfully and queued for administrative review and printing. Thank you!'
  );

  // Hidden file inputs
  const photoFileInputRef = useRef<HTMLInputElement>(null);
  const sigFileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Check public settings on mount and periodically to apply immediate maintenance changes
  const syncSettings = useCallback(async () => {
    try {
      const settings = await apiService.getPublicSettings();
      if (settings) {
        if (settings.supervisorSuccessMessage) {
          setAdminConfiguredMessage(settings.supervisorSuccessMessage);
        }
        if (settings.supervisorFormDisabledMessage) {
          setDisabledMessage(settings.supervisorFormDisabledMessage);
        }

        const isEnabled = settings.supervisorFormEnabled !== false;
        setFormEnabled(isEnabled);

        // If newly disabled, show the maintenance popup immediately
        if (!isEnabled && !hasShownMaintenancePopupRef.current) {
          setIsMaintenancePopupOpen(true);
          hasShownMaintenancePopupRef.current = true;
        } else if (isEnabled) {
          hasShownMaintenancePopupRef.current = false;
        }
      }
    } catch {
      // Fallback
    }
  }, []);

  useEffect(() => {
    syncSettings();
    // Poll every 8 seconds for immediate maintenance status response
    const interval = setInterval(syncSettings, 8000);
    return () => clearInterval(interval);
  }, [syncSettings]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Live Auto-Search as Supervisor Types (debounced 250ms with race condition protection)
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      setIsDropdownOpen(false);
      setHasSearched(false);
      return;
    }

    // If maintenance mode is active, prevent searching
    if (!formEnabled) {
      setIsDropdownOpen(false);
      return;
    }

    const currentReqId = ++searchRequestIdRef.current;
    setIsSearching(true);
    setHasSearched(false);

    const timer = setTimeout(async () => {
      try {
        const res = await apiService.searchEmployees(trimmed);
        if (searchRequestIdRef.current === currentReqId) {
          setSearchResults(res.results || []);
          setIsDropdownOpen(true);
          setHasSearched(true);
          setLookupError(null);
        }
      } catch (err: any) {
        if (searchRequestIdRef.current === currentReqId) {
          if (err.data?.formDisabled) {
            setFormEnabled(false);
            if (err.message) setDisabledMessage(err.message);
            setIsMaintenancePopupOpen(true);
          }
          setSearchResults([]);
          setIsDropdownOpen(true);
          setHasSearched(true);
        }
      } finally {
        if (searchRequestIdRef.current === currentReqId) {
          setIsSearching(false);
        }
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchInput, formEnabled]);

  // Load employee details by Enrollment ID
  const handleSelectEmployee = async (enrollId: string) => {
    if (!formEnabled) {
      setIsMaintenancePopupOpen(true);
      return;
    }

    setIsDropdownOpen(false);
    setIsLookingUp(true);
    setLookupError(null);
    setSubmitError(null);

    try {
      const res = await apiService.lookupEmployee(enrollId);
      if (res.found && res.employee) {
        setEmployee(res.employee);
        setSearchInput(res.employee.enrollId);
        setAlreadySubmitted(Boolean(res.alreadySubmitted));
        setSubmissionInfo(res.submissionInfo || null);
        setNationalId(res.employee.nationalId || '');
        setPhotoUrl(res.employee.photo || '');
        setSignatureUrl(res.employee.signature || '');
      } else {
        setEmployee(null);
        setLookupError(`Employee with Enrollment ID "${enrollId}" was not found.`);
      }
    } catch (err: any) {
      setEmployee(null);
      if (err.data?.formDisabled) {
        setFormEnabled(false);
        if (err.message) setDisabledMessage(err.message);
        setIsMaintenancePopupOpen(true);
      } else {
        setLookupError(err.message || `Employee Enrollment ID "${enrollId}" was not found.`);
      }
    } finally {
      setIsLookingUp(false);
    }
  };

  // Image Upload Handlers with Automatic Client-Side Compression & 1MB Validation
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, target: 'photo' | 'sig') => {
    if (!formEnabled) return;

    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setSubmitError('অনুগ্রহ করে সঠিক ইমেজ ফাইল (PNG, JPG, WebP) নির্বাচন করুন।');
      e.target.value = '';
      return;
    }

    try {
      const result = await compressImageFile(file, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.8,
        isSignature: target === 'sig',
      });

      if (!result.isValidSize || result.sizeBytes > MAX_FILE_SIZE_BYTES) {
        setIsSizeAlertOpen(true);
        if (target === 'photo') {
          setPhotoUrl('');
          if (photoFileInputRef.current) photoFileInputRef.current.value = '';
        } else {
          setSignatureUrl('');
          if (sigFileInputRef.current) sigFileInputRef.current.value = '';
        }
        return;
      }

      if (target === 'photo') {
        setPhotoUrl(result.dataUrl);
      } else {
        setSignatureUrl(result.dataUrl);
      }
    } catch {
      setSubmitError('ইমেজ ফাইলটি প্রক্রিয়াকরণ করা সম্ভব হয়নি। অনুগ্রহ করে অন্য ছবি চেষ্টা করুন।');
    } finally {
      e.target.value = '';
    }
  };

  const openCamera = (type: 'photo' | 'signature') => {
    if (!formEnabled) return;
    setCameraType(type);
    setIsCameraOpen(true);
  };

  const handleCameraCapture = async (dataUrl: string) => {
    try {
      const result = await compressDataUrl(dataUrl, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.8,
        isSignature: cameraType === 'signature',
      });

      if (!result.isValidSize || result.sizeBytes > MAX_FILE_SIZE_BYTES) {
        setIsSizeAlertOpen(true);
        return;
      }

      if (cameraType === 'photo') {
        setPhotoUrl(result.dataUrl);
      } else {
        setSignatureUrl(result.dataUrl);
      }
    } catch (err) {
      console.error('Camera capture compression error:', err);
    }
  };

  const handleSignaturePadSave = async (dataUrl: string) => {
    try {
      const result = await compressDataUrl(dataUrl, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.8,
        isSignature: true,
      });

      if (!result.isValidSize || result.sizeBytes > MAX_FILE_SIZE_BYTES) {
        setIsSizeAlertOpen(true);
        return;
      }

      setSignatureUrl(result.dataUrl);
    } catch (err) {
      console.error('Signature pad compression error:', err);
    }
  };

  // Reset / Clear Form completely
  const handleResetForm = () => {
    setSearchInput('');
    setSearchResults([]);
    setIsDropdownOpen(false);
    setEmployee(null);
    setAlreadySubmitted(false);
    setSubmissionInfo(null);
    setNationalId('');
    setPhotoUrl('');
    setSignatureUrl('');
    setLookupError(null);
    setSubmitError(null);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  // Submit Supervisor Record
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formEnabled) {
      setIsMaintenancePopupOpen(true);
      return;
    }

    if (!employee) {
      setSubmitError('অনুগ্রহ করে প্রথমে কর্মচারীর এনরোলমেন্ট আইডি অনুসন্ধান করে নির্বাচন করুন।');
      return;
    }

    if (alreadySubmitted) {
      setSubmitError('এই এনরোলমেন্ট আইডির জন্য ইতিমধ্যে আবেদন জমা দেওয়া হয়েছে (ডুপ্লিকেট রুদ্ধ)।');
      return;
    }

    if (!nationalId.trim()) {
      setSubmitError('কর্মচারীর জাতীয় পরিচয়পত্র (NID) নম্বর প্রদান করা আবশ্যক।');
      return;
    }

    if (!photoUrl) {
      setSubmitError('কর্মচারীর পাসপোর্ট সাইজের রঙিন ছবি সংযুক্ত করা আবশ্যক।');
      return;
    }

    if (!signatureUrl) {
      setSubmitError('কর্মচারীর অনুভূমিক স্পষ্ট স্বাক্ষর সংযুক্ত করা আবশ্যক।');
      return;
    }

    // Strict 1 MB File Size Validation
    if (
      getDataUrlSizeBytes(photoUrl) > MAX_FILE_SIZE_BYTES ||
      getDataUrlSizeBytes(signatureUrl) > MAX_FILE_SIZE_BYTES
    ) {
      setIsSizeAlertOpen(true);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await apiService.submitDataEntry({
        enrollId: employee.enrollId,
        nationalId: nationalId.trim(),
        photoUrl,
        signatureUrl,
      });

      const empName = employee.name;
      const empId = employee.enrollId;
      const returnedMessage = res.message || adminConfiguredMessage;

      // Reset form completely
      handleResetForm();

      // Show confirmation popup message (NO ID CARD PREVIEW)
      setConfirmationPopup({
        isOpen: true,
        message: returnedMessage,
        employeeName: empName,
        enrollId: empId,
      });

      if (onSubmissionSuccess) {
        onSubmissionSuccess();
      }
    } catch (err: any) {
      console.error('Supervisor submit error:', err);
      if (err.data?.formDisabled) {
        setFormEnabled(false);
        if (err.message) setDisabledMessage(err.message);
        setIsMaintenancePopupOpen(true);
      } else if (err.status === 409 || err.message?.includes('Already submitted')) {
        setAlreadySubmitted(true);
        setSubmitError(
          err.message || 'এই এনরোলমেন্ট আইডির তথ্য ইতিমধ্যে জমা দেওয়া হয়েছে। পুনরায় জমা দেওয়া সম্ভব নয়।'
        );
      } else {
        setSubmitError(err.message || 'তথ্য সংরক্ষণে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseConfirmationPopup = () => {
    setConfirmationPopup({
      isOpen: false,
      message: '',
      employeeName: '',
      enrollId: '',
    });
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5 bg-white min-h-screen">
      {/* Maintenance Mode Banner when OFF */}
      {!formEnabled && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <ShieldOff className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold block">আইডি কার্ড আবেদন সাময়িকভাবে স্থগিত রয়েছে (Maintenance Mode)</span>
              <span className="text-[11px] text-amber-700">{disabledMessage}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsMaintenancePopupOpen(true)}
            className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold rounded-lg text-xs transition-colors shrink-0"
          >
            বিজ্ঞপ্তি দেখুন
          </button>
        </div>
      )}

      {/* Clean Header Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <IdCard className="w-4 h-4 text-slate-700" />
            <span>Employee ID Card Entry Form</span>
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Search employee enrollment record, verify details, and attach employee photo & signature
          </p>
        </div>

        <button
          type="button"
          onClick={handleResetForm}
          disabled={!formEnabled}
          className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Form</span>
        </button>
      </div>

      {/* Submission Error Notification */}
      {submitError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-3 shadow-xs animate-in fade-in">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-rose-900 mb-0.5">Submission Notice</h4>
            <p className="leading-relaxed">{submitError}</p>
          </div>
          <button
            onClick={() => setSubmitError(null)}
            className="text-rose-600 hover:text-rose-800 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* STEP 1: Professional Supervisor Employee Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs relative" ref={searchContainerRef}>
        <div className="flex items-center justify-between mb-2.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-700" />
            <span>1. Search Employee by Enrollment ID or Name</span>
          </label>
          {isLookingUp && (
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" /> Loading employee...
            </span>
          )}
        </div>

        {/* Live Search Input Box */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onFocus={() => {
              if (searchResults.length > 0) setIsDropdownOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (searchResults.length > 0) {
                  handleSelectEmployee(searchResults[0].enrollId);
                } else if (searchInput.trim()) {
                  handleSelectEmployee(searchInput.trim());
                }
              }
            }}
            placeholder="Search by Enrollment ID or Employee Name..."
            disabled={!formEnabled}
            className="w-full bg-slate-50/80 border border-slate-300 focus:bg-white focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-900 placeholder-slate-400 transition-all outline-hidden disabled:opacity-50 disabled:cursor-not-allowed"
            autoComplete="off"
            autoFocus
          />

          {/* Right Spinner or Clear Button */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {isSearching && <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin" />}
            {searchInput && !isSearching && formEnabled && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setSearchResults([]);
                  setIsDropdownOpen(false);
                  searchInputRef.current?.focus();
                }}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Clean Suggestion Dropdown List */}
          {isDropdownOpen && formEnabled && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-72 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-98 duration-100">
              {searchResults.length > 0 ? (
                <>
                  <div className="px-3.5 py-1.5 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Matching Employee Records ({searchResults.length})
                  </div>
                  {searchResults.map((emp) => (
                    <button
                      key={emp.enrollId}
                      type="button"
                      onClick={() => handleSelectEmployee(emp.enrollId)}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between group"
                    >
                      <div className="space-y-0.5 min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 truncate group-hover:text-slate-950">
                            {emp.name}
                          </span>
                          <span className="font-mono text-[11px] font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                            {emp.enrollId}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate flex items-center gap-2">
                          <span>{emp.designation || 'Staff'}</span>
                          {emp.department && (
                            <>
                              <span>•</span>
                              <span>{emp.department}</span>
                            </>
                          )}
                          {emp.bloodGroup && (
                            <>
                              <span>•</span>
                              <span className="text-rose-600 font-semibold">{emp.bloodGroup}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {emp.alreadySubmitted ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Already Submitted
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Available
                          </span>
                        )}
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </button>
                  ))}
                </>
              ) : hasSearched && !isSearching ? (
                <div className="p-4 text-center text-xs text-slate-500 space-y-1">
                  <p className="font-semibold text-slate-700">No matching employees found</p>
                  <p className="text-[11px] text-slate-400">
                    No master records match &ldquo;{searchInput}&rdquo;. Please verify the Enrollment ID.
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Lookup Error Banner */}
        {lookupError && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{lookupError}</div>
          </div>
        )}

        {/* Duplicate Warning Alert */}
        {alreadySubmitted && submissionInfo && (
          <div className="mt-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-bold text-amber-950 mb-0.5">
                Already Submitted
              </h4>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                This employee was submitted on{' '}
                <strong className="text-slate-900">
                  {new Date(submissionInfo.submittedAt).toLocaleDateString()} at{' '}
                  {new Date(submissionInfo.submittedAt).toLocaleTimeString()}
                </strong>{' '}
                by <strong className="text-slate-900">{submissionInfo.submittedBy}</strong>. Duplicate submissions are protected and blocked.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* STEP 2: Read-Only Master Record Display */}
      {employee && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-700" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                2. Employee Information (Master Database)
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-600" /> Verified Record
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/80">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Full Name</div>
              <div className="font-bold text-slate-900 mt-0.5 truncate">{employee.name}</div>
            </div>

            <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/80">
              <div className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                <Briefcase className="w-3 h-3 text-slate-500" /> Designation
              </div>
              <div className="font-semibold text-slate-800 mt-0.5 truncate">{employee.designation}</div>
            </div>

            <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/80">
              <div className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                <Building className="w-3 h-3 text-slate-500" /> Department
              </div>
              <div className="font-semibold text-slate-800 mt-0.5 truncate">{employee.department}</div>
            </div>

            <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/80">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Enrollment No.</div>
              <div className="font-mono font-bold text-slate-900 mt-0.5">{employee.enrollId}</div>
            </div>

            <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/80">
              <div className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-500" /> Joining Date
              </div>
              <div className="font-mono text-slate-700 mt-0.5">{employee.joiningDate}</div>
            </div>

            <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/80">
              <div className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                <Droplet className="w-3 h-3 text-rose-600" /> Blood Group
              </div>
              <div className="font-bold text-rose-700 mt-0.5">{employee.bloodGroup}</div>
            </div>

            <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/80">
              <div className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-500" /> Card Issue Date
              </div>
              <div className="font-mono text-slate-700 mt-0.5">{employee.cardIssue || '19/10/2026'}</div>
            </div>

            <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/80">
              <div className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                <Phone className="w-3 h-3 text-slate-500" /> Emergency Contact
              </div>
              <div className="font-mono text-slate-700 mt-0.5">{employee.emergencyContact}</div>
            </div>

            <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/80 col-span-2 sm:col-span-3 md:col-span-4">
              <div className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-500" /> Permanent Address
              </div>
              <div className="text-slate-800 mt-0.5 truncate">{employee.permanentAddress}</div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Premium Form with Bengali Instructions (NID, Photo, Signature) */}
      {employee && (
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-slate-700" />
              <span>3. National ID, Photo &amp; Signature Entry</span>
            </h3>
            <span className="text-[11px] text-slate-500 font-semibold">* All fields required</span>
          </div>

          {/* Field 1: National ID Number */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-800 flex items-center justify-between">
              <span>কর্মচারীর জাতীয় পরিচয়পত্র (NID) নম্বর *</span>
              <span className="text-[11px] text-slate-400 font-normal">Smart NID বা পুরাতন NID নম্বর</span>
            </label>
            <div className="relative">
              <IdCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                placeholder="যেমন: 19852691234567890 অথবা 5912345678"
                disabled={!formEnabled || alreadySubmitted}
                className="w-full bg-slate-50/70 border border-slate-300 focus:bg-white focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 font-mono transition-colors disabled:opacity-50"
              />
            </div>
          </div>

          {/* Field 2: Employee Photo (Bengali Instructions) */}
          <div className="p-4.5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-700" />
                <span>কর্মচারীর ছবি (পাসপোর্ট সাইজ) *</span>
              </label>
              {photoUrl ? (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-600" /> ছবি সংযুক্ত হয়েছে
                </span>
              ) : (
                <span className="text-[10px] text-rose-600 font-semibold">সংযুক্ত করা আবশ্যক</span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {/* Photo Preview Thumbnail */}
              <div className="w-24 h-32 rounded-xl bg-white border border-slate-300 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt="Employee Photo Review"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center p-2 text-slate-400">
                    <User className="w-8 h-8 mx-auto mb-1 opacity-40" />
                    <span className="text-[9px] block">ছবি নেই</span>
                  </div>
                )}
              </div>

              {/* Photo Controls & Bengali Guidelines */}
              <div className="flex-1 space-y-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => openCamera('photo')}
                    disabled={!formEnabled || alreadySubmitted}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>ক্যামেরা দিয়ে তুলুন</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => photoFileInputRef.current?.click()}
                    disabled={!formEnabled || alreadySubmitted}
                    className="px-3.5 py-2 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 border border-slate-300 shadow-2xs"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    <span>ফাইল আপলোড</span>
                  </button>

                  {photoUrl && (
                    <button
                      type="button"
                      onClick={() => setPhotoUrl('')}
                      disabled={!formEnabled || alreadySubmitted}
                      className="px-2.5 py-2 text-rose-600 hover:text-rose-800 text-xs font-semibold"
                    >
                      ছবি মুছুন
                    </button>
                  )}
                </div>

                {/* Clear Bengali Instructions */}
                <div className="p-2.5 bg-white border border-slate-200/90 rounded-lg space-y-1 text-[11px] text-slate-600 leading-relaxed">
                  <div className="font-semibold text-slate-800 flex items-center gap-1">
                    <Info className="w-3 h-3 text-slate-500" />
                    <span>ছবি তোলার নিয়মাবলী:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-600 text-[10.5px]">
                    <li>ছবি অবশ্যই স্পষ্ট, সম্মুখমুখী এবং পাসপোর্ট সাইজের হতে হবে।</li>
                    <li>হালকা একরঙা ব্যাকগ্রাউন্ড এবং পর্যাপ্ত আলো থাকা বাঞ্ছনীয়।</li>
                    <li>মুখমণ্ডল, চোখ ও কান স্পষ্টভাবে দৃশ্যমান রাখুন।</li>
                    <li>সর্বোচ্চ ফাইল সাইজ: ১ মেগাবাইট (স্বয়ংক্রিয়ভাবে রিসাইজ হবে)।</li>
                  </ul>
                </div>
              </div>
            </div>

            <input
              ref={photoFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileChange(e, 'photo')}
            />
          </div>

          {/* Field 3: Employee Signature (Bengali Instructions) */}
          <div className="p-4.5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <PenTool className="w-3.5 h-3.5 text-slate-700" />
                <span>কর্মচারীর স্বাক্ষর (অনুভূমিক) *</span>
              </label>
              {signatureUrl ? (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-600" /> স্বাক্ষর সংযুক্ত হয়েছে
                </span>
              ) : (
                <span className="text-[10px] text-rose-600 font-semibold">সংযুক্ত করা আবশ্যক</span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {/* Signature Preview Thumbnail */}
              <div className="w-36 h-20 rounded-xl bg-white border border-slate-300 flex items-center justify-center overflow-hidden shrink-0 shadow-xs p-1">
                {signatureUrl ? (
                  <img
                    src={signatureUrl}
                    alt="Signature Review"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="text-center text-slate-400">
                    <PenTool className="w-5 h-5 mx-auto mb-0.5 opacity-40" />
                    <span className="text-[9px]">স্বাক্ষর নেই</span>
                  </div>
                )}
              </div>

              {/* Signature Controls & Bengali Guidelines */}
              <div className="flex-1 space-y-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => openCamera('signature')}
                    disabled={!formEnabled || alreadySubmitted}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>ক্যামেরায় তুলুন</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSignaturePadOpen(true)}
                    disabled={!formEnabled || alreadySubmitted}
                    className="px-3.5 py-2 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 border border-slate-300 shadow-2xs"
                  >
                    <PenTool className="w-3.5 h-3.5 text-slate-600" />
                    <span>টাচপ্যাডে স্বাক্ষর</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => sigFileInputRef.current?.click()}
                    disabled={!formEnabled || alreadySubmitted}
                    className="px-3.5 py-2 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 border border-slate-300 shadow-2xs"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    <span>ফাইল আপলোড</span>
                  </button>

                  {signatureUrl && (
                    <button
                      type="button"
                      onClick={() => setSignatureUrl('')}
                      disabled={!formEnabled || alreadySubmitted}
                      className="px-2.5 py-2 text-rose-600 hover:text-rose-800 text-xs font-semibold"
                    >
                      স্বাক্ষর মুছুন
                    </button>
                  )}
                </div>

                {/* Clear Bengali Instructions */}
                <div className="p-2.5 bg-white border border-slate-200/90 rounded-lg space-y-1 text-[11px] text-slate-600 leading-relaxed">
                  <div className="font-semibold text-slate-800 flex items-center gap-1">
                    <Info className="w-3 h-3 text-slate-500" />
                    <span>স্বাক্ষরের নির্দেশিকা:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-600 text-[10.5px]">
                    <li>সাদা কাগজের উপর কালো বা নীল কালির স্পষ্ট ও অনুভূমিক স্বাক্ষর হতে হবে।</li>
                    <li>ফ্রেমের ভেতরে শুধুমাত্র মূল স্বাক্ষরটি রাখুন।</li>
                    <li>টাচপ্যাডে আঙুল বা মাউস দিয়ে সরাসরি স্বাক্ষর আঁকা যাবে।</li>
                    <li>সর্বোচ্চ ফাইল সাইজ: ১ মেগাবাইট।</li>
                  </ul>
                </div>
              </div>
            </div>

            <input
              ref={sigFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileChange(e, 'sig')}
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={
                !formEnabled ||
                isSubmitting ||
                alreadySubmitted ||
                !nationalId.trim() ||
                !photoUrl ||
                !signatureUrl
              }
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>তথ্য সংরক্ষণ করা হচ্ছে...</span>
                </>
              ) : alreadySubmitted ? (
                <>
                  <ShieldAlert className="w-4 h-4" />
                  <span>ইতিমধ্যে জমা হয়েছে (ডুপ্লিকেট রুদ্ধ)</span>
                </>
              ) : !formEnabled ? (
                <>
                  <Clock className="w-4 h-4" />
                  <span>রক্ষণাবেক্ষণের জন্য বন্ধ রয়েছে</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>আইডি কার্ড তথ্য জমা দিন (Submit Record)</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* STRICT REQUIREMENT: Confirmation Popup Modal (NO ID CARD PREVIEW) */}
      {confirmationPopup.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
              <Check className="w-6 h-6 stroke-[2.5]" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">
                Submission Successful!
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed px-2">
                {confirmationPopup.message}
              </p>
            </div>

            {/* Employee Reference Details */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 flex flex-col gap-1 text-left">
              <div className="flex justify-between">
                <span className="text-slate-500">Employee Name:</span>
                <span className="font-bold text-slate-900">{confirmationPopup.employeeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Enrollment ID:</span>
                <span className="font-mono font-bold text-slate-900">{confirmationPopup.enrollId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="font-semibold text-emerald-700">Queued for Admin Print</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCloseConfirmationPopup}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
            >
              <span>Add Next Employee Record</span>
            </button>
          </div>
        </div>
      )}

      {/* Maintenance Mode Alert Popup */}
      {isMaintenancePopupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto shadow-xs">
              <Clock className="w-6 h-6 stroke-[2.2]" />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-bold text-slate-900">
                সাময়িক রক্ষণাবেক্ষণ বিজ্ঞপ্তি
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed px-2">
                {disabledMessage}
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 text-left">
              <p>
                • ফরমটি দৃশ্যমান থাকলেও নতুন আবেদন বা অনুসন্ধান সাময়িকভাবে নিষ্ক্রিয় থাকবে।
              </p>
              <p>
                • অ্যাডমিন রক্ষণাবেক্ষণ সম্পন্ন করার সাথে সাথে ফরমটি পুনরায় সক্রিয় হবে।
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsMaintenancePopupOpen(false)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center"
            >
              <span>ঠিক আছে, বুঝেছি (Dismiss)</span>
            </button>
          </div>
        </div>
      )}

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
        title={cameraType === 'photo' ? 'কর্মচারীর পাসপোর্ট ছবি ক্যামেরা' : 'কর্মচারীর স্বাক্ষর ক্যামেরা'}
        type={cameraType}
      />

      {/* Touch/Mouse Signature Pad Modal */}
      <SignaturePadModal
        isOpen={isSignaturePadOpen}
        onClose={() => setIsSignaturePadOpen(false)}
        onSave={handleSignaturePadSave}
      />

      {/* Bangla 1MB Size Alert Popup Modal */}
      <BanglaSizeAlertModal
        isOpen={isSizeAlertOpen}
        onClose={() => {
          setIsSizeAlertOpen(false);
          if (photoFileInputRef.current) photoFileInputRef.current.value = '';
          if (sigFileInputRef.current) sigFileInputRef.current.value = '';
        }}
      />
    </div>
  );
}
