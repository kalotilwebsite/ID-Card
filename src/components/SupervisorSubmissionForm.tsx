import React, { useState, useRef } from 'react';
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
  Shield,
  FileCheck,
} from 'lucide-react';
import { apiService } from '../services/apiService';
import { AuthUser, MasterEmployee, EmployeeCardData, CARD_WIDTH, CARD_HEIGHT, DEFAULT_CALIBRATION } from '../types';
import { CardFront } from './CardFront';
import { CardBack } from './CardBack';
import { FRONT_TEMPLATE_SVG, BACK_TEMPLATE_SVG } from '../data/cardTemplates';
import { CameraCaptureModal } from './CameraCaptureModal';
import { SignaturePadModal } from './SignaturePadModal';

interface SupervisorSubmissionFormProps {
  currentUser?: AuthUser | null;
  frontTemplateUrl?: string;
  backTemplateUrl?: string;
  onSubmissionSuccess?: () => void;
}

export function SupervisorSubmissionForm({
  currentUser,
  frontTemplateUrl = FRONT_TEMPLATE_SVG,
  backTemplateUrl = BACK_TEMPLATE_SVG,
  onSubmissionSuccess,
}: SupervisorSubmissionFormProps) {
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

  // Lookup employee by Enrollment Number
  const handleLookup = async (idToSearch?: string) => {
    const targetId = (idToSearch || enrollIdInput).trim();
    if (!targetId) {
      setLookupError('Please enter an Employee Enrollment Number.');
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
        `Supervisor record successfully submitted and saved for ${empName} (Enrollment No: ${empId})! The form has been cleared and is ready for the next Employee Enrollment Number.`
      );

      if (onSubmissionSuccess) {
        onSubmissionSuccess();
      }
    } catch (err: any) {
      console.error('Supervisor submit error:', err);
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

  // Construct card preview
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
      {/* Top Banner with Supervisor Identity */}
      <div className="bg-slate-950 border border-purple-900/50 rounded-2xl p-5 shadow-xl bg-gradient-to-r from-purple-950/30 via-slate-950 to-indigo-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
              <Briefcase className="w-3 h-3 text-purple-400" />
              Supervisor Portal
            </span>
            {currentUser && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1 font-mono">
                <IdCard className="w-3 h-3 text-purple-400" />
                Supervisor ID: {currentUser.employeeId || currentUser.username}
              </span>
            )}
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              Verified Session
            </span>
          </div>

          <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
            <span>Supervisor ID Card Submission Form</span>
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl mt-0.5">
            Authenticate employees by their <strong className="text-purple-300">Enrollment Number</strong>, verify master database records, and submit the 3 required items: <strong className="text-slate-200">National ID Card Number</strong>, <strong className="text-slate-200">Employee Photo</strong>, and <strong className="text-slate-200">Employee Signature</strong>.
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

      {/* Access Restriction Notice */}
      <div className="bg-purple-950/20 border border-purple-800/30 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-purple-300/90">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-purple-400 shrink-0" />
          <span>
            <strong>Role Enforcement:</strong> Supervisors have exclusive access to this submission form. Master database management, user accounts, and card printing remain restricted to administrators.
          </span>
        </div>
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

      {/* Error Notification */}
      {submitError && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-200 text-xs flex items-start gap-3 shadow-md animate-in fade-in">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-rose-300 mb-0.5">Submission Blocked</h4>
            <p className="leading-relaxed">{submitError}</p>
          </div>
          <button
            onClick={() => setSubmitError(null)}
            className="text-rose-400 hover:text-rose-200 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* STEP 1: Employee Enrollment Number Lookup */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-md">
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Search className="w-4 h-4 text-purple-400" />
            <span>1. Enter Employee Enrollment Number</span>
          </label>
          <span className="text-[11px] text-slate-500">Unique lookup key</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <IdCard className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={enrollIdInput}
              onChange={(e) => setEnrollIdInput(e.target.value)}
              onKeyDown={handleKeyDownEnrollId}
              placeholder="e.g. 586665, 586666, 586667..."
              className="w-full bg-slate-900 border border-slate-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 font-mono transition-colors"
            />
          </div>

          <button
            type="button"
            onClick={() => handleLookup()}
            disabled={isLookingUp}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md shadow-purple-950/40 transition-all flex items-center gap-2 shrink-0"
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
        <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-slate-500">Quick Test IDs:</span>
          {['586665', '586666', '586667'].map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setEnrollIdInput(id);
                handleLookup(id);
              }}
              className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-purple-300 rounded text-[10px] font-mono transition-colors"
            >
              {id}
            </button>
          ))}
        </div>

        {/* Lookup Error */}
        {lookupError && (
          <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{lookupError}</div>
          </div>
        )}

        {/* Duplicate Warning Alert */}
        {alreadySubmitted && submissionInfo && (
          <div className="mt-3 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200 flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-bold text-amber-300 mb-0.5">
                Already Submitted &amp; Protected!
              </h4>
              <p className="text-[11px] text-amber-200/90 leading-relaxed">
                This Enrollment ID was already submitted on{' '}
                <strong className="text-white">
                  {new Date(submissionInfo.submittedAt).toLocaleDateString()} at{' '}
                  {new Date(submissionInfo.submittedAt).toLocaleTimeString()}
                </strong>{' '}
                by <strong className="text-white">{submissionInfo.submittedBy}</strong>. Duplicate submissions are strictly prevented.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* STEP 2: Read-Only Master Record Display */}
      {employee && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-md space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                2. Master Employee Record (Read-Only)
              </span>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Verified in Database
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800/80">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Full Name</div>
              <div className="font-bold text-white mt-0.5 truncate">{employee.name}</div>
            </div>

            <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800/80">
              <div className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                <Briefcase className="w-3 h-3 text-slate-400" /> Designation
              </div>
              <div className="font-semibold text-slate-200 mt-0.5 truncate">{employee.designation}</div>
            </div>

            <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800/80">
              <div className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                <Building className="w-3 h-3 text-slate-400" /> Department
              </div>
              <div className="font-semibold text-slate-200 mt-0.5 truncate">{employee.department}</div>
            </div>

            <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800/80">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Enrollment No.</div>
              <div className="font-mono font-bold text-purple-400 mt-0.5">{employee.enrollId}</div>
            </div>

            <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800/80">
              <div className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" /> Joining Date
              </div>
              <div className="font-mono text-slate-300 mt-0.5">{employee.joiningDate}</div>
            </div>

            <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800/80">
              <div className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                <Droplet className="w-3 h-3 text-rose-400" /> Blood Group
              </div>
              <div className="font-bold text-rose-400 mt-0.5">{employee.bloodGroup}</div>
            </div>

            <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800/80 col-span-2">
              <div className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                <Phone className="w-3 h-3 text-slate-400" /> Emergency Contact
              </div>
              <div className="font-mono text-slate-300 mt-0.5">{employee.emergencyContact}</div>
            </div>

            <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800/80 col-span-2 sm:col-span-3 md:col-span-4">
              <div className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" /> Permanent Address
              </div>
              <div className="text-slate-300 mt-0.5 truncate">{employee.permanentAddress}</div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: The 3 Required Input Fields & Live ID Card Preview */}
      {employee && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 Columns: Form Input Controls */}
            <div className="lg:col-span-7 space-y-5 bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-md">
              <div className="border-b border-slate-800 pb-2.5 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-purple-400" />
                  <span>3. Required Supervisor Submission Fields</span>
                </h3>
                <span className="text-[10px] text-purple-400 font-semibold">* All 3 fields mandatory</span>
              </div>

              {/* Field 1: National ID Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center justify-between">
                  <span>National ID Card Number *</span>
                  <span className="text-[10px] text-slate-500 font-normal">NID or Smart Card No.</span>
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
                    className="w-full bg-slate-900 border border-slate-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 font-mono transition-colors disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Field 2: Employee Photo Capture / Upload */}
              <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-purple-400" />
                    <span>Employee Photo *</span>
                  </label>
                  {photoUrl ? (
                    <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Photo Attached
                    </span>
                  ) : (
                    <span className="text-[10px] text-rose-400 font-semibold">Required</span>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  {/* Thumbnail / Avatar */}
                  <div className="w-20 h-24 rounded-xl bg-slate-950 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt="Employee Photo Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center p-2 text-slate-600">
                        <User className="w-8 h-8 mx-auto mb-1 opacity-40" />
                        <span className="text-[9px] block">No Photo</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => openCamera('photo')}
                        disabled={alreadySubmitted}
                        className="px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Live Camera (Passport Guide)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => photoFileInputRef.current?.click()}
                        disabled={alreadySubmitted}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 border border-slate-700"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload File</span>
                      </button>

                      {photoUrl && (
                        <button
                          type="button"
                          onClick={() => setPhotoUrl('')}
                          disabled={alreadySubmitted}
                          className="px-2.5 py-2 text-rose-400 hover:text-rose-300 text-xs font-semibold"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      Use the camera with passport framing guide or upload a clear portrait photo.
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

              {/* Field 3: Employee Signature Capture / Upload */}
              <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <PenTool className="w-3.5 h-3.5 text-purple-400" />
                    <span>Employee Signature Photo *</span>
                  </label>
                  {signatureUrl ? (
                    <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Signature Attached
                    </span>
                  ) : (
                    <span className="text-[10px] text-rose-400 font-semibold">Required</span>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  {/* Thumbnail */}
                  <div className="w-28 h-16 rounded-xl bg-slate-950 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-inner p-1">
                    {signatureUrl ? (
                      <img
                        src={signatureUrl}
                        alt="Signature Preview"
                        className="w-full h-full object-contain filter invert"
                      />
                    ) : (
                      <div className="text-center text-slate-600">
                        <PenTool className="w-5 h-5 mx-auto mb-0.5 opacity-40" />
                        <span className="text-[9px]">No Signature</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setIsSignaturePadOpen(true)}
                        disabled={alreadySubmitted}
                        className="px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
                      >
                        <PenTool className="w-3.5 h-3.5" />
                        <span>Draw on Touchpad</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => sigFileInputRef.current?.click()}
                        disabled={alreadySubmitted}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 border border-slate-700"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Signature</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openCamera('signature')}
                        disabled={alreadySubmitted}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 border border-slate-700"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Capture Paper</span>
                      </button>

                      {signatureUrl && (
                        <button
                          type="button"
                          onClick={() => setSignatureUrl('')}
                          disabled={alreadySubmitted}
                          className="px-2.5 py-2 text-rose-400 hover:text-rose-300 text-xs font-semibold"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      Draw on touchscreen/mouse or upload a photo/scan of the employee's physical signature.
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
                  className="w-full py-3.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm rounded-xl shadow-lg shadow-purple-950/50 transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving Supervisor Record...</span>
                    </>
                  ) : alreadySubmitted ? (
                    <>
                      <ShieldAlert className="w-4 h-4 text-amber-300" />
                      <span>Already Submitted (Blocked from Duplicate)</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Submit Supervisor Verified Record</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right 5 Columns: Real-Time ID Card Preview */}
            <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-md flex flex-col items-center">
              <div className="w-full border-b border-slate-800 pb-2.5 mb-4 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-purple-400" />
                  <span>Live ID Card Preview</span>
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">54 × 86 mm</span>
              </div>

              {previewCardData && (
                <div className="flex flex-col items-center gap-5">
                  {/* Front Preview */}
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Card Front (Portrait)
                    </span>
                    <div
                      className="rounded-xl overflow-hidden shadow-2xl border border-slate-700 bg-white"
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

                  {/* Back Preview */}
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Card Back (Portrait)
                    </span>
                    <div
                      className="rounded-xl overflow-hidden shadow-2xl border border-slate-700 bg-white"
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

      {/* Camera Capture Modal with Passport Framing Guide */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
        title={cameraType === 'photo' ? 'Employee Photo Capture (Passport Guide)' : 'Signature Capture'}
        type={cameraType}
      />

      {/* Touch/Mouse Signature Pad Modal */}
      <SignaturePadModal
        isOpen={isSignaturePadOpen}
        onClose={() => setIsSignaturePadOpen(false)}
        onSave={(dataUrl) => setSignatureUrl(dataUrl)}
      />
    </div>
  );
}
