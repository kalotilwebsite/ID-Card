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
  const [photoUrl, setPhotoUrl] = useState('');
  const [signatureUrl, setSignatureUrl] = useState('');

  // Modals & Capture State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraType, setCameraType] = useState<'photo' | 'signature'>('photo');
  const [isSignaturePadOpen, setIsSignaturePadOpen] = useState(false);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Bangla Size Alert Modal State
  const [isSizeAlertOpen, setIsSizeAlertOpen] = useState(false);

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

  // Configured success message from Admin Settings
  const [adminConfiguredMessage, setAdminConfiguredMessage] = useState(
    'Employee ID Card data has been submitted successfully and queued for administrative review and printing. Thank you!'
  );

  // Form status state
  const [formEnabled, setFormEnabled] = useState(true);
  const [disabledMessage, setDisabledMessage] = useState(
    'Employee ID Card submission is temporarily closed by the administrator. Please check back later.'
  );

  // Hidden file inputs
  const photoFileInputRef = useRef<HTMLInputElement>(null);
  const sigFileInputRef = useRef<HTMLInputElement>(null);
  const enrollInputRef = useRef<HTMLInputElement>(null);

  // Fetch admin configured settings on mount
  useEffect(() => {
    const fetchPublicSettings = async () => {
      try {
        const settings = await apiService.getPublicSettings();
        if (settings) {
          if (settings.supervisorSuccessMessage) {
            setAdminConfiguredMessage(settings.supervisorSuccessMessage);
          }
          if (settings.supervisorFormEnabled !== undefined) {
            setFormEnabled(settings.supervisorFormEnabled);
          }
          if (settings.supervisorFormDisabledMessage) {
            setDisabledMessage(settings.supervisorFormDisabledMessage);
          }
        }
      } catch (e) {
        // Fallback to default
      }
    };
    fetchPublicSettings();
  }, []);

  // Lookup employee by Enrollment Number
  const handleLookup = async (idToSearch?: string) => {
    const targetId = (idToSearch || enrollIdInput).trim();
    if (!targetId) {
      setLookupError('Please enter an Employee Enrollment Number.');
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
        } else {
          setNationalId('');
        }
        setPhotoUrl('');
        setSignatureUrl('');
      } else {
        setEmployee(null);
        setLookupError(`Employee with Enrollment Number "${targetId}" not found in Master Database.`);
      }
    } catch (err: any) {
      setEmployee(null);
      setLookupError(
        err.message || `Employee Enrollment Number "${targetId}" was not found in Master Database.`
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

  // Image Upload Handlers with Automatic Client-Side Compression & 1MB Validation
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, target: 'photo' | 'sig') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setSubmitError('Please upload a valid image file (PNG, JPG, WebP).');
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
    } catch (err: any) {
      console.error('Image compression error:', err);
      setSubmitError('Failed to process image file. Please try another image.');
    } finally {
      e.target.value = '';
    }
  };

  const openCamera = (type: 'photo' | 'signature') => {
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
    setEnrollIdInput('');
    setEmployee(null);
    setAlreadySubmitted(false);
    setSubmissionInfo(null);
    setNationalId('');
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
    if (!employee) {
      setSubmitError('Please look up and select an Employee Enrollment Number first.');
      return;
    }

    if (alreadySubmitted) {
      setSubmitError('Duplicate submissions are strictly blocked for this Enrollment Number.');
      return;
    }

    if (!nationalId.trim()) {
      setSubmitError('National ID Card Number is required.');
      return;
    }

    if (!photoUrl) {
      setSubmitError('Employee Photo is required (upload from device or use camera).');
      return;
    }

    if (!signatureUrl) {
      setSubmitError('Employee Signature Photo is required (upload, draw on pad, or use camera).');
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

      // STRICT REQUIREMENT 6: Show only a simple confirmation popup message.
      // Under NO circumstances render, preview, or show the card design or layout!
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
      }
      if (err.status === 409 || err.message?.includes('Already submitted')) {
        setAlreadySubmitted(true);
        setSubmitError(
          err.message || 'Already submitted for this Enrollment Number. Duplicate submissions are strictly blocked.'
        );
      } else {
        setSubmitError(err.message || 'Failed to submit record. Please try again.');
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

  if (currentUser?.role === 'supervisor' && !formEnabled) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white border border-slate-200 rounded-xl text-center space-y-3 shadow-xs">
        <h2 className="text-base font-bold text-slate-900">Form Closed</h2>
        <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">{disabledMessage}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
      {/* Clean Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900">Data Entry → Add New Employee ID Card</h2>
        <button
          type="button"
          onClick={handleResetForm}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Form</span>
        </button>
      </div>

      {/* Error Notification */}
      {submitError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-start gap-3 shadow-xs animate-in fade-in">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-rose-900 mb-0.5">Submission Blocked</h4>
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

      {/* STEP 1: Employee Enrollment Number Lookup */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <Search className="w-4 h-4 text-purple-600" />
            <span>1. Enter Employee Enrollment Number</span>
          </label>
          <span className="text-[11px] text-slate-500">Master database key</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <IdCard className="w-4 h-4 text-purple-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              ref={enrollInputRef}
              type="text"
              value={enrollIdInput}
              onChange={(e) => setEnrollIdInput(e.target.value)}
              onKeyDown={handleKeyDownEnrollId}
              placeholder="e.g. 586665, 586666, 586667..."
              className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-purple-600 focus:ring-1 focus:ring-purple-600 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 font-mono transition-colors"
              autoFocus
            />
          </div>

          <button
            type="button"
            onClick={() => handleLookup()}
            disabled={isLookingUp}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 shrink-0"
          >
            {isLookingUp ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Searching...</span>
              </>
            ) : (
              <>
                <Search className="w-3.5 h-3.5" />
                <span>Verify Employee</span>
              </>
            )}
          </button>
        </div>

        {/* Quick Sample IDs */}
        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-slate-500 font-medium">Quick Test IDs:</span>
          {['586665', '586666', '586667'].map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setEnrollIdInput(id);
                handleLookup(id);
              }}
              className="px-2.5 py-1 bg-slate-100 hover:bg-purple-50 hover:border-purple-300 border border-slate-200 text-purple-700 rounded-lg text-xs font-mono font-medium transition-colors"
            >
              {id}
            </button>
          ))}
        </div>

        {/* Lookup Error */}
        {lookupError && (
          <div className="mt-3 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{lookupError}</div>
          </div>
        )}

        {/* Duplicate Warning Alert */}
        {alreadySubmitted && submissionInfo && (
          <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-bold text-amber-950 mb-0.5">
                Already Submitted &amp; Protected!
              </h4>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                This Enrollment ID was already submitted on{' '}
                <strong className="text-slate-900">
                  {new Date(submissionInfo.submittedAt).toLocaleDateString()} at{' '}
                  {new Date(submissionInfo.submittedAt).toLocaleTimeString()}
                </strong>{' '}
                by <strong className="text-slate-900">{submissionInfo.submittedBy}</strong>. Duplicate submissions are strictly prevented.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* STEP 2: Read-Only Master Record Display */}
      {employee && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                2. Master Employee Record (Read-Only From Database)
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Verified in Database
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Full Name</div>
              <div className="font-bold text-slate-900 mt-0.5 truncate">{employee.name}</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                <Briefcase className="w-3 h-3 text-slate-500" /> Designation
              </div>
              <div className="font-semibold text-slate-800 mt-0.5 truncate">{employee.designation}</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                <Building className="w-3 h-3 text-slate-500" /> Department
              </div>
              <div className="font-semibold text-slate-800 mt-0.5 truncate">{employee.department}</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Enrollment No.</div>
              <div className="font-mono font-bold text-purple-700 mt-0.5">{employee.enrollId}</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-500" /> Joining Date
              </div>
              <div className="font-mono text-slate-700 mt-0.5">{employee.joiningDate}</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                <Droplet className="w-3 h-3 text-rose-600" /> Blood Group
              </div>
              <div className="font-bold text-rose-700 mt-0.5">{employee.bloodGroup}</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-500" /> Card Issue Date
              </div>
              <div className="font-mono text-slate-700 mt-0.5">{employee.cardIssue || '19/10/2026'}</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                <Phone className="w-3 h-3 text-slate-500" /> Emergency Contact
              </div>
              <div className="font-mono text-slate-700 mt-0.5">{employee.emergencyContact}</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 col-span-2 sm:col-span-3 md:col-span-4">
              <div className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-500" /> Permanent Address
              </div>
              <div className="text-slate-800 mt-0.5 truncate">{employee.permanentAddress}</div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Input Fields (NID, Photo, Signature) & Submission */}
      {employee && (
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-purple-600" />
              <span>3. Enter Employee National ID, Photo &amp; Signature</span>
            </h3>
            <span className="text-[11px] text-purple-700 font-semibold">* All 3 items mandatory</span>
          </div>

          {/* Field 1: National ID Number */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-800 flex items-center justify-between">
              <span>Employee National ID (NID) Card Number *</span>
              <span className="text-[10px] text-slate-500 font-normal">Smart NID or Old NID</span>
            </label>
            <div className="relative">
              <IdCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                placeholder="e.g. 19852691234567890 or 5912345678"
                disabled={alreadySubmitted}
                className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-purple-600 focus:ring-1 focus:ring-purple-600 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 font-mono transition-colors disabled:opacity-50"
              />
            </div>
          </div>

          {/* Field 2: Employee Photo Capture & Review */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-purple-600" />
                <span>Employee Photo (Passport Portrait) *</span>
              </label>
              {photoUrl ? (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-600" /> Photo Attached
                </span>
              ) : (
                <span className="text-[10px] text-rose-600 font-semibold">Required</span>
              )}
            </div>

            <div className="flex items-center gap-4">
              {/* Photo Review Thumbnail */}
              <div className="w-24 h-32 rounded-xl bg-white border border-slate-300 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt="Employee Photo Review"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center p-2 text-slate-400">
                    <User className="w-8 h-8 mx-auto mb-1 opacity-50" />
                    <span className="text-[9px] block">No Photo</span>
                  </div>
                )}
              </div>

              {/* Photo Actions */}
              <div className="flex-1 space-y-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => openCamera('photo')}
                    disabled={alreadySubmitted}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Live Camera (Passport Guide)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => photoFileInputRef.current?.click()}
                    disabled={alreadySubmitted}
                    className="px-3 py-2 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 border border-slate-300"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    <span>Upload Image File</span>
                  </button>

                  {photoUrl && (
                    <button
                      type="button"
                      onClick={() => setPhotoUrl('')}
                      disabled={alreadySubmitted}
                      className="px-2.5 py-2 text-rose-600 hover:text-rose-800 text-xs font-semibold"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Capture directly using device camera with official passport framing guide, or upload a clear portrait photo. Review the image in the box on the left before submitting.
                </p>
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

          {/* Field 3: Employee Signature Capture & Review */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <PenTool className="w-3.5 h-3.5 text-purple-600" />
                <span>Employee Signature Photo (Horizontal) *</span>
              </label>
              {signatureUrl ? (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-600" /> Signature Attached
                </span>
              ) : (
                <span className="text-[10px] text-rose-600 font-semibold">Required</span>
              )}
            </div>

            <div className="flex items-center gap-4">
              {/* Signature Review Thumbnail */}
              <div className="w-36 h-20 rounded-xl bg-white border border-slate-300 flex items-center justify-center overflow-hidden shrink-0 shadow-xs p-1">
                {signatureUrl ? (
                  <img
                    src={signatureUrl}
                    alt="Signature Review"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="text-center text-slate-400">
                    <PenTool className="w-5 h-5 mx-auto mb-0.5 opacity-50" />
                    <span className="text-[9px]">No Signature</span>
                  </div>
                )}
              </div>

              {/* Signature Actions */}
              <div className="flex-1 space-y-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => openCamera('signature')}
                    disabled={alreadySubmitted}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Camera Capture (Narrow Box)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSignaturePadOpen(true)}
                    disabled={alreadySubmitted}
                    className="px-3 py-2 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 border border-slate-300"
                  >
                    <PenTool className="w-3.5 h-3.5 text-purple-600" />
                    <span>Touchpad Draw</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => sigFileInputRef.current?.click()}
                    disabled={alreadySubmitted}
                    className="px-3 py-2 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 border border-slate-300"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    <span>Upload File</span>
                  </button>

                  {signatureUrl && (
                    <button
                      type="button"
                      onClick={() => setSignatureUrl('')}
                      disabled={alreadySubmitted}
                      className="px-2.5 py-2 text-rose-600 hover:text-rose-800 text-xs font-semibold"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Capture paper signature with camera, draw directly using touchscreen/mouse, or upload an image scan. Review the signature on the left before submitting.
                </p>
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
              disabled={isSubmitting || alreadySubmitted || !nationalId.trim() || !photoUrl || !signatureUrl}
              className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving Employee ID Card Record...</span>
                </>
              ) : alreadySubmitted ? (
                <>
                  <ShieldAlert className="w-4 h-4" />
                  <span>Already Submitted (Duplicate Blocked)</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit Employee ID Card Data</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* STRICT REQUIREMENT 6: Supervisor Confirmation Popup Modal (NO ID CARD PREVIEW) */}
      {confirmationPopup.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
              <Check className="w-8 h-8 stroke-[2.5]" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">
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
                <span className="font-mono font-bold text-purple-700">{confirmationPopup.enrollId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="font-semibold text-emerald-700">Queued for Admin Print</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCloseConfirmationPopup}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
            >
              <span>Add Next Employee ID Card</span>
            </button>
          </div>
        </div>
      )}

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
        title={cameraType === 'photo' ? 'Employee Photo Capture (Passport Guide)' : 'Signature Capture (Narrow Guide)'}
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
