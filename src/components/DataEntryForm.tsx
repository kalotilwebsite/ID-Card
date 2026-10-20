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

  // Auto-search or search trigger
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
        // Pre-fill nationalId if exists on master record
        if (res.employee.nationalId) {
          setNationalId(res.employee.nationalId);
        } else {
          setNationalId('');
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
        err.message || `Enrollment ID "${targetId}" was not found in the Master Employee Database.`
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
    // Reset file input so same file can be selected again
    e.target.value = '';
  };

  // Camera Open
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
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) {
      setSubmitError('Please look up and select an employee first.');
      return;
    }

    if (alreadySubmitted) {
      setSubmitError('Duplicate submissions are strictly prohibited for this Enrollment ID.');
      return;
    }

    if (!nationalId.trim()) {
      setSubmitError('National ID Number is required.');
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

      // Clear the form and show pristine success state ready for next Enrollment ID
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
      <div className={`border rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        currentUser?.role === 'supervisor'
          ? 'bg-gradient-to-r from-purple-950/60 via-slate-950 to-slate-950 border-purple-800/40'
          : 'bg-slate-950 border-slate-800'
      }`}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            {currentUser?.role === 'supervisor' ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                <Briefcase className="w-3 h-3" /> Supervisor Access Portal
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                Authorized Portal
              </span>
            )}
            <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
              {currentUser?.role === 'supervisor'
                ? 'Supervisor ID Card Submission Form'
                : 'Employee Data Entry & ID Verification Form'}
            </h2>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl">
            {currentUser?.role === 'supervisor'
              ? `Logged in as Supervisor ${currentUser.name} (Employee ID: ${currentUser.employeeId || currentUser.username}). Enter employee enrollment number, verify details, and upload/capture employee photo, signature photo, and National ID Card number.`
              : 'Enter an Enrollment ID to retrieve master employee details. Once verified, submit the three required fields (National ID, Employee Photo, and Signature Photo).'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleResetForm}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-2 self-start sm:self-auto transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Clear Form / Next ID</span>
        </button>
      </div>

      {/* Success Notification */}
      {submitSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-200 text-xs flex items-start gap-3 shadow-md animate-in fade-in">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-emerald-300 mb-0.5">Submission Completed!</h4>
            <p className="leading-relaxed">{submitSuccess}</p>
          </div>
          <button
            onClick={() => setSubmitSuccess(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Step 1: Enrollment ID Lookup Box */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-md">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
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
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 font-mono"
            />
          </div>
          <button
            type="button"
            disabled={isLookingUp}
            onClick={() => handleLookup()}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-950/40 flex items-center justify-center gap-2"
          >
            {isLookingUp ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Searching...</span>
              </>
            ) : (
              <>
                <Search className="w-3.5 h-3.5" />
                <span>Retrieve Employee</span>
              </>
            )}
          </button>
        </div>

        {/* Lookup Error */}
        {lookupError && (
          <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-start gap-2 max-w-xl">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{lookupError}</span>
          </div>
        )}

        {/* Duplicate Submission Warning */}
        {alreadySubmitted && (
          <div className="mt-3 p-4 bg-amber-500/10 border border-amber-500/40 rounded-xl text-amber-200 text-xs flex items-start gap-3 shadow-md max-w-2xl">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-amber-300 text-sm mb-1">
                Already Submitted For This Enrollment ID
              </h4>
              <p className="leading-relaxed">
                This employee record has already been submitted in the system. Duplicate entries are
                strictly blocked to prevent duplicate ID cards.
              </p>
              {submissionInfo && (
                <div className="mt-2 text-[11px] text-amber-300/80 font-mono">
                  Submitted on {new Date(submissionInfo.submittedAt).toLocaleString()} by{' '}
                  <span className="font-semibold text-white">{submissionInfo.submittedBy}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Grid: Data Entry Form + Live Card Preview */}
      {employee && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (7 cols): Read-Only Master Details & Required 3 Fields */}
          <div className="lg:col-span-7 space-y-6">
            {/* Read-Only Master Employee Data Summary */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-md">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-rose-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Master Employee Record (Read-Only)
                  </h3>
                </div>
                <span className="text-[11px] font-mono font-bold bg-slate-800 text-rose-300 px-2 py-0.5 rounded-lg border border-slate-700">
                  ID: {employee.enrollId}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                    Full Name
                  </div>
                  <div className="text-white font-bold mt-0.5 truncate">{employee.name}</div>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                    Designation
                  </div>
                  <div className="text-slate-200 font-semibold mt-0.5 truncate">
                    {employee.designation}
                  </div>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                    Department
                  </div>
                  <div className="text-slate-200 font-semibold mt-0.5 truncate">
                    {employee.department}
                  </div>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                    Job Type
                  </div>
                  <div className="text-slate-300 mt-0.5">{employee.jobType || 'Permanent'}</div>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                    Joining Date
                  </div>
                  <div className="text-slate-300 font-mono mt-0.5">{employee.joiningDate}</div>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                    Blood Group
                  </div>
                  <div className="text-rose-400 font-bold mt-0.5">{employee.bloodGroup}</div>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80 col-span-2">
                  <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                    Permanent Address
                  </div>
                  <div className="text-slate-300 mt-0.5 truncate">{employee.permanentAddress}</div>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                    Emergency Contact
                  </div>
                  <div className="text-slate-300 font-mono mt-0.5">
                    {employee.emergencyContact}
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: The 3 Required Additional Fields */}
            <form onSubmit={handleSubmit} className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-md space-y-5">
              <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400">
                  Step 2: Required Additional Information (3 Fields)
                </h3>
                <span className="text-[10px] text-slate-400 font-medium">All 3 fields required</span>
              </div>

              {submitError && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-start gap-2.5 shadow">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* 1. National ID Number */}
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5 flex items-center gap-1.5">
                  <IdCard className="w-4 h-4 text-rose-400" />
                  <span>1. National ID (NID) Number *</span>
                </label>
                <input
                  type="text"
                  disabled={alreadySubmitted}
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value)}
                  placeholder="e.g. 19942692015000123 or Smart NID"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 font-mono disabled:opacity-50"
                  required
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Appears on the back side of the employee ID card.
                </p>
              </div>

              {/* 2. Employee Photo */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-rose-400" />
                    <span>2. Employee Photo *</span>
                  </label>
                  {photoUrl && (
                    <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Ready
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  {/* Photo Preview Box */}
                  <div className="w-full h-40 bg-slate-900 border-2 border-dashed border-slate-700 rounded-xl flex items-center justify-center overflow-hidden relative group">
                    {photoUrl ? (
                      <>
                        <img
                          src={photoUrl}
                          alt="Employee Photo"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setPhotoUrl('')}
                          disabled={alreadySubmitted}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-rose-300 text-xs font-bold"
                        >
                          Change / Remove
                        </button>
                      </>
                    ) : (
                      <div className="text-center p-3 text-slate-500">
                        <User className="w-8 h-8 mx-auto mb-1.5 opacity-40" />
                        <span className="text-[11px]">No Photo Selected</span>
                      </div>
                    )}
                  </div>

                  {/* Photo Capture Buttons */}
                  <div className="space-y-2">
                    <input
                      type="file"
                      ref={photoFileInputRef}
                      onChange={(e) => handleFileChange(e, 'photo')}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={alreadySubmitted}
                      onClick={() => photoFileInputRef.current?.click()}
                      className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors border border-slate-700"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload from Device</span>
                    </button>

                    <button
                      type="button"
                      disabled={alreadySubmitted}
                      onClick={() => openCamera('photo')}
                      className="w-full py-2 px-3 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 disabled:opacity-50 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Direct Camera (Passport Guide)</span>
                    </button>

                    <p className="text-[10px] text-slate-500">
                      Passport framing guide helps align portrait photo with standard dimensions.
                    </p>
                  </div>
                </div>
              </div>

              {/* 3. Employee Signature Photo */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <PenTool className="w-4 h-4 text-sky-400" />
                    <span>3. Employee Signature Photo *</span>
                  </label>
                  {signatureUrl && (
                    <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Ready
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  {/* Signature Preview Box */}
                  <div className="w-full h-28 bg-white border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center overflow-hidden relative group p-2">
                    {signatureUrl ? (
                      <>
                        <img
                          src={signatureUrl}
                          alt="Signature"
                          className="max-h-full max-w-full object-contain"
                        />
                        <button
                          type="button"
                          onClick={() => setSignatureUrl('')}
                          disabled={alreadySubmitted}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold"
                        >
                          Change / Remove
                        </button>
                      </>
                    ) : (
                      <div className="text-center p-2 text-slate-400">
                        <PenTool className="w-6 h-6 mx-auto mb-1 opacity-40 text-slate-400" />
                        <span className="text-[11px]">No Signature Added</span>
                      </div>
                    )}
                  </div>

                  {/* Signature Buttons */}
                  <div className="space-y-1.5">
                    <input
                      type="file"
                      ref={sigFileInputRef}
                      onChange={(e) => handleFileChange(e, 'sig')}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={alreadySubmitted}
                      onClick={() => sigFileInputRef.current?.click()}
                      className="w-full py-1.5 px-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors border border-slate-700"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Signature Image</span>
                    </button>

                    <button
                      type="button"
                      disabled={alreadySubmitted}
                      onClick={() => openCamera('signature')}
                      className="w-full py-1.5 px-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors border border-slate-700"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Take Signature Photo</span>
                    </button>

                    <button
                      type="button"
                      disabled={alreadySubmitted}
                      onClick={() => setIsSignaturePadOpen(true)}
                      className="w-full py-1.5 px-3 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 disabled:opacity-50 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                    >
                      <PenTool className="w-3.5 h-3.5" />
                      <span>Draw on Digital Pad</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                <div className="text-[11px] text-slate-400">
                  {alreadySubmitted ? (
                    <span className="text-amber-400 font-bold">Submission blocked: Already recorded</span>
                  ) : !photoUrl || !signatureUrl || !nationalId ? (
                    <span className="text-slate-400">Please complete all 3 items above</span>
                  ) : (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> All required fields completed
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={alreadySubmitted || isSubmitting || !photoUrl || !signatureUrl || !nationalId}
                  className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-950/50 transition-all flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving Record...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Submit &amp; Save Employee Data</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Right Column (5 cols): Live Real-Time ID Card Preview */}
          <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-md flex flex-col items-center">
            <div className="w-full flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-rose-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Real-Time ID Card Preview
                </h3>
              </div>
              <span className="text-[10px] text-slate-400">Front &amp; Back</span>
            </div>

            {previewCardData && (
              <div className="flex flex-col sm:flex-row lg:flex-col items-center justify-center gap-6 py-2">
                {/* Front Side */}
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Front Side (Official)
                  </span>
                  <div
                    style={{ width: CARD_WIDTH * 0.78, height: CARD_HEIGHT * 0.78 }}
                    className="relative shadow-2xl rounded-2xl overflow-hidden border border-slate-700/60"
                  >
                    <CardFront
                      employee={previewCardData}
                      templateUrl={frontTemplateUrl}
                      calibration={DEFAULT_CALIBRATION.front}
                      scale={0.78}
                    />
                  </div>
                </div>

                {/* Back Side */}
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Back Side (NID &amp; Details)
                  </span>
                  <div
                    style={{ width: CARD_WIDTH * 0.78, height: CARD_HEIGHT * 0.78 }}
                    className="relative shadow-2xl rounded-2xl overflow-hidden border border-slate-700/60"
                  >
                    <CardBack
                      employee={previewCardData}
                      templateUrl={backTemplateUrl}
                      calibration={DEFAULT_CALIBRATION.back}
                      scale={0.78}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
        title={cameraType === 'photo' ? 'Employee Photo Capture' : 'Signature Capture'}
        type={cameraType}
      />

      {/* Signature Pad Modal */}
      <SignaturePadModal
        isOpen={isSignaturePadOpen}
        onClose={() => setIsSignaturePadOpen(false)}
        onSave={(url) => setSignatureUrl(url)}
      />
    </div>
  );
}
