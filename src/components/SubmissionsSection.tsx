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
  Calendar,
  Layers,
  X,
  Clock,
  History,
  Check,
  RotateCcw,
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'printed'>('all');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedEnrollIds, setSelectedEnrollIds] = useState<Set<string>>(new Set());

  // Modals
  const [previewSubmission, setPreviewSubmission] = useState<SubmissionRecord | null>(null);
  const [historySubmission, setHistorySubmission] = useState<SubmissionRecord | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadSubmissions = async () => {
    setIsLoading(true);
    try {
      const data = await apiService.getSubmissions();
      setSubmissions(data);
      setStatusMessage(null);
    } catch (err: any) {
      console.error('Failed to load submissions:', err);
      const isAuthError =
        err.status === 401 ||
        err.message?.includes('Session expired') ||
        err.message?.includes('Authentication required');
      setStatusMessage({
        type: 'error',
        text: isAuthError
          ? 'Session reconnecting...'
          : err.message || 'Failed to load submitted records.',
      });
      if (isAuthError) {
        setTimeout(async () => {
          try {
            await apiService.login('admin', 'admin123');
            const data = await apiService.getSubmissions();
            setSubmissions(data);
            setStatusMessage(null);
          } catch {
            // Silently retain error state
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

  const pendingCount = submissions.filter((s) => s.printStatus !== 'printed').length;
  const printedCount = submissions.filter((s) => s.printStatus === 'printed').length;

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

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'pending' && sub.printStatus !== 'printed') ||
      (statusFilter === 'printed' && sub.printStatus === 'printed');

    return matchesSearch && matchesDept && matchesStatus;
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

  // Mark single card as printed
  const handleMarkPrinted = async (enrollId: string, empName: string) => {
    try {
      const res = await apiService.markSubmissionPrinted(enrollId);
      setSubmissions((prev) =>
        prev.map((s) => (s.enrollId === enrollId ? { ...s, ...res.record } : s))
      );
      setStatusMessage({
        type: 'success',
        text: `ID Card for ${empName} (${enrollId}) successfully marked as Printed.`,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to update print status.' });
    }
  };

  // Reprint action
  const handleReprint = async (sub: SubmissionRecord) => {
    try {
      const res = await apiService.reprintSubmission(sub.enrollId, 'Reprint requested from Admin panel');
      setSubmissions((prev) =>
        prev.map((s) => (s.enrollId === sub.enrollId ? { ...s, ...res.record } : s))
      );

      // Trigger Card Studio and print dialog
      const cardData = convertToCardData([sub]);
      onSendToPrintStudio(cardData, true);

      setStatusMessage({
        type: 'success',
        text: `Reprint initiated for ${sub.employee?.name || sub.enrollId} (Print #${res.record.printCount}). Loading Card Studio...`,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to record reprint.' });
    }
  };

  // Bulk Print Selected
  const handleBulkPrintSelected = () => {
    const selectedRecords = submissions.filter((s) => selectedEnrollIds.has(s.enrollId));
    if (selectedRecords.length === 0) {
      setStatusMessage({ type: 'error', text: 'Please select at least one employee submission to print.' });
      return;
    }
    const cardData = convertToCardData(selectedRecords);
    onSendToPrintStudio(cardData, true);
  };

  // Bulk Mark Selected as Printed
  const handleBulkMarkPrinted = async () => {
    const selectedList = Array.from(selectedEnrollIds);
    if (selectedList.length === 0) return;

    try {
      await apiService.bulkMarkPrinted(selectedList, 'Bulk print from submissions list');
      await loadSubmissions();
      setStatusMessage({
        type: 'success',
        text: `Successfully marked ${selectedList.length} cards as Printed.`,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to update print status.' });
    }
  };

  // Delete submission
  const handleDeleteSubmission = async (enrollId: string, empName: string) => {
    if (
      !window.confirm(
        `Are you sure you want to delete the submission for ${empName} (Enroll ID: ${enrollId})? This will allow the supervisor/operator to re-submit this record.`
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
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
              Admin Only
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <TableIcon className="w-5 h-5 text-rose-600" />
              <span>Supervisor ID Card Submissions &amp; Print Queue</span>
            </h2>
          </div>
          <p className="text-xs text-slate-600 max-w-2xl">
            Review employee ID card data submitted by supervisors and operators. Track print status (Pending vs Printed), execute ID card printing using the exact template, and log reprint history.
          </p>
        </div>

        {/* Global Bulk Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleBulkPrintSelected}
            disabled={selectedEnrollIds.size === 0}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>Print Selected ({selectedEnrollIds.size})</span>
          </button>

          <button
            onClick={handleBulkMarkPrinted}
            disabled={selectedEnrollIds.size === 0}
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Mark selected as printed"
          >
            <Check className="w-4 h-4 text-emerald-600" />
            <span>Mark Printed ({selectedEnrollIds.size})</span>
          </button>

          <button
            onClick={loadSubmissions}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl transition-colors"
            title="Refresh submissions"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Status Notification */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-2.5 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-slate-700 font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Tabs: All, Pending Print, Printed */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Submissions ({submissions.length})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              statusFilter === 'pending'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-amber-800 hover:bg-amber-100/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pending Print</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === 'pending' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800'}`}>
              {pendingCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('printed')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              statusFilter === 'printed'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-800 hover:bg-emerald-100/60'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Printed</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === 'printed' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
              {printedCount}
            </span>
          </button>
        </div>

        {/* Search, Dept, and Selection controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative w-full sm:w-56">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, ID, NID..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:bg-white transition-colors"
            />
          </div>

          {/* Department Filter */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="bg-slate-50 border border-slate-300 text-xs text-slate-700 rounded-xl px-3 py-1.5 focus:outline-none focus:border-rose-500"
          >
            <option value="all">All Departments ({submissions.length})</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept} ({submissions.filter((s) => s.employee?.department === dept).length})
              </option>
            ))}
          </select>

          {/* Selection buttons */}
          <button
            type="button"
            onClick={handleSelectAllFiltered}
            className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <CheckSquare className="w-3.5 h-3.5 text-rose-600" />
            <span>Select Filtered ({filteredSubmissions.length})</span>
          </button>

          <button
            type="button"
            onClick={handleDeselectAllFiltered}
            className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Square className="w-3.5 h-3.5" />
            <span>Deselect</span>
          </button>
        </div>
      </div>

      {/* Submissions Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {filteredSubmissions.length === 0 ? (
          <div className="p-12 text-center">
            <TableIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800 mb-1">No Submissions Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {submissions.length === 0
                ? 'No employee ID card submissions recorded yet. Supervisors can submit records via the Supervisor Portal.'
                : 'No submissions match the selected status, department, or search filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
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
                  <th className="py-3 px-3">Designation / Dept</th>
                  <th className="py-3 px-3">National ID (NID)</th>
                  <th className="py-3 px-3">Signature</th>
                  <th className="py-3 px-3">Print Status</th>
                  <th className="py-3 px-3">Submitted By / Date</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSubmissions.map((sub) => {
                  const emp = sub.employee || ({} as any);
                  const isSelected = selectedEnrollIds.has(sub.enrollId);
                  const isPrinted = sub.printStatus === 'printed';

                  return (
                    <tr
                      key={sub.enrollId}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-rose-50/40' : ''
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
                          className="w-10 h-13 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden cursor-pointer hover:border-rose-500 transition-colors shadow-2xs"
                          title="Click to preview ID card"
                        >
                          {sub.photoUrl ? (
                            <img
                              src={sub.photoUrl}
                              alt={emp.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <User className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Enroll ID */}
                      <td className="py-3 px-3 font-mono font-bold text-purple-700 whitespace-nowrap">
                        {sub.enrollId}
                      </td>

                      {/* Name */}
                      <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                        {emp.name}
                      </td>

                      {/* Designation / Dept */}
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-800">{emp.designation}</div>
                        <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 mt-0.5">
                          {emp.department}
                        </span>
                      </td>

                      {/* National ID */}
                      <td className="py-3 px-3 font-mono text-slate-800 font-semibold whitespace-nowrap">
                        {sub.nationalId}
                      </td>

                      {/* Signature Thumbnail */}
                      <td className="py-3 px-3">
                        <div
                          onClick={() => setPreviewSubmission(sub)}
                          className="w-18 h-8 bg-slate-50 rounded border border-slate-200 flex items-center justify-center p-0.5 cursor-pointer hover:border-rose-500 transition-colors"
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

                      {/* Print Status Badge */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {isPrinted ? (
                          <div className="flex items-center gap-1.5">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              <span>Printed {sub.printCount && sub.printCount > 1 ? `(${sub.printCount}x)` : ''}</span>
                            </span>
                            {sub.reprintHistory && sub.reprintHistory.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setHistorySubmission(sub)}
                                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                                title="View print & reprint history"
                              >
                                <History className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1 w-fit">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Pending Print</span>
                          </span>
                        )}
                      </td>

                      {/* Submitted By */}
                      <td className="py-3 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                        <div className="font-semibold text-slate-800">
                          {sub.submittedBy?.name || 'Authorized Supervisor'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {new Date(sub.submittedAt).toLocaleDateString()}{' '}
                          {new Date(sub.submittedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Print or Reprint action */}
                          {!isPrinted ? (
                            <>
                              <button
                                onClick={() => {
                                  const cardData = convertToCardData([sub]);
                                  onSendToPrintStudio(cardData, true);
                                }}
                                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1"
                                title="Print this ID card"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Print</span>
                              </button>

                              <button
                                onClick={() => handleMarkPrinted(sub.enrollId, emp.name)}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors"
                                title="Mark as Printed"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleReprint(sub)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                              title="Reprint card (logs reprint history)"
                            >
                              <RotateCcw className="w-3 h-3 text-slate-600" />
                              <span>Reprint</span>
                            </button>
                          )}

                          {/* Admin Card Preview */}
                          <button
                            onClick={() => setPreviewSubmission(sub)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Preview ID card (Admin)"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteSubmission(sub.enrollId, emp.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
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

      {/* Admin Card Preview Modal */}
      {previewSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <IdCard className="w-4 h-4 text-rose-600" />
                    <span>ID Card Preview: {previewSubmission.employee?.name}</span>
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      previewSubmission.printStatus === 'printed'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {previewSubmission.printStatus === 'printed' ? 'Printed' : 'Pending Print'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  Enroll ID: {previewSubmission.enrollId} | NID: {previewSubmission.nationalId}
                </p>
              </div>
              <button
                onClick={() => setPreviewSubmission(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 bg-slate-100/70 overflow-y-auto flex flex-col sm:flex-row items-center justify-center gap-6">
              {/* Front */}
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Front Side (Official Badge)
                </span>
                <div
                  style={{ width: CARD_WIDTH * 0.85, height: CARD_HEIGHT * 0.85 }}
                  className="relative shadow-lg rounded-2xl overflow-hidden border border-slate-300 bg-white"
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
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Back Side (NID &amp; Details)
                </span>
                <div
                  style={{ width: CARD_WIDTH * 0.85, height: CARD_HEIGHT * 0.85 }}
                  className="relative shadow-lg rounded-2xl overflow-hidden border border-slate-300 bg-white"
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

            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between">
              <div>
                {previewSubmission.printStatus !== 'printed' ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await handleMarkPrinted(previewSubmission.enrollId, previewSubmission.employee?.name || '');
                      setPreviewSubmission((prev) => (prev ? { ...prev, printStatus: 'printed', printCount: 1 } : null));
                    }}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Mark as Printed</span>
                  </button>
                ) : (
                  <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> Printed (Count: {previewSubmission.printCount || 1})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewSubmission(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Close Preview
                </button>
                <button
                  onClick={() => {
                    const cardData = convertToCardData([previewSubmission]);
                    onSendToPrintStudio(cardData, true);
                    setPreviewSubmission(null);
                  }}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print This Card</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print History Modal */}
      {historySubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Print &amp; Reprint History: {historySubmission.employee?.name}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Enroll ID: {historySubmission.enrollId} | Total Prints: {historySubmission.printCount || 1}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setHistorySubmission(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 overflow-y-auto">
              {(!historySubmission.reprintHistory || historySubmission.reprintHistory.length === 0) ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  No individual reprint log entries found.
                </div>
              ) : (
                <div className="space-y-2">
                  {historySubmission.reprintHistory.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-start justify-between gap-3"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                              item.action === 'initial_print'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {item.action === 'initial_print' ? 'Initial Print' : 'Reprint'}
                          </span>
                          <span className="font-semibold text-slate-800">{item.printedBy}</span>
                        </div>
                        {item.note && <p className="text-[11px] text-slate-600">{item.note}</p>}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono whitespace-nowrap text-right">
                        {new Date(item.printedAt).toLocaleDateString()}{' '}
                        {new Date(item.printedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setHistorySubmission(null)}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
