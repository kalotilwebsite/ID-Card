import React, { useState, useEffect, useRef } from 'react';
import {
  Database,
  Upload,
  Search,
  Trash2,
  RefreshCw,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle,
  Building,
  User,
  Hash,
  Filter,
  Edit2,
  Lock,
  X,
  Phone,
  Droplet,
  ShieldAlert,
} from 'lucide-react';
import { apiService } from '../services/apiService';
import { MasterEmployee, ColumnMapping } from '../types';
import { parseExcelFile } from '../services/excelService';
import { ColumnMappingModal } from './ColumnMappingModal';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

interface EmployeeDatabaseSectionProps {
  onRefreshData?: () => void;
}

export function EmployeeDatabaseSection({ onRefreshData }: EmployeeDatabaseSectionProps) {
  const [employees, setEmployees] = useState<MasterEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Excel file upload & mapping state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [currentFileName, setCurrentFileName] = useState('');
  const [importWarnings, setImportWarnings] = useState<string[]>([]);

  // Modals for Delete Confirmation
  const [employeeToDelete, setEmployeeToDelete] = useState<MasterEmployee | null>(null);
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);

  // Modals for Restricted Edit (Contact Number & Blood Group ONLY)
  const [editingEmployee, setEditingEmployee] = useState<MasterEmployee | null>(null);
  const [editContact, setEditContact] = useState('');
  const [editBloodGroup, setEditBloodGroup] = useState('O+');
  const [editError, setEditError] = useState<string | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const loadMasterEmployees = async () => {
    setIsLoading(true);
    try {
      const data = await apiService.getMasterEmployees();
      setEmployees(data);
    } catch (err: any) {
      console.error('Failed to load master employees:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to load master employees.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMasterEmployees();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setStatusMessage(null);

    try {
      const parseResult = await parseExcelFile(file);
      setRawHeaders(parseResult.headers);
      setRawRows(parseResult.rows);
      setCurrentFileName(file.name);
      setImportWarnings(parseResult.warnings || []);
      setIsMappingModalOpen(true);
    } catch (err: any) {
      console.error('Excel parse error:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.',
      });
    } finally {
      setIsLoading(false);
      e.target.value = '';
    }
  };

  const handleConfirmMapping = async (mappings: ColumnMapping[]) => {
    setIsLoading(true);
    setStatusMessage(null);

    try {
      const mappedEmployees: Partial<MasterEmployee>[] = rawRows.map((row) => {
        const getVal = (key: string): string => {
          const m = mappings.find((item) => item.fieldKey === key);
          if (!m) return '';
          const col = m.sourceColumn;
          if (!col) return m.fallbackValue || '';
          const val = row[col];
          return val !== undefined && val !== null ? String(val).trim() : m.fallbackValue || '';
        };

        return {
          enrollId: getVal('enrollId'),
          name: getVal('name'),
          designation: getVal('designation'),
          department: getVal('department'),
          jobType: getVal('jobType') || 'Permanent',
          joiningDate: getVal('joiningDate') || '01/03/2026',
          cardIssue: getVal('cardIssue') || '19/10/2026',
          emergencyContact: getVal('emergencyContact') || '01920-694100',
          permanentAddress: getVal('permanentAddress') || 'Mukkhopur, Trishal, Mymensingh',
          bloodGroup: getVal('bloodGroup') || 'O+',
          nationalId: getVal('nationalId') || '',
        };
      });

      const validRecords = mappedEmployees.filter((e) => Boolean(e.enrollId && e.name));

      if (validRecords.length === 0) {
        setStatusMessage({
          type: 'error',
          text: 'No valid records found with both Enrollment ID and Name. Please check column mapping.',
        });
        setIsLoading(false);
        return;
      }

      const res = await apiService.importMasterEmployees(validRecords);
      setStatusMessage({ type: 'success', text: res.message });
      await loadMasterEmployees();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      console.error('Import error:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to import records into master database.' });
    } finally {
      setIsLoading(false);
    }
  };

  // --- INDIVIDUAL DELETE WORKFLOW ---
  const handleOpenDelete = (emp: MasterEmployee) => {
    setEmployeeToDelete(emp);
  };

  const handleConfirmIndividualDelete = async () => {
    if (!employeeToDelete) return;
    const targetId = employeeToDelete.enrollId;
    const targetName = employeeToDelete.name;

    setIsLoading(true);
    setStatusMessage(null);

    try {
      await apiService.deleteMasterEmployee(targetId);
      setEmployees((prev) => prev.filter((e) => e.enrollId !== targetId));
      setStatusMessage({
        type: 'success',
        text: `Employee record "${targetName}" (Enroll ID: ${targetId}) deleted successfully.`,
      });
      setEmployeeToDelete(null);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to delete employee.' });
    } finally {
      setIsLoading(false);
    }
  };

  // --- BULK DELETE ALL WORKFLOW ---
  const handleConfirmDeleteAll = async () => {
    setIsLoading(true);
    setStatusMessage(null);

    try {
      await apiService.clearMasterEmployees();
      setEmployees([]);
      setStatusMessage({
        type: 'success',
        text: 'All master employee records have been permanently cleared from database.',
      });
      setIsDeleteAllModalOpen(false);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to clear master database.' });
    } finally {
      setIsLoading(false);
    }
  };

  // --- RESTRICTED EDIT WORKFLOW (Contact Number & Blood Group ONLY) ---
  const handleOpenEdit = (emp: MasterEmployee) => {
    setEditingEmployee(emp);
    setEditContact(emp.emergencyContact || '');
    setEditBloodGroup(emp.bloodGroup || 'O+');
    setEditError(null);
  };

  const handleSaveRestrictedEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    if (!editContact.trim()) {
      setEditError('Contact Number is required and cannot be empty.');
      return;
    }

    if (!BLOOD_GROUPS.includes(editBloodGroup)) {
      setEditError(`Blood Group must be one of: ${BLOOD_GROUPS.join(', ')}`);
      return;
    }

    setIsSubmittingEdit(true);
    setEditError(null);

    try {
      const res = await apiService.updateMasterEmployee(editingEmployee.enrollId, {
        emergencyContact: editContact.trim(),
        bloodGroup: editBloodGroup,
      });

      setEmployees((prev) =>
        prev.map((emp) =>
          emp.enrollId === editingEmployee.enrollId
            ? { ...emp, emergencyContact: editContact.trim(), bloodGroup: editBloodGroup }
            : emp
        )
      );

      setStatusMessage({
        type: 'success',
        text: `Updated Contact Number and Blood Group for ${editingEmployee.name} (Enroll ID: ${editingEmployee.enrollId}).`,
      });

      setEditingEmployee(null);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update employee details.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const departments = Array.from(new Set(employees.map((e) => e.department).filter(Boolean))).sort();

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      !searchQuery.trim() ||
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.enrollId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.designation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.department.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDept = selectedDept === 'all' || emp.department === selectedDept;

    return matchesSearch && matchesDept;
  });

  const handleExportCSV = () => {
    if (employees.length === 0) return;
    const headers = [
      'Enrollment ID',
      'Name',
      'Designation',
      'Department',
      'Job Type',
      'Joining Date',
      'Card Issue',
      'Emergency Contact',
      'Permanent Address',
      'Blood Group',
      'National ID',
    ];

    const rows = employees.map((e) => [
      `"${e.enrollId}"`,
      `"${e.name}"`,
      `"${e.designation}"`,
      `"${e.department}"`,
      `"${e.jobType || ''}"`,
      `"${e.joiningDate || ''}"`,
      `"${e.cardIssue || ''}"`,
      `"${e.emergencyContact || ''}"`,
      `"${(e.permanentAddress || '').replace(/"/g, '""')}"`,
      `"${e.bloodGroup || ''}"`,
      `"${e.nationalId || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Master_Employee_Database_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Employee Master Database
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {employees.length} Records
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Master employee records with restricted editing (Contact Number &amp; Blood Group only).
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx, .xls, .csv"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Excel</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={employees.length === 0}
            className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={loadMasterEmployees}
            className="p-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl transition-colors"
            title="Refresh database"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {employees.length > 0 && (
            <button
              onClick={() => setIsDeleteAllModalOpen(true)}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
              title="Delete all master employee records"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete All</span>
            </button>
          )}
        </div>
      </div>

      {/* Status Alert */}
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

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, ID, department..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:bg-white"
            />
          </div>

          {/* Department Filter */}
          <div className="relative">
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-slate-50 border border-slate-300 text-xs text-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:border-rose-500"
            >
              <option value="all">All Departments ({employees.length})</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept} ({employees.filter((e) => e.department === dept).length})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing <span className="text-slate-900 font-bold">{filteredEmployees.length}</span> of{' '}
          <span className="text-rose-600 font-bold">{employees.length}</span> Master Records
        </div>
      </div>

      {/* Master Employees Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {filteredEmployees.length === 0 ? (
          <div className="p-12 text-center">
            <Database className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800 mb-1">No Master Records Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              {employees.length === 0
                ? 'Import employee records from an Excel worksheet to get started. Enrollment ID will be used as the unique key.'
                : 'No employees match the current search query or department filter.'}
            </p>
            {employees.length === 0 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs inline-flex items-center gap-2"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import Excel Spreadsheet</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-4">Enroll ID</th>
                  <th className="py-3 px-4">Employee Name</th>
                  <th className="py-3 px-4">Designation</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Job Type</th>
                  <th className="py-3 px-4">Join Date</th>
                  <th className="py-3 px-4">Contact Number</th>
                  <th className="py-3 px-4">Blood Group</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp) => (
                  <tr key={emp.enrollId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-purple-700">{emp.enrollId}</td>
                    <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">{emp.name}</td>
                    <td className="py-3 px-4 text-slate-700">{emp.designation}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {emp.department}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{emp.jobType}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{emp.joiningDate}</td>
                    <td className="py-3 px-4 font-mono text-slate-800 font-semibold">
                      {emp.emergencyContact}
                    </td>
                    <td className="py-3 px-4 font-bold text-rose-600">
                      <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[11px]">
                        {emp.bloodGroup}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(emp)}
                          className="p-1.5 text-slate-500 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition-colors"
                          title={`Edit Contact Number & Blood Group for ${emp.name}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(emp)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title={`Delete employee ${emp.enrollId}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Individual Employee Delete Confirmation Modal */}
      {employeeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Employee Record</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Are you sure you want to remove employee <strong className="text-slate-900">{employeeToDelete.name}</strong> (Enrollment ID: <span className="font-mono text-purple-700 font-bold">{employeeToDelete.enrollId}</span>)?
                </p>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  This will remove the master record for this employee only. Other records remain unaffected.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEmployeeToDelete(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmIndividualDelete}
                disabled={isLoading}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete All Confirmation Modal */}
      {isDeleteAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-rose-200 w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700 border border-rose-300 shrink-0">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-rose-900">Delete All Employee Records?</h3>
                <p className="text-xs text-slate-700 mt-1">
                  WARNING: This will permanently delete <strong>ALL {employees.length} master employee records</strong> from the database.
                </p>
                <p className="text-[11px] text-rose-600 mt-1 font-semibold">
                  This action cannot be undone. You will need to re-import records from Excel.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsDeleteAllModalOpen(false)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAll}
                disabled={isLoading}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                Yes, Delete All Records
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restricted Edit Employee Modal: ONLY Contact Number and Blood Group can be updated */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-sky-600" />
                  <span>Edit Employee Record</span>
                  <span className="font-mono text-purple-700 text-xs px-2 py-0.5 rounded bg-purple-50 border border-purple-200">
                    ID: {editingEmployee.enrollId}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Restricted Editing: Only Contact Number and Blood Group can be modified.
                </p>
              </div>
              <button
                onClick={() => setEditingEmployee(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRestrictedEdit} className="p-5 space-y-4 overflow-y-auto">
              {editError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {/* READ-ONLY LOCKED FIELDS SECTION */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Read-Only Master Fields (Protected)</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Employee Name</span>
                    <span className="font-bold text-slate-800 block truncate">{editingEmployee.name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Designation</span>
                    <span className="font-semibold text-slate-700 block truncate">{editingEmployee.designation}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Department</span>
                    <span className="font-semibold text-slate-700 block">{editingEmployee.department}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Job Type</span>
                    <span className="font-semibold text-slate-700 block">{editingEmployee.jobType}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Joining Date</span>
                    <span className="font-mono text-slate-700 block">{editingEmployee.joiningDate}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Card Issue Date</span>
                    <span className="font-mono text-slate-700 block">{editingEmployee.cardIssue}</span>
                  </div>
                </div>
              </div>

              {/* EDITABLE FIELDS SECTION */}
              <div className="space-y-3.5 pt-1">
                <div className="text-xs font-bold text-sky-900 flex items-center gap-1.5 pb-1 border-b border-sky-100">
                  <span className="w-2 h-2 rounded-full bg-sky-500" />
                  <span>Editable Employee Fields</span>
                </div>

                {/* 1. Contact Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-sky-600" />
                    <span>Contact Number (Emergency Contact) *</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editContact}
                    onChange={(e) => setEditContact(e.target.value)}
                    placeholder="e.g. 01920-694100"
                    className="w-full bg-white border border-slate-300 focus:border-sky-600 focus:ring-1 focus:ring-sky-500 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono font-semibold"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Enter valid employee phone / emergency contact number.
                  </p>
                </div>

                {/* 2. Blood Group */}
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1 flex items-center gap-1.5">
                    <Droplet className="w-3.5 h-3.5 text-rose-600" />
                    <span>Blood Group *</span>
                  </label>
                  <select
                    value={editBloodGroup}
                    onChange={(e) => setEditBloodGroup(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-rose-600 focus:ring-1 focus:ring-rose-500 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold"
                  >
                    {BLOOD_GROUPS.map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Select verified blood group from standard medical classifications.
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                >
                  {isSubmittingEdit && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Column Mapping Modal for Master Import */}
      <ColumnMappingModal
        isOpen={isMappingModalOpen}
        onClose={() => setIsMappingModalOpen(false)}
        headers={rawHeaders}
        sampleRows={rawRows}
        sourceName={currentFileName || 'Master Excel Spreadsheet'}
        warnings={importWarnings}
        onConfirmMapping={handleConfirmMapping}
      />
    </div>
  );
}
