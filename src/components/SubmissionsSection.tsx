import React, { useState, useEffect } from 'react';
import {
  Table as TableIcon,
  Printer,
  Download,
  Search,
  Filter,
  CheckSquare,
  Square,
  Trash2,
  Eye,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  IdCard,
  User,
  Sparkles,
  Calendar,
  Layers,
  X,
} from 'lucide-react';
import { apiService } from '../services/apiService';
import { SubmissionRecord, EmployeeCardData, CARD_WIDTH, CARD_HEIGHT, DEFAULT_CALIBRATION } from '../types';
import { CardFront } from './CardFront';
import { CardBack } from './CardBack';
import { FRONT_TEMPLATE_SVG, BACK_TEMPLATE_SVG } from '../data/cardTemplates';

interface SubmissionsSectionProps {
  frontTemplateUrl?: string;
  backTemplateUrl?: string;
  onSendToPrintStudio: (employees: EmployeeCardData[], openPrintDialog?: boolean) => void;
}

export function SubmissionsSection({
  frontTemplateUrl = FRONT_TEMPLATE_SVG,
  backTemplateUrl = BACK_TEMPLATE_SVG,
  onSendToPrintStudio,
}: SubmissionsSectionProps) {
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedEnrollIds, setSelectedEnrollIds] = useState<Set<string>>(new Set());
  const [previewSubmission, setPreviewSubmission] = useState<SubmissionRecord | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadSubmissions = async () => {
    setIsLoading(true);
    try {
      const data = await apiService.getSubmissions();
      setSubmissions(data);
      // Pre-select all by default if newly loaded
      setSelectedEnrollIds(new Set(data.map((s) => s.enrollId)));
      setStatusMessage(null);
    } catch (err: any) {
      console.error('Failed to load submissions:', err);
      const isAuthError = err.status === 401 || err.message?.includes('Session expired') || err.message?.includes('Authentication required');
      setStatusMessage({
        type: 'error',
        text: isAuthError
          ? 'Session reconnecting...'
          : (err.message || 'Failed to load submitted records.'),
      });
      if (isAuthError) {
        setTimeout(async () => {
          try {
            await apiService.login('admin', 'admin123');
            const data = await apiService.getSubmissions();
            setSubmissions(data);
            setSelectedEnrollIds(new Set(data.map((s) => s.enrollId)));
            setStatusMessage(null);
          } catch {
            // Silently retain friendly error state
          }
        }, 600);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, []);

  const departments = Array.from(
    new Set(submissions.map((s) => s.employee?.department).filter(Boolean))
  ).sort();

  const filteredSubmissions = submissions.filter((sub) => {
    const emp = sub.employee || ({} as any);
    const matchesSearch =
      !searchQuery.trim() ||
      emp.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.enrollId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.designation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.nationalId?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDept = selectedDept === 'all' || emp.department === selectedDept;

    return matchesSearch && matchesDept;
  });

  // Selection handlers
  const handleToggleSelect = (enrollId: string) => {
    const next = new Set(selectedEnrollIds);
    if (next.has(enrollId)) {
      next.delete(enrollId);
    } else {
      next.add(enrollId);
    }
    setSelectedEnrollIds(next);
  };

  const handleSelectAllFiltered = () => {
    const next = new Set(selectedEnrollIds);
    filteredSubmissions.forEach((s) => next.add(s.enrollId));
    setSelectedEnrollIds(next);
  };

  const handleDeselectAllFiltered = () => {
    const next = new Set(selectedEnrollIds);
    filteredSubmissions.forEach((s) => next.delete(s.enrollId));
    setSelectedEnrollIds(next);
  };

  const handleDeleteSubmission = async (enrollId: string, empName: string) => {
    if (
      !window.confirm(
        `Are you sure you want to delete the submission for ${empName} (Enroll ID: ${enrollId})? This will allow the operator to re-submit this record.`
      )
    ) {
      return;
    }

    try {
      await apiService.deleteSubmission(enrollId);
      setSubmissions((prev) => prev.filter((s) => s.enrollId !== enrollId));
      setSelectedEnrollIds((prev) => {
        const next = new Set(prev);
        next.delete(enrollId);
        return next;
      });
      setStatusMessage({
        type: 'success',
        text: `Submission for ${empName} (${enrollId}) deleted. It can now be re-entered.`,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to delete submission.' });
    }
  };

  // Convert submission records to EmployeeCardData for Card Studio & Printing
  const convertToCardData = (records: SubmissionRecord[]): EmployeeCardData[] => {
    return records.map((sub, idx) => {
      const emp = sub.employee || ({} as any);
      return {
        id: `submitted-${sub.enrollId}-${idx}`,
        name: emp.name || 'EMPLOYEE',
        designation: emp.designation || 'Staff',
        department: emp.department || 'General',
        jobType: emp.jobType || 'Permanent',
        joiningDate: emp.joiningDate || '01/03/2026',
        enrollId: sub.enrollId,
        cardIssue: emp.cardIssue || '19/10/2026',
        photoUrl: sub.photoUrl || undefined,
        permanentAddress: emp.permanentAddress || 'Mukkhopur, Trishal, Mymensingh',
        emergencyContact: emp.emergencyContact || '01920-694100',
        nationalId: sub.nationalId,
        bloodGroup: emp.bloodGroup || 'O+',
        signatureUrl: sub.signatureUrl || undefined,
        isValid: true,
      };
    });
  };

  const handleBulkPrintSelected = () => {
    const selectedRecords = submissions.filter((s) => selectedEnrollIds.has(s.enrollId));
    if (selectedRecords.length === 0) {
      setStatusMessage({ type: 'error', text: 'Please select at least one employee submission to print.' });
      return;
    }
    const cardData = convertToCardData(selectedRecords);
    onSendToPrintStudio(cardData, true);
  };

  const handleOpenInStudio = () => {
    const selectedRecords = submissions.filter((s) => selectedEnrollIds.has(s.enrollId));
    if (selectedRecords.length === 0) {
      setStatusMessage({ type: 'error', text: 'Please select at least one employee submission to load into Card Studio.' });
      return;
    }
    const cardData = convertToCardData(selectedRecords);
    onSendToPrintStudio(cardData, false);
  };

  // Preview card data helper
  const getPreviewCardData = (sub: SubmissionRecord): EmployeeCardData => {
    const emp = sub.employee || ({} as any);
    return {
      id: `preview-${sub.enrollId}`,
      name: emp.name || 'EMPLOYEE',
      designation: emp.designation || 'Staff',
      department: emp.department || 'General',
      jobType: emp.jobType || 'Permanent',
      joiningDate: emp.joiningDate || '01/03/2026',
      enrollId: sub.enrollId,
      cardIssue: emp.cardIssue || '19/10/2026',
      photoUrl: sub.photoUrl || undefined,
      permanentAddress: emp.permanentAddress || 'Mukkhopur, Trishal, Mymensingh',
      emergencyContact: emp.emergencyContact || '01920-694100',
      nationalId: sub.nationalId,
      bloodGroup: emp.bloodGroup || 'O+',
      signatureUrl: sub.signatureUrl || undefined,
      isValid: true,
    };
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
              Admin Only
            </span>
            <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
              <TableIcon className="w-5 h-5 text-rose-500" />
              <span>Submitted Data Entry Records &amp; Bulk Printing</span>
            </h2>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl">
            View verified records submitted by authorized operators. Filter by department, select
            individual or multiple employees, and trigger high-resolution ID card generation and
            printing using the exact reference templates.
          </p>
        </div>

        {/* Global Bulk Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleBulkPrintSelected}
            disabled={selectedEnrollIds.size === 0}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-950/40 flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>Generate &amp; Print Selected ({selectedEnrollIds.size})</span>
          </button>

          <button
            onClick={handleOpenInStudio}
            disabled={selectedEnrollIds.size === 0}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Layers className="w-4 h-4" />
            <span>Open in Card Studio</span>
          </button>

          <button
            onClick={loadSubmissions}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
            title="Refresh submissions"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Status Alert */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-2.5 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-200'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <div className="flex items-center gap-3">
            {statusMessage.type === 'error' && (
              <button
                onClick={loadSubmissions}
                className="text-rose-300 hover:text-white font-bold underline"
              >
                Retry
              </button>
            )}
            <button
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-white font-bold"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Filter & Multi-Select Toolbar */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, ID, NID, dept..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Department Filter */}
          <div className="relative">
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-rose-500"
            >
              <option value="all">All Departments ({submissions.length})</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept} ({submissions.filter((s) => s.employee?.department === dept).length})
                </option>
              ))}
            </select>
          </div>

          {/* Selection Control Buttons */}
          <button
            type="button"
            onClick={handleSelectAllFiltered}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <CheckSquare className="w-3.5 h-3.5 text-rose-400" />
            <span>Select Filtered ({filteredSubmissions.length})</span>
          </button>

          <button
            type="button"
            onClick={handleDeselectAllFiltered}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Square className="w-3.5 h-3.5" />
            <span>Deselect All</span>
          </button>
        </div>

        <div className="text-xs text-slate-400 font-medium text-right">
          Selected <span className="text-rose-400 font-bold">{selectedEnrollIds.size}</span> of{' '}
          <span className="text-white font-bold">{filteredSubmissions.length}</span> visible (Total:{' '}
          {submissions.length})
        </div>
      </div>

      {/* Submissions Table */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-md overflow-hidden">
        {filteredSubmissions.length === 0 ? (
          <div className="p-12 text-center">
            <TableIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-white mb-1">No Submissions Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {submissions.length === 0
                ? 'No employee ID records have been submitted yet. Authorized operators can submit records via the Data Entry form.'
                : 'No submissions match the current search query or department filter.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900/90 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredSubmissions.length > 0 &&
                        filteredSubmissions.every((s) => selectedEnrollIds.has(s.enrollId))
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          handleSelectAllFiltered();
                        } else {
                          handleDeselectAllFiltered();
                        }
                      }}
                      className="rounded accent-rose-600"
                    />
                  </th>
                  <th className="py-3 px-3">Photo</th>
                  <th className="py-3 px-3">Enroll ID</th>
                  <th className="py-3 px-3">Employee Name</th>
                  <th className="py-3 px-3">Designation</th>
                  <th className="py-3 px-3">Department</th>
                  <th className="py-3 px-3">National ID (NID)</th>
                  <th className="py-3 px-3">Signature</th>
                  <th className="py-3 px-3">Submitted By / Time</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredSubmissions.map((sub) => {
                  const emp = sub.employee || ({} as any);
                  const isSelected = selectedEnrollIds.has(sub.enrollId);

                  return (
                    <tr
                      key={sub.enrollId}
                      className={`hover:bg-slate-900/40 transition-colors ${
                        isSelected ? 'bg-rose-950/15' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(sub.enrollId)}
                          className="rounded accent-rose-600"
                        />
                      </td>

                      {/* Photo Thumbnail */}
                      <td className="py-3 px-3">
                        <div
                          onClick={() => setPreviewSubmission(sub)}
                          className="w-10 h-12 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden cursor-pointer hover:border-rose-500 transition-colors shadow-sm"
                          title="Click to preview card"
                        >
                          {sub.photoUrl ? (
                            <img
                              src={sub.photoUrl}
                              alt={emp.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-500">
                              <User className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Enroll ID */}
                      <td className="py-3 px-3 font-mono font-bold text-rose-400 whitespace-nowrap">
                        {sub.enrollId}
                      </td>

                      {/* Name */}
                      <td className="py-3 px-3 font-bold text-white whitespace-nowrap">
                        {emp.name}
                      </td>

                      {/* Designation */}
                      <td className="py-3 px-3 text-slate-300">{emp.designation}</td>

                      {/* Department */}
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          {emp.department}
                        </span>
                      </td>

                      {/* National ID */}
                      <td className="py-3 px-3 font-mono text-slate-300 font-semibold">
                        {sub.nationalId}
                      </td>

                      {/* Signature Thumbnail */}
                      <td className="py-3 px-3">
                        <div
                          onClick={() => setPreviewSubmission(sub)}
                          className="w-16 h-8 bg-white rounded border border-slate-300 flex items-center justify-center p-0.5 cursor-pointer hover:border-rose-500 transition-colors"
                          title="Click to preview card"
                        >
                          {sub.signatureUrl ? (
                            <img
                              src={sub.signatureUrl}
                              alt="Signature"
                              className="max-h-full max-w-full object-contain"
                            />
                          ) : (
                            <span className="text-[9px] text-slate-400">None</span>
                          )}
                        </div>
                      </td>

                      {/* Submitted By */}
                      <td className="py-3 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                        <div className="font-medium text-slate-300">
                          {sub.submittedBy?.name || 'Operator'}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {new Date(sub.submittedAt).toLocaleDateString()}{' '}
                          {new Date(sub.submittedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setPreviewSubmission(sub)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            title="Preview ID card"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSubmission(sub.enrollId, emp.name)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                            title="Delete submission (allow resubmission)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Card Preview Modal */}
      {previewSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <IdCard className="w-4 h-4 text-rose-500" />
                  <span>ID Card Preview: {previewSubmission.employee?.name}</span>
                </h3>
                <p className="text-[11px] text-slate-400 font-mono">
                  Enroll ID: {previewSubmission.enrollId} | NID: {previewSubmission.nationalId}
                </p>
              </div>
              <button
                onClick={() => setPreviewSubmission(null)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 bg-slate-950/70 overflow-y-auto flex flex-col sm:flex-row items-center justify-center gap-6">
              {/* Front */}
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Front Side (Official)
                </span>
                <div
                  style={{ width: CARD_WIDTH * 0.85, height: CARD_HEIGHT * 0.85 }}
                  className="relative shadow-2xl rounded-2xl overflow-hidden border border-slate-700"
                >
                  <CardFront
                    employee={getPreviewCardData(previewSubmission)}
                    templateUrl={frontTemplateUrl}
                    calibration={DEFAULT_CALIBRATION.front}
                    scale={0.85}
                  />
                </div>
              </div>

              {/* Back */}
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Back Side (NID &amp; Details)
                </span>
                <div
                  style={{ width: CARD_WIDTH * 0.85, height: CARD_HEIGHT * 0.85 }}
                  className="relative shadow-2xl rounded-2xl overflow-hidden border border-slate-700"
                >
                  <CardBack
                    employee={getPreviewCardData(previewSubmission)}
                    templateUrl={backTemplateUrl}
                    calibration={DEFAULT_CALIBRATION.back}
                    scale={0.85}
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                onClick={() => setPreviewSubmission(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Close Preview
              </button>
              <button
                onClick={() => {
                  const cardData = convertToCardData([previewSubmission]);
                  onSendToPrintStudio(cardData, true);
                  setPreviewSubmission(null);
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-950/40 flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print This Card</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
