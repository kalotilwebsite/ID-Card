import React, { useState, useRef, useEffect } from 'react';
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
  Shield,
  FileCheck,
  Check,
  X,
  Lock,
} from 'lucide-react';
import { apiService } from '../services/apiService';
import { AuthUser, MasterEmployee } from '../types';
import { CameraCaptureModal } from './CameraCaptureModal';
import { SignaturePadModal } from './SignaturePadModal';
import {
  normalizeEmployeePhoto,
  normalizeEmployeeSignature,
} from '../services/imageNormalizationService';

interface SupervisorSubmissionFormProps {
  currentUser?: AuthUser | null;
  onSubmissionSuccess?: () => void;
}

// Corner bracket frame component matching the reference image
function CornerCropBox({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative bg-slate-50/70 rounded-lg p-2 flex flex-col items-center justify-center border border-slate-200/70 select-none ${className}`}
    >
      {/* Corner crop marks */}
      <span className="absolute top-1 left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-slate-400 pointer-events-none" />
      <span className="absolute top-1 right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-slate-400 pointer-events-none" />
      <span className="absolute bottom-1 left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-slate-400 pointer-events-none" />
      <span className="absolute bottom-1 right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-slate-400 pointer-events-none" />
      {children}
    </div>
  );
}

export function SupervisorSubmissionForm({
  currentUser,
  onSubmissionSuccess,
}: SupervisorSubmissionFormProps) {
  // Search & Lookup State
  const [enrollIdInput, setEnrollIdInput] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [employee, setEmployee] = useState<MasterEmployee | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [submissionInfo, setSubmissionInfo] = useState<any | null>(null);

  // Form input fields
  const [nationalId, setNationalId] = useState('');
  const [nidWarning, setNidWarning] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [signatureUrl, setSignatureUrl] = useState('');

  // Modals & Capture State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraType, setCameraType] = useState<'photo' | 'signature'>('photo');
  const [isSignaturePadOpen, setIsSignaturePadOpen] = useState(false);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Availability & Settings state
  const [supervisorEntryEnabled, setSupervisorEntryEnabled] = useState(true);
  const [disabledNoticeMessage, setDisabledNoticeMessage] = useState(
    'Supervisor data entry is temporarily disabled by the Administrator. Please contact your system administrator.'
  );
  const [adminConfiguredMessage, setAdminConfiguredMessage] = useState(
    'Employee ID Card data has been submitted successfully and queued for administrative review and printing. Thank you!'
  );

  // Capture method toggles
  const [supervisorPhotoCameraEnabled, setSupervisorPhotoCameraEnabled] = useState(true);
  const [supervisorSignatureCameraEnabled, setSupervisorSignatureCameraEnabled] = useState(true);
  const [supervisorSignaturePadEnabled, setSupervisorSignaturePadEnabled] = useState(true);

  // Confirmation Popup Modal State (Strictly NO ID Card Preview)
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

  // Hidden file inputs
  const photoFileInputRef = useRef<HTMLInputElement>(null);
  const sigFileInputRef = useRef<HTMLInputElement>(null);
  const enrollInputRef = useRef<HTMLInputElement>(null);

  // Fetch admin configured settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settings = await apiService.getPublicSettings();
        if (settings) {
          if (settings.supervisorEntryEnabled !== undefined) {
            setSupervisorEntryEnabled(settings.supervisorEntryEnabled);
          }
          if (settings.supervisorEntryDisabledMessage) {
            setDisabledNoticeMessage(settings.supervisorEntryDisabledMessage);
          }
          if (settings.supervisorSuccessMessage) {
            setAdminConfiguredMessage(settings.supervisorSuccessMessage);
          }
          if (settings.supervisorPhotoCameraEnabled !== undefined) {
            setSupervisorPhotoCameraEnabled(settings.supervisorPhotoCameraEnabled);
          }
          if (settings.supervisorSignatureCameraEnabled !== undefined) {
            setSupervisorSignatureCameraEnabled(settings.supervisorSignatureCameraEnabled);
          }
          if (settings.supervisorSignaturePadEnabled !== undefined) {
            setSupervisorSignaturePadEnabled(settings.supervisorSignaturePadEnabled);
          }
        }
      } catch (e) {
        // Fallback to default
      }
    };
    fetchSettings();
  }, []);

  const isSupervisorRole = currentUser?.role === 'supervisor';
  const isEntryDisabled = isSupervisorRole && !supervisorEntryEnabled;

  // Lookup employee by Enrollment Number
  const handleLookup = async (idToSearch?: string) => {
    if (isEntryDisabled) return;

    const targetId = (idToSearch || enrollIdInput).trim();
    if (!targetId) {
      setLookupError('কর্মচারীর এনরোলমেন্ট নম্বর লিখুন। (Please enter an Enrollment Number)');
      return;
    }

    setIsLookingUp(true);
    setLookupError(null);
    setSubmitError(null);

    try {
      const res = await apiService.lookupEmployee(targetId);
      if (res.found && res.employee) {
        setEmployee(res.employee);
        setAlreadySubmitted(Boolean(res.alreadySubmitted));
        setSubmissionInfo(res.submissionInfo || null);
        if (res.employee.nationalId) {
          setNationalId(res.employee.nationalId);
          if (res.employee.nationalId.length > 15) {
            setNidWarning('আইডি কার্ডের সংখ্যা অনেক বড় হলে প্রথম চারটি সংখ্যা বাদ দিয়ে লিখুন।');
          } else {
            setNidWarning(null);
          }
        } else {
          setNationalId('');
          setNidWarning(null);
        }
        setPhotoUrl('');
        setSignatureUrl('');
      } else {
        setEmployee(null);
        setLookupError(
          `এনরোলমেন্ট নম্বর "${targetId}" ডাটাবেসে পাওয়া যায়নি। (Employee not found in Master Database)`
        );
      }
    } catch (err: any) {
      setEmployee(null);
      setLookupError(
        err.message ||
          `এনরোলমেন্ট নম্বর "${targetId}" ডাটাবেসে পাওয়া যায়নি। (Employee not found in Master Database)`
      );
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleKeyDownEnrollId = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLookup();
    }
  };

  const handleNationalIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.length > 15) {
      setNidWarning('আইডি কার্ডের সংখ্যা অনেক বড় হলে প্রথম চারটি সংখ্যা বাদ দিয়ে লিখুন।');
      setNationalId(val.slice(0, 15));
    } else {
      setNidWarning(null);
      setNationalId(val);
    }
  };

  const handleNationalIdPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (pasted && pasted.trim().length > 15) {
      setNidWarning('আইডি কার্ডের সংখ্যা অনেক বড় হলে প্রথম চারটি সংখ্যা বাদ দিয়ে লিখুন।');
    }
  };

  // Image Upload Handlers with Automatic Canvas Normalization
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, target: 'photo' | 'sig') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setSubmitError('সঠিক ছবি ফাইল নির্বাচন করুন (PNG, JPG, WebP)।');
      return;
    }

    try {
      if (target === 'photo') {
        const normalized = await normalizeEmployeePhoto(file);
        setPhotoUrl(normalized);
      } else {
        const normalized = await normalizeEmployeeSignature(file);
        setSignatureUrl(normalized);
      }
      setSubmitError(null);
    } catch (normErr: any) {
      console.error('Image normalization error:', normErr);
      setSubmitError('ছবি প্রক্রিয়া করতে ত্রুটি হয়েছে। অনুগ্রহ করে অন্য ছবি নির্বাচন করুন।');
    }
    e.target.value = '';
  };

  const openCamera = (type: 'photo' | 'signature') => {
    setCameraType(type);
    setIsCameraOpen(true);
  };

  const handleCameraCapture = async (dataUrl: string) => {
    try {
      if (cameraType === 'photo') {
        const normalized = await normalizeEmployeePhoto(dataUrl);
        setPhotoUrl(normalized);
      } else {
        const normalized = await normalizeEmployeeSignature(dataUrl);
        setSignatureUrl(normalized);
      }
      setSubmitError(null);
    } catch (normErr: any) {
      console.error('Camera normalization error:', normErr);
      if (cameraType === 'photo') {
        setPhotoUrl(dataUrl);
      } else {
        setSignatureUrl(dataUrl);
      }
    }
  };

  // Reset / Clear Form completely
  const handleResetForm = () => {
    setEnrollIdInput('');
    setEmployee(null);
    setAlreadySubmitted(false);
    setSubmissionInfo(null);
    setNationalId('');
    setNidWarning(null);
    setPhotoUrl('');
    setSignatureUrl('');
    setLookupError(null);
    setSubmitError(null);
    setTimeout(() => {
      enrollInputRef.current?.focus();
    }, 100);
  };

  // Submit Supervisor Record
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEntryDisabled) {
      setSubmitError(disabledNoticeMessage);
      return;
    }

    if (!employee) {
      setSubmitError('প্রথমে কর্মচারীর এনরোলমেন্ট নম্বর যাচাই করুন।');
      return;
    }

    if (alreadySubmitted) {
      setSubmitError('এই এনরোলমেন্ট নম্বরের জন্য ইতিমধ্যে তথ্য জমা দেওয়া হয়েছে।');
      return;
    }

    if (!nationalId.trim()) {
      setSubmitError('কর্মচারীর এনআইডি নম্বর আবশ্যক।');
      return;
    }

    if (nationalId.trim().length > 15) {
      setSubmitError('আইডি কার্ডের সংখ্যা অনেক বড় হলে প্রথম চারটি সংখ্যা বাদ দিয়ে লিখুন।');
      setNidWarning('আইডি কার্ডের সংখ্যা অনেক বড় হলে প্রথম চারটি সংখ্যা বাদ দিয়ে লিখুন।');
      return;
    }

    if (!photoUrl) {
      setSubmitError('কর্মচারীর ছবি আবশ্যক।');
      return;
    }

    if (!signatureUrl) {
      setSubmitError('কর্মচারীর স্বাক্ষর আবশ্যক।');
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

      // Show confirmation popup message (strictly NO card preview)
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
      if (err.status === 409 || err.message?.includes('Already submitted')) {
        setAlreadySubmitted(true);
        setSubmitError(
          err.message || 'এই এনরোলমেন্ট নম্বরের তথ্য ইতিমধ্যে জমা দেওয়া হয়েছে।'
        );
      } else {
        setSubmitError(err.message || 'তথ্য জমা দিতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
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
      enrollInputRef.current?.focus();
    }, 100);
  };

  const isFormComplete = Boolean(
    employee &&
      !alreadySubmitted &&
      nationalId.trim() &&
      photoUrl &&
      signatureUrl &&
      !isEntryDisabled
  );

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
      {/* Top Header Card matching the exact reference image */}
      <div className="relative overflow-hidden bg-[#113a30] rounded-2xl p-4 sm:p-5 text-white shadow-md border border-[#0d2e26]">
        {/* Subtle decorative curved background overlay */}
        <div
          className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-white/[0.04] pointer-events-none"
          style={{ filter: 'blur(30px)' }}
        />
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-white/[0.03] to-transparent pointer-events-none" />

        {/* Small top indicator bar */}
        <div className="w-12 h-1 bg-black/25 rounded-full mx-auto mb-3" />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Left: Yellow ID Badge Icon + Bengali Title + 3 Pills */}
          <div className="flex items-center gap-3.5">
            {/* Amber-yellow ID card icon badge */}
            <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center shrink-0 shadow-sm border border-amber-400">
              <IdCard className="w-6 h-6 text-slate-900 stroke-[2.2]" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-tight">
                নতুন কর্মচারী আইডি কার্ড
              </h2>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white/10 text-white/90 border border-white/15">
                  সুপারভাইজার পোর্টাল
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white/10 text-white/90 border border-white/15 font-mono">
                  আইডি: {currentUser?.employeeId || currentUser?.username || 'admin'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white/10 text-white/90 border border-white/15 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  অনুমোদিত সেশন
                </span>
              </div>
            </div>
          </div>

          {/* Right: Reset Form / Next ID Button */}
          <button
            type="button"
            onClick={handleResetForm}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/15 text-white/95 rounded-lg text-xs font-medium flex items-center gap-2 self-start sm:self-auto transition-colors border border-white/20 shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>ফর্ম মুছুন / পরবর্তী আইডি</span>
          </button>
        </div>
      </div>

      {/* Admin Disabled Notice (When Supervisor Entry is turned OFF by Admin) */}
      {isEntryDisabled && (
        <div className="bg-rose-50 border border-rose-300 rounded-xl p-4 text-xs text-rose-900 flex items-start gap-3 shadow-xs">
          <Lock className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-rose-950 text-sm mb-1">
              সুপারভাইজার এন্ট্রি সাময়িকভাবে বন্ধ আছে (Data Entry Disabled)
            </h4>
            <p className="leading-relaxed">{disabledNoticeMessage}</p>
          </div>
        </div>
      )}

      {/* Notice Banner matching reference image */}
      <div className="bg-[#fef8ee] border border-amber-200/90 rounded-xl px-4 py-3 flex items-center gap-2.5 text-xs text-amber-900 shadow-2xs">
        <ShieldCheckIcon className="w-4 h-4 text-amber-700 shrink-0" />
        <span className="leading-snug">
          আপনি শুধু নতুন আইডি কার্ডের তথ্য জমা দিতে পারবেন। কার্ড প্রিভিউ ও প্রিন্ট করেন শুধু সিস্টেম অ্যাডমিন।
        </span>
      </div>

      {/* Submission Error Banner */}
      {submitError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-start gap-2.5 shadow-2xs">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">{submitError}</div>
          <button
            type="button"
            onClick={() => setSubmitError(null)}
            className="text-rose-600 hover:text-rose-800 text-xs font-bold"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* STEP 1: কর্মচারীর এনরোলমেন্ট নম্বর */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
        <div className="bg-slate-50/70 border-b border-slate-100 px-5 py-3 flex items-center gap-2.5">
          <div className="w-5 h-5 rounded-full bg-[#114b3e] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
            ১
          </div>
          <h3 className="text-xs font-bold text-slate-800">কর্মচারীর এনরোলমেন্ট নম্বর</h3>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                ref={enrollInputRef}
                type="text"
                disabled={isEntryDisabled}
                value={enrollIdInput}
                onChange={(e) => setEnrollIdInput(e.target.value)}
                onKeyDown={handleKeyDownEnrollId}
                placeholder="এনরোলমেন্ট নম্বর লিখুন"
                className="w-full bg-white border border-slate-300 focus:border-[#114b3e] focus:ring-1 focus:ring-[#114b3e] rounded-lg pl-10 pr-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 font-medium transition-colors disabled:opacity-50 disabled:bg-slate-50"
              />
            </div>

            <button
              type="button"
              onClick={() => handleLookup()}
              disabled={isLookingUp || isEntryDisabled}
              className="px-5 py-2.5 bg-[#114b3e] hover:bg-[#0d3b31] disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-xs transition-all flex items-center gap-1.5 shrink-0"
            >
              {isLookingUp ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>যাচাই হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>যাচাই করুন</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Test Sample IDs helper */}
          <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-400 font-medium">নমুনা আইডি:</span>
            {['586665', '586666', '586667'].map((id) => (
              <button
                key={id}
                type="button"
                disabled={isEntryDisabled}
                onClick={() => {
                  setEnrollIdInput(id);
                  handleLookup(id);
                }}
                className="px-2 py-0.5 bg-slate-100 hover:bg-[#114b3e]/10 hover:text-[#114b3e] border border-slate-200 text-slate-600 rounded text-[11px] font-mono transition-colors disabled:opacity-40"
              >
                {id}
              </button>
            ))}
          </div>

          {/* Lookup Error */}
          {lookupError && (
            <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{lookupError}</div>
            </div>
          )}

          {/* Duplicate Submission Warning */}
          {alreadySubmitted && submissionInfo && (
            <div className="mt-3 p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                <strong>ইতিমধ্যে তথ্য জমা দেওয়া হয়েছে!</strong> এই এনরোলমেন্ট নম্বরের তথ্য{' '}
                {new Date(submissionInfo.submittedAt).toLocaleDateString()} তারিখে{' '}
                <strong>{submissionInfo.submittedBy}</strong> দ্বারা জমা দেওয়া হয়েছে।
              </div>
            </div>
          )}
        </div>
      </div>

      {/* STEP 2: কর্মচারীর তথ্য (শুধু দেখার জন্য) */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
        <div className="bg-slate-50/70 border-b border-slate-100 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-full bg-[#114b3e] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
              ২
            </div>
            <h3 className="text-xs font-bold text-slate-800">কর্মচারীর তথ্য (শুধু দেখার জন্য)</h3>
          </div>
          {employee && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-600" />
              যাচাইকৃত
            </span>
          )}
        </div>

        <div className="p-5">
          {!employee ? (
            /* Dashed placeholder box matching reference image */
            <div className="border border-dashed border-slate-300 rounded-xl py-8 px-4 text-center text-slate-400 text-xs font-medium">
              এনরোলমেন্ট নম্বর যাচাই করলে তথ্য এখানে দেখা যাবে
            </div>
          ) : (
            /* Full Verified Employee Record Display */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                <div className="text-[10px] text-slate-500 font-medium">পূর্ণ নাম (Name)</div>
                <div className="font-bold text-slate-900 mt-0.5 truncate">{employee.name}</div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                <div className="text-[10px] text-slate-500 font-medium">পদবী (Designation)</div>
                <div className="font-semibold text-slate-800 mt-0.5 truncate">
                  {employee.designation}
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                <div className="text-[10px] text-slate-500 font-medium">বিভাগ (Department)</div>
                <div className="font-semibold text-slate-800 mt-0.5 truncate">
                  {employee.department}
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                <div className="text-[10px] text-slate-500 font-medium">এনরোলমেন্ট নং</div>
                <div className="font-mono font-bold text-[#114b3e] mt-0.5">{employee.enrollId}</div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                <div className="text-[10px] text-slate-500 font-medium">যোগদানের তারিখ</div>
                <div className="font-mono text-slate-700 mt-0.5">{employee.joiningDate}</div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                <div className="text-[10px] text-slate-500 font-medium">রক্তের গ্রুপ</div>
                <div className="font-bold text-rose-700 mt-0.5">{employee.bloodGroup}</div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                <div className="text-[10px] text-slate-500 font-medium">কার্ড ইস্যু তারিখ</div>
                <div className="font-mono text-slate-700 mt-0.5">
                  {employee.cardIssue || '19/10/2026'}
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                <div className="text-[10px] text-slate-500 font-medium">জরুরি যোগাযোগ</div>
                <div className="font-mono text-slate-700 mt-0.5">{employee.emergencyContact}</div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 col-span-2 sm:col-span-3 md:col-span-4">
                <div className="text-[10px] text-slate-500 font-medium">স্থায়ী ঠিকানা</div>
                <div className="text-slate-800 mt-0.5 truncate">{employee.permanentAddress}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* STEP 3: এনআইডি, ছবি ও স্বাক্ষর */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
        <div className="bg-slate-50/70 border-b border-slate-100 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-full bg-[#114b3e] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
              ৩
            </div>
            <h3 className="text-xs font-bold text-slate-800">এনআইডি, ছবি ও স্বাক্ষর</h3>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-600 border border-rose-200">
            সবগুলো আবশ্যক
          </span>
        </div>

        <div className="p-5 space-y-4">
          {/* Subfield 1: কর্মচারীর এনআইডি নম্বর */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">
                কর্মচারীর এনআইডি নম্বর <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-slate-400 font-mono">
                {nationalId.length}/15 ডিজিট
              </span>
            </div>
            <div className="relative">
              <IdCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                disabled={isEntryDisabled || alreadySubmitted}
                value={nationalId}
                onChange={handleNationalIdChange}
                onPaste={handleNationalIdPaste}
                placeholder="সর্বোচ্চ ১৫ ডিজিটের নম্বর"
                className={`w-full bg-white border rounded-lg pl-10 pr-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 font-medium transition-colors disabled:opacity-50 disabled:bg-slate-50 ${
                  nidWarning
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 bg-rose-50/20'
                    : 'border-slate-200 focus:border-[#114b3e] focus:ring-1 focus:ring-[#114b3e]'
                }`}
              />
            </div>
            {nidWarning && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-semibold">আইডি কার্ডের সংখ্যা অনেক বড় হলে প্রথম চারটি সংখ্যা বাদ দিয়ে লিখুন।</span>
              </div>
            )}
          </div>

          {/* Subfield 2: কর্মচারীর ছবি (পাসপোর্ট সাইজ) */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">
                কর্মচারীর ছবি (পাসপোর্ট সাইজ)
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-50 text-rose-600 border border-rose-200">
                আবশ্যক
              </span>
            </div>

            <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
              {/* Corner Crop Frame Box */}
              <CornerCropBox className="w-28 h-32 shrink-0">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt="Employee Photo"
                    className="w-full h-full object-cover rounded"
                  />
                ) : (
                  <div className="text-center text-slate-400 py-2">
                    <User className="w-8 h-8 mx-auto mb-1 stroke-1 text-slate-300" />
                    <span className="text-[10px] block text-slate-400">ছবি নেই</span>
                  </div>
                )}
              </CornerCropBox>

              {/* Photo Action Buttons respecting supervisorPhotoCameraEnabled */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {supervisorPhotoCameraEnabled ? (
                    <button
                      type="button"
                      onClick={() => openCamera('photo')}
                      disabled={isEntryDisabled || alreadySubmitted}
                      className="px-3.5 py-2 bg-slate-600 hover:bg-slate-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shadow-2xs"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>ক্যামেরা চালু করুন</span>
                    </button>
                  ) : (
                    <span className="px-2.5 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-medium flex items-center gap-1">
                      <Upload className="w-3 h-3 text-amber-600" />
                      <span>শুধু ফাইল আপলোড (ক্যামেরা বন্ধ)</span>
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => photoFileInputRef.current?.click()}
                    disabled={isEntryDisabled || alreadySubmitted}
                    className="px-3.5 py-2 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 border border-slate-200 shadow-2xs"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    <span>ফাইল আপলোড</span>
                  </button>

                  {photoUrl && (
                    <button
                      type="button"
                      onClick={() => setPhotoUrl('')}
                      disabled={isEntryDisabled || alreadySubmitted}
                      className="px-2 py-1 text-rose-600 hover:text-rose-800 text-xs font-medium"
                    >
                      মুছুন
                    </button>
                  )}
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

          {/* Subfield 3: কর্মচারীর স্বাক্ষর (আড়াআড়ি) */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">
                কর্মচারীর স্বাক্ষর (আড়াআড়ি)
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-50 text-rose-600 border border-rose-200">
                আবশ্যক
              </span>
            </div>

            <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
              {/* Corner Crop Frame Box */}
              <CornerCropBox className="w-44 h-24 shrink-0">
                {signatureUrl ? (
                  <img
                    src={signatureUrl}
                    alt="Employee Signature"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="text-center text-slate-400 py-1 w-full">
                    <PenTool className="w-5 h-5 mx-auto mb-1 stroke-1 text-slate-300" />
                    <div className="border-b border-dashed border-slate-300 w-3/4 mx-auto mb-1" />
                    <span className="text-[10px] block text-slate-400">স্বাক্ষর নেই</span>
                  </div>
                )}
              </CornerCropBox>

              {/* Signature Action Buttons respecting toggles */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {supervisorSignatureCameraEnabled && (
                    <button
                      type="button"
                      onClick={() => openCamera('signature')}
                      disabled={isEntryDisabled || alreadySubmitted}
                      className="px-3 py-2 bg-slate-600 hover:bg-slate-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shadow-2xs"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>ক্যামেরা</span>
                    </button>
                  )}

                  {supervisorSignaturePadEnabled && (
                    <button
                      type="button"
                      onClick={() => setIsSignaturePadOpen(true)}
                      disabled={isEntryDisabled || alreadySubmitted}
                      className="px-3 py-2 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 border border-slate-200 shadow-2xs"
                    >
                      <PenTool className="w-3.5 h-3.5 text-slate-500" />
                      <span>হাতে আঁকুন</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => sigFileInputRef.current?.click()}
                    disabled={isEntryDisabled || alreadySubmitted}
                    className="px-3 py-2 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 border border-slate-200 shadow-2xs"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    <span>আপলোড</span>
                  </button>

                  {signatureUrl && (
                    <button
                      type="button"
                      onClick={() => setSignatureUrl('')}
                      disabled={isEntryDisabled || alreadySubmitted}
                      className="px-2 py-1 text-rose-600 hover:text-rose-800 text-xs font-medium"
                    >
                      মুছুন
                    </button>
                  )}
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
        </div>
      </div>

      {/* Bottom Submit Button matching reference image */}
      <div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isFormComplete || isSubmitting}
          className={`w-full py-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            isFormComplete && !isSubmitting
              ? 'bg-[#114b3e] hover:bg-[#0c392f] text-white shadow-sm cursor-pointer'
              : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
          }`}
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>জমা হচ্ছে...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4 rotate-[-20deg]" />
              <span>আইডি কার্ডের তথ্য জমা দিন</span>
            </>
          )}
        </button>
      </div>

      {/* Confirmation Popup Modal (Strictly NO ID Card Preview) */}
      {confirmationPopup.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
              <Check className="w-8 h-8 stroke-[2.5]" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">
                সফলভাবে জমা হয়েছে! (Submission Successful)
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
                <span className="font-mono font-bold text-[#114b3e]">
                  {confirmationPopup.enrollId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="font-semibold text-emerald-700">Queued for Admin Print</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCloseConfirmationPopup}
              className="w-full py-3 bg-[#114b3e] hover:bg-[#0c392f] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
            >
              <span>পরবর্তী কর্মচারীর আইডি যোগ করুন</span>
            </button>
          </div>
        </div>
      )}

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
        title={
          cameraType === 'photo'
            ? 'Employee Photo Capture (Passport Guide)'
            : 'Signature Capture (Narrow Guide)'
        }
        type={cameraType}
      />

      {/* Touch/Mouse Signature Pad Modal */}
      <SignaturePadModal
        isOpen={isSignaturePadOpen}
        onClose={() => setIsSignaturePadOpen(false)}
        onSave={async (dataUrl) => {
          try {
            const normalized = await normalizeEmployeeSignature(dataUrl);
            setSignatureUrl(normalized);
          } catch {
            setSignatureUrl(dataUrl);
          }
        }}
      />
    </div>
  );
}

// Small icon helper for shield with check
function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
