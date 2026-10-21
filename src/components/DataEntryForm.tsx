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
  Eye,
  Check,
} from 'lucide-react';
import { apiService } from '../services/apiService';
import { AuthUser, MasterEmployee, EmployeeCardData, CARD_WIDTH, CARD_HEIGHT, DEFAULT_CALIBRATION } from '../types';
import { CardFront } from './CardFront';
import { CardBack } from './CardBack';
import { FRONT_TEMPLATE_SVG, BACK_TEMPLATE_SVG } from '../data/cardTemplates';
import { CameraCaptureModal } from './CameraCaptureModal';
import { SignaturePadModal } from './SignaturePadModal';

interface DataEntryFormProps {
  frontTemplateUrl?: string;
  backTemplateUrl?: string;
  onSubmissionSuccess?: () => void;
  currentUser?: AuthUser | null;
}

export function DataEntryForm({
  frontTemplateUrl = FRONT_TEMPLATE_SVG,
  backTemplateUrl = BACK_TEMPLATE_SVG,
  onSubmissionSuccess,
  currentUser,
}: DataEntryFormProps) {
  // Search & Lookup State
  const [enrollIdInput, setEnrollIdInput] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [employee, setEmployee] = useState<MasterEmployee | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [submissionInfo, setSubmissionInfo] = useState<any | null>(null);

  // The 3 required input fields
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
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Hidden file inputs
  const photoFileInputRef = useRef<HTMLInputElement>(null);
  const sigFileInputRef = useRef<HTMLInputElement>(null);

  // Lookup employee by Enrollment ID
  const handleLookup = async (idToSearch?: string) => {
    const targetId = (idToSearch || enrollIdInput).trim();
    if (!targetId) {
      setLookupError('Please enter an Enrollment ID.');
      return;
    }

    setIsLookingUp(true);
    setLookupError(null);
    setSubmitSuccess(null);
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
        setLookupError(`Employee with Enrollment ID "${targetId}" not found in Master Database.`);
      }
    } catch (err: any) {
      setEmployee(null);
      setLookupError(
        err.message || `Employee Enrollment ID "${targetId}" was not found in Master Database.`
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

  // Image Upload Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, target: 'photo' | 'sig') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setSubmitError('Please upload a valid image file (PNG, JPG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (target === 'photo') {
        setPhotoUrl(result);
      } else {
        setSignatureUrl(result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const openCamera = (type: 'photo' | 'signature') => {
    setCameraType(type);
    setIsCameraOpen(true);
  };

  const handleCameraCapture = (dataUrl: string) => {
    if (cameraType === 'photo') {
      setPhotoUrl(dataUrl);
    } else {
      setSignatureUrl(dataUrl);
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
  };

  // Submit Data Entry Record
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) {
      setSubmitError('Please look up and select an Enrollment ID first.');
      return;
    }

    if (alreadySubmitted) {
      setSubmitError('Duplicate submissions are strictly blocked for this Enrollment ID.');
      return;
    }

    if (!nationalId.trim()) {
      setSubmitError('National ID Number is required.');
      return;
    }

    if (nationalId.trim().length > 15) {
      setSubmitError('আইডি কার্ডের সংখ্যা অনেক বড় হলে প্রথম চারটি সংখ্যা বাদ দিয়ে লিখুন।');
      setNidWarning('আইডি কার্ডের সংখ্যা অনেক বড় হলে প্রথম চারটি সংখ্যা বাদ দিয়ে লিখুন।');
      return;
    }

    if (!photoUrl) {
      setSubmitError('Employee Photo is required (upload or take snapshot).');
      return;
    }

    if (!signatureUrl) {
      setSubmitError('Employee Signature Photo is required.');
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

      handleResetForm();
      setSubmitSuccess(
        `Record successfully submitted and verified for ${empName} (Enroll ID: ${empId})! The form has been cleared and is ready for the next Enrollment ID.`
      );

      if (onSubmissionSuccess) {
        onSubmissionSuccess();
      }
    } catch (err: any) {
      console.error('Submit error:', err);
      if (err.status === 409 || err.message?.includes('Already submitted')) {
        setAlreadySubmitted(true);
        setSubmitError(
          err.message || 'Already submitted for this Enrollment ID. Duplicate submissions are strictly blocked.'
        );
      } else {
        setSubmitError(err.message || 'Failed to submit record. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Construct card preview object
  const previewCardData: EmployeeCardData | null = employee
    ? {
        id: `preview-${employee.enrollId}`,
        name: employee.name,
        designation: employee.designation,
        department: employee.department,
        jobType: employee.jobType,
        joiningDate: employee.joiningDate,
        enrollId: employee.enrollId,
        cardIssue: employee.cardIssue,
        photoUrl: photoUrl || undefined,
        permanentAddress: employee.permanentAddress,
        emergencyContact: employee.emergencyContact,
        nationalId: nationalId || employee.nationalId || 'NID-PENDING',
        bloodGroup: employee.bloodGroup,
        signatureUrl: signatureUrl || undefined,
        isValid: Boolean(nationalId && photoUrl && signatureUrl),
      }
    : null;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Banner & Quick Explanation */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
              Data Entry Portal
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Employee Data Entry &amp; ID Verification Form
            </h2>
          </div>
          <p className="text-xs text-slate-600 max-w-2xl">
            Enter an Enrollment ID to retrieve master employee details. Once verified, submit the three required fields (National ID, Employee Photo, and Signature Photo).
          </p>
        </div>

        <button
          type="button"
          onClick={handleResetForm}
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 self-start sm:self-auto transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Clear Form / Next ID</span>
        </button>
      </div>

      {/* Success Notification */}
      {submitSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs flex items-start gap-3 shadow-xs animate-in fade-in">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-emerald-900 mb-0.5">Submission Completed!</h4>
            <p className="leading-relaxed">{submitSuccess}</p>
          </div>
          <button
            onClick={() => setSubmitSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Step 1: Enrollment ID Lookup Box */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
          Step 1: Enter Employee Enrollment ID
        </label>
        <div className="flex flex-col sm:flex-row gap-2 max-w-xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={enrollIdInput}
              onChange={(e) => setEnrollIdInput(e.target.value)}
              onKeyDown={handleKeyDownEnrollId}
              placeholder="e.g. 586665, 586666, 586667..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:bg-white font-mono"
            />
          </div>
          <button
            type="button"
            disabled={isLookingUp}
            onClick={() => handleLookup()}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2"
          >
            {isLookingUp ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Searching...</span>
              </>
            ) : (
              <>
                <Search className="w-3.5 h-3.5" />
                <span>Lookup &amp; Verify</span>
              </>
            )}
          </button>
        </div>

        {/* Quick sample chips */}
        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-slate-500 font-medium">Quick Demo IDs:</span>
          {['586665', '586666', '586667'].map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setEnrollIdInput(id);
                handleLookup(id);
              }}
              className="px-2.5 py-1 bg-slate-100 hover:bg-rose-50 hover:border-rose-200 border border-slate-200 text-slate-700 rounded-lg text-xs font-mono font-medium transition-colors"
            >
              {id}
            </button>
          ))}
        </div>

        {/* Lookup Error Message */}
        {lookupError && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">{lookupError}</div>
          </div>
        )}

        {/* Duplicate Warning Alert */}
        {alreadySubmitted && submissionInfo && (
          <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-bold text-amber-950 mb-0.5">
                Already Submitted &amp; Protected!
              </h4>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                This Enrollment ID was already submitted on{' '}
                <strong className="text-slate-900">
                  {new Date(submissionInfo.submittedAt).toLocaleDateString()}
                </strong>{' '}
                by <strong className="text-slate-900">{submissionInfo.submittedBy}</strong>. Duplicate submissions are strictly blocked.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Read-Only Master Record Display */}
      {employee && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-rose-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Step 2: Master Employee Information (Read-Only)
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
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Enrollment ID</div>
              <div className="font-mono font-bold text-rose-600 mt-0.5">{employee.enrollId}</div>
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

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 col-span-2">
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

      {/* Step 3: Enter the 3 Required Fields */}
      {employee && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 Columns: The 3 Inputs */}
            <div className="lg:col-span-7 space-y-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="border-b border-slate-100 pb-2.5 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Step 3: Enter Required Information
                </h3>
                <span className="text-[10px] text-rose-600 font-semibold">* All 3 fields mandatory</span>
              </div>

              {submitError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Field 1: National ID Number */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-800 flex items-center justify-between">
                  <span>1. National ID Card (NID) Number *</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {nationalId.length}/15 ডিজিট
                  </span>
                </label>
                <div className="relative">
                  <IdCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={nationalId}
                    onChange={handleNationalIdChange}
                    onPaste={handleNationalIdPaste}
                    placeholder="সর্বোচ্চ ১৫ ডিজিটের নম্বর (e.g. 5912345678)"
                    disabled={alreadySubmitted}
                    className={`w-full bg-slate-50 border rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 font-mono transition-colors disabled:opacity-50 ${
                      nidWarning
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 bg-rose-50/20'
                        : 'border-slate-300 focus:bg-white focus:border-rose-600'
                    }`}
                  />
                </div>
                {nidWarning && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span className="font-semibold">আইডি কার্ডের সংখ্যা অনেক বড় হলে প্রথম চারটি সংখ্যা বাদ দিয়ে লিখুন।</span>
                  </div>
                )}
              </div>

              {/* Field 2: Employee Photo Upload / Camera */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-rose-600" />
                    <span>2. Employee Photo *</span>
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
                  {/* Thumbnail */}
                  <div className="w-20 h-24 rounded-xl bg-white border border-slate-300 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                    {photoUrl ? (
                      <img src={photoUrl} alt="Employee" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-8 h-8 text-slate-300" />
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => openCamera('photo')}
                        disabled={alreadySubmitted}
                        className="px-3 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs"
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
                        <span>Upload File</span>
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
                    <p className="text-[10px] text-slate-500 leading-tight">
                      Passport framing guide helps position face and shoulders correctly.
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

              {/* Field 3: Employee Signature Photo / Draw Pad / Camera */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <PenTool className="w-3.5 h-3.5 text-rose-600" />
                    <span>3. Employee Signature Photo *</span>
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
                  {/* Thumbnail */}
                  <div className="w-28 h-16 rounded-xl bg-white border border-slate-300 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs p-1">
                    {signatureUrl ? (
                      <img src={signatureUrl} alt="Signature" className="w-full h-full object-contain" />
                    ) : (
                      <PenTool className="w-5 h-5 text-slate-300" />
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setIsSignaturePadOpen(true)}
                        disabled={alreadySubmitted}
                        className="px-3 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs"
                      >
                        <PenTool className="w-3.5 h-3.5" />
                        <span>Draw on Touchpad</span>
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

                      <button
                        type="button"
                        onClick={() => openCamera('signature')}
                        disabled={alreadySubmitted}
                        className="px-3 py-2 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 border border-slate-300"
                      >
                        <Camera className="w-3.5 h-3.5 text-slate-500" />
                        <span>Camera</span>
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
                  className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving Data Entry Record...</span>
                    </>
                  ) : alreadySubmitted ? (
                    <>
                      <ShieldAlert className="w-4 h-4" />
                      <span>Already Submitted (Duplicate Blocked)</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Submit Verified Employee Record</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right 5 Columns: Real-Time Preview for Operator/Admin */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col items-center">
              <div className="w-full border-b border-slate-100 pb-2.5 mb-4 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-rose-600" />
                  <span>Preview ID Card</span>
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">54 × 86 mm</span>
              </div>

              {previewCardData && (
                <div className="flex flex-col items-center gap-5">
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Card Front (Portrait)
                    </span>
                    <div
                      className="rounded-xl overflow-hidden shadow-lg border border-slate-300 bg-white"
                      style={{
                        width: `${CARD_WIDTH * 2.8}px`,
                        height: `${CARD_HEIGHT * 2.8}px`,
                      }}
                    >
                      <CardFront
                        employee={previewCardData}
                        templateUrl={frontTemplateUrl}
                        calibration={DEFAULT_CALIBRATION.front}
                        scale={0.49}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Card Back (Portrait)
                    </span>
                    <div
                      className="rounded-xl overflow-hidden shadow-lg border border-slate-300 bg-white"
                      style={{
                        width: `${CARD_WIDTH * 2.8}px`,
                        height: `${CARD_HEIGHT * 2.8}px`,
                      }}
                    >
                      <CardBack
                        employee={previewCardData}
                        templateUrl={backTemplateUrl}
                        calibration={DEFAULT_CALIBRATION.back}
                        scale={0.49}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>
      )}

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
        title={cameraType === 'photo' ? 'Employee Photo Capture (Passport Guide)' : 'Signature Capture'}
        type={cameraType}
      />

      {/* Signature Pad Modal */}
      <SignaturePadModal
        isOpen={isSignaturePadOpen}
        onClose={() => setIsSignaturePadOpen(false)}
        onSave={(dataUrl) => setSignatureUrl(dataUrl)}
      />
    </div>
  );
}
