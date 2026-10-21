import React, { useState, useEffect, useRef } from 'react';
import {
  Database,
  Upload,
  Search,
  Trash2,
  RefreshCw,
  Download,
  AlertTriangle,
  CheckCircle,
  Pencil,
  X,
  Save,
  Camera,
  Image as ImageIcon,
  Check,
  UserPlus,
} from 'lucide-react';
import { apiService, getStoredToken } from '../services/apiService';
import { MasterEmployee, ColumnMapping } from '../types';
import { parseExcelFile } from '../services/excelService';
import { ColumnMappingModal } from './ColumnMappingModal';
import { CameraCaptureModal } from './CameraCaptureModal';
import { SignaturePadModal } from './SignaturePadModal';
import { BanglaSizeAlertModal } from './BanglaSizeAlertModal';
import {
  compressImageFile,
  compressDataUrl,
  MAX_FILE_SIZE_BYTES,
} from '../utils/imageCompression';

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

  // Import Results Modal State
  const [importResult, setImportResult] = useState<{
    isOpen: boolean;
    total: number;
    successful: number;
    duplicates: number;
    failed: number;
    sampleDuplicates?: string[];
  } | null>(null);

  // Add Employee Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addFormData, setAddFormData] = useState<Partial<MasterEmployee>>({
    enrollId: '',
    name: '',
    designation: '',
    department: '',
    jobType: 'Permanent',
    joiningDate: '01/03/2026',
    cardIssue: '19/10/2026',
    emergencyContact: '',
    permanentAddress: '',
    bloodGroup: 'O+',
    nationalId: '',
    photo: '',
    signature: '',
  });
  const [addFormError, setAddFormError] = useState<string | null>(null);
  const [isSavingAdd, setIsSavingAdd] = useState(false);
  const addPhotoInputRef = useRef<HTMLInputElement>(null);
  const addSigInputRef = useRef<HTMLInputElement>(null);

  // Active target context for camera and signature modals ('add' | 'edit')
  const [photoSigContext, setPhotoSigContext] = useState<'add' | 'edit'>('edit');

  // Edit Employee Modal State
  const [editingEmployee, setEditingEmployee] = useState<MasterEmployee | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<MasterEmployee>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Modals for editing/adding photo & signature
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<'photo' | 'signature'>('photo');
  const [isSignaturePadOpen, setIsSignaturePadOpen] = useState(false);
  const [isSizeAlertOpen, setIsSizeAlertOpen] = useState(false);
  const editPhotoInputRef = useRef<HTMLInputElement>(null);
  const editSigInputRef = useRef<HTMLInputElement>(null);

  const handleAddEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddFormError(null);

    const cleanEnrollId = (addFormData.enrollId || '').trim();
    const cleanName = (addFormData.name || '').trim();

    if (!cleanEnrollId) {
      setAddFormError('Enrollment ID is required.');
      return;
    }

    if (!cleanName) {
      setAddFormError('Employee Name is required.');
      return;
    }

    // Duplicate Enrollment ID validation: never create duplicates or silently overwrite
    const isDuplicate = employees.some(
      (emp) => emp.enrollId.toLowerCase() === cleanEnrollId.toLowerCase()
    );
    if (isDuplicate) {
      setAddFormError(`An employee with Enrollment ID "${cleanEnrollId}" already exists in the master database.`);
      return;
    }

    setIsSavingAdd(true);
    try {
      const res = await apiService.createMasterEmployee({
        ...addFormData,
        enrollId: cleanEnrollId,
        name: cleanName,
      });

      setEmployees((prev) => [res.employee, ...prev]);
      setStatusMessage({
        type: 'success',
        text: `Employee "${res.employee.enrollId} - ${res.employee.name}" added successfully to the master database.`,
      });
      setIsAddModalOpen(false);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setAddFormError(err.message || 'Failed to add employee to master database.');
    } finally {
      setIsSavingAdd(false);
    }
  };

  const loadMasterEmployees = async () => {
    const token = getStoredToken();
    if (!token) return;

    setIsLoading(true);
    try {
      const data = await apiService.getMasterEmployees();
      setEmployees(data);
    } catch (err: any) {
      if (
        err?.status === 401 ||
        err?.status === 403 ||
        err?.message?.includes('Authentication required') ||
        err?.message?.includes('Session expired')
      ) {
        return;
      }
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
          photo: getVal('photoUrl') || '',
          signature: getVal('signatureUrl') || '',
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
      setImportResult({
        isOpen: true,
        total: res.summary?.total || validRecords.length,
        successful: res.summary?.successful || 0,
        duplicates: res.summary?.duplicates || 0,
        failed: res.summary?.failed || 0,
        sampleDuplicates: res.sampleDuplicates,
      });

      await loadMasterEmployees();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      console.error('Import error:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to import records into master database.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenEdit = (emp: MasterEmployee) => {
    setEditingEmployee(emp);
    setEditFormData({ ...emp });
    setPhotoSigContext('edit');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    setIsSavingEdit(true);
    try {
      const res = await apiService.updateMasterEmployee(editingEmployee.enrollId, editFormData);
      setEmployees((prev) =>
        prev.map((item) => (item.enrollId === editingEmployee.enrollId ? res.employee : item))
      );
      setStatusMessage({ type: 'success', text: `Employee "${editingEmployee.enrollId}" updated successfully.` });
      setEditingEmployee(null);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to update employee.' });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteEmployee = async (enrollId: string) => {
    if (!window.confirm(`Are you sure you want to remove employee "${enrollId}" from the master database?`)) {
      return;
    }
    try {
      await apiService.deleteMasterEmployee(enrollId);
      setEmployees((prev) => prev.filter((e) => e.enrollId !== enrollId));
      setStatusMessage({ type: 'success', text: `Employee ${enrollId} removed from master database.` });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to delete employee.' });
    }
  };

  const handleClearAll = async () => {
    if (
      !window.confirm(
        'WARNING: This will delete ALL master employee records from the database. This action cannot be undone. Do you wish to proceed?'
      )
    ) {
      return;
    }
    try {
      await apiService.clearMasterEmployees();
      setEmployees([]);
      setStatusMessage({ type: 'success', text: 'Master employee database has been cleared.' });
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to clear database.' });
    }
  };

  const handleExportCSV = () => {
    if (employees.length === 0) return;

    const headers = [
      'Enroll ID',
      'Name',
      'Designation',
      'Department',
      'Job Type',
      'Join Date',
      'Card Issue',
      'Contact',
      'Address',
      'Blood Group',
      'NID',
    ];

    const rows = employees.map((e) => [
      `"${e.enrollId || ''}"`,
      `"${e.name || ''}"`,
      `"${e.designation || ''}"`,
      `"${e.department || ''}"`,
      `"${e.jobType || ''}"`,
      `"${e.joiningDate || ''}"`,
      `"${e.cardIssue || ''}"`,
      `"${e.emergencyContact || ''}"`,
      `"${e.permanentAddress || ''}"`,
      `"${e.bloodGroup || ''}"`,
      `"${e.nationalId || ''}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Master_Employees_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const departments = Array.from(new Set(employees.map((e) => e.department).filter(Boolean))).sort();

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      !searchQuery.trim() ||
      emp.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.enrollId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.designation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.department?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDept = selectedDept === 'all' || emp.department === selectedDept;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Master Employee Database</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {employees.length} records total. Enrollment ID is used as unique key.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx, .xls, .csv"
            className="hidden"
          />

          <button
            type="button"
            onClick={() => {
              setAddFormData({
                enrollId: '',
                name: '',
                designation: '',
                department: '',
                jobType: 'Permanent',
                joiningDate: '01/03/2026',
                cardIssue: '19/10/2026',
                emergencyContact: '',
                permanentAddress: '',
                bloodGroup: 'O+',
                nationalId: '',
                photo: '',
                signature: '',
              });
              setAddFormError(null);
              setIsAddModalOpen(true);
            }}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add New Employee</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Excel</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={employees.length === 0}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 disabled:opacity-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={loadMasterEmployees}
            className="p-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg transition-colors"
            title="Refresh database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {employees.length > 0 && (
            <button
              onClick={handleClearAll}
              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Status Alert */}
      {statusMessage && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between gap-2 border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
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
            ×
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-2.5 shadow-xs">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, ID, department..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-slate-900 focus:bg-white"
            />
          </div>

          <div className="relative">
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-slate-50 border border-slate-300 text-xs text-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-slate-900"
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
          <span className="text-slate-900 font-bold">{employees.length}</span>
        </div>
      </div>

      {/* Master Employees Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {filteredEmployees.length === 0 ? (
          <div className="p-8 text-center">
            <Database className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-xs font-bold text-slate-800 mb-1">No Records Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-3">
              {employees.length === 0
                ? 'Import employee records from an Excel worksheet to get started.'
                : 'No employees match the current filter.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                  <th className="py-2.5 px-3">Enroll ID</th>
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Designation</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Job Type</th>
                  <th className="py-2.5 px-3">Join Date</th>
                  <th className="py-2.5 px-3">Card Issue</th>
                  <th className="py-2.5 px-3">Contact</th>
                  <th className="py-2.5 px-3">Blood</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp) => (
                  <tr key={emp.enrollId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{emp.enrollId}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">{emp.name}</td>
                    <td className="py-2.5 px-3 text-slate-700">{emp.designation}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 border border-slate-200">
                        {emp.department}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{emp.jobType}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{emp.joiningDate}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{emp.cardIssue}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{emp.emergencyContact}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-800">{emp.bloodGroup}</td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEdit(emp)}
                          className="p-1 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                          title="Edit employee record"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(emp.enrollId)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          title="Delete from master database"
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

      {/* Import Results Modal */}
      {importResult?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-xl shadow-xl overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Import Results</h3>
              <button
                onClick={() => setImportResult(null)}
                className="p-1 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="text-base font-bold text-emerald-800">{importResult.successful}</div>
                <div className="text-[10px] text-emerald-700 font-semibold uppercase">Added</div>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="text-base font-bold text-amber-800">{importResult.duplicates}</div>
                <div className="text-[10px] text-amber-700 font-semibold uppercase">Duplicates Skipped</div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-base font-bold text-slate-800">{importResult.failed}</div>
                <div className="text-[10px] text-slate-600 font-semibold uppercase">Invalid Skipped</div>
              </div>
            </div>

            <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
              Total {importResult.total} records processed. Existing records and duplicate Enrollment IDs were preserved without overwriting.
            </div>

            {importResult.sampleDuplicates && importResult.sampleDuplicates.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-slate-500 uppercase">Sample Duplicates Skipped</div>
                <div className="max-h-24 overflow-y-auto text-xs font-mono text-slate-700 bg-slate-50 p-2 rounded border border-slate-200 space-y-0.5">
                  {importResult.sampleDuplicates.map((dup, idx) => (
                    <div key={idx}>{dup}</div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setImportResult(null)}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Edit Employee Record</h3>
                <span className="text-xs font-mono text-slate-500">ID: {editingEmployee.enrollId}</span>
              </div>
              <button
                onClick={() => setEditingEmployee(null)}
                className="p-1 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 overflow-y-auto space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={editFormData.name || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Designation</label>
                  <input
                    type="text"
                    value={editFormData.designation || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, designation: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={editFormData.department || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Job Type</label>
                  <input
                    type="text"
                    value={editFormData.jobType || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, jobType: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Joining Date</label>
                  <input
                    type="text"
                    value={editFormData.joiningDate || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, joiningDate: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Card Issue Date</label>
                  <input
                    type="text"
                    value={editFormData.cardIssue || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, cardIssue: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Contact Number</label>
                  <input
                    type="text"
                    value={editFormData.emergencyContact || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, emergencyContact: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Blood Group</label>
                  <input
                    type="text"
                    value={editFormData.bloodGroup || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, bloodGroup: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-bold"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">National ID (NID)</label>
                  <input
                    type="text"
                    value={editFormData.nationalId || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, nationalId: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Permanent Address</label>
                  <input
                    type="text"
                    value={editFormData.permanentAddress || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, permanentAddress: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                  />
                </div>
              </div>

              {/* Photo & Signature Section */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                {/* Photo */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Photo</label>
                  <div className="flex items-center gap-2">
                    {editFormData.photo ? (
                      <img src={editFormData.photo} alt="Photo" className="w-12 h-14 object-cover rounded border border-slate-200" />
                    ) : (
                      <div className="w-12 h-14 bg-slate-100 rounded border border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      <input
                        type="file"
                        ref={editPhotoInputRef}
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const result = await compressImageFile(file, { maxWidth: 800, maxHeight: 800, quality: 0.8 });
                              if (!result.isValidSize || result.sizeBytes > MAX_FILE_SIZE_BYTES) {
                                setIsSizeAlertOpen(true);
                                if (editPhotoInputRef.current) editPhotoInputRef.current.value = '';
                                return;
                              }
                              setEditFormData((prev) => ({ ...prev, photo: result.dataUrl }));
                            } catch (err) {
                              console.error('Error compressing photo:', err);
                            } finally {
                              e.target.value = '';
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => editPhotoInputRef.current?.click()}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-semibold"
                      >
                        Upload
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCameraTarget('photo');
                          setIsCameraOpen(true);
                        }}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-semibold"
                      >
                        Camera
                      </button>
                    </div>
                  </div>
                </div>

                {/* Signature */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Signature</label>
                  <div className="flex items-center gap-2">
                    {editFormData.signature ? (
                      <img src={editFormData.signature} alt="Signature" className="w-20 h-10 object-contain rounded border border-slate-200 bg-white" />
                    ) : (
                      <div className="w-20 h-10 bg-slate-100 rounded border border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      <input
                        type="file"
                        ref={editSigInputRef}
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const result = await compressImageFile(file, { maxWidth: 800, maxHeight: 800, quality: 0.8, isSignature: true });
                              if (!result.isValidSize || result.sizeBytes > MAX_FILE_SIZE_BYTES) {
                                setIsSizeAlertOpen(true);
                                if (editSigInputRef.current) editSigInputRef.current.value = '';
                                return;
                              }
                              setEditFormData((prev) => ({ ...prev, signature: result.dataUrl }));
                            } catch (err) {
                              console.error('Error compressing signature:', err);
                            } finally {
                              e.target.value = '';
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => editSigInputRef.current?.click()}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-semibold"
                      >
                        Upload
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsSignaturePadOpen(true)}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-semibold"
                      >
                        Draw
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {isSavingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Employee Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Add New Employee to Master Database</h3>
                  <p className="text-[11px] text-slate-500">Record will be immediately available for supervisor search &amp; ID card issuance.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {addFormError && (
              <div className="mx-5 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-medium">{addFormError}</span>
              </div>
            )}

            <form onSubmit={handleAddEmployeeSubmit} className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Enrollment ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={addFormData.enrollId || ''}
                    onChange={(e) => setAddFormData({ ...addFormData, enrollId: e.target.value })}
                    placeholder="e.g. 1024 or EMP-1024"
                    className="w-full bg-white border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 placeholder-slate-400 outline-hidden shadow-2xs"
                    required
                    autoFocus
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Unique identifier. Cannot be duplicated.</span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Employee Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={addFormData.name || ''}
                    onChange={(e) => setAddFormData({ ...addFormData, name: e.target.value })}
                    placeholder="e.g. Md. Rafiqul Islam"
                    className="w-full bg-white border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 outline-hidden shadow-2xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Designation</label>
                  <input
                    type="text"
                    value={addFormData.designation || ''}
                    onChange={(e) => setAddFormData({ ...addFormData, designation: e.target.value })}
                    placeholder="e.g. Senior Machine Operator"
                    className="w-full bg-white border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-hidden shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={addFormData.department || ''}
                    onChange={(e) => setAddFormData({ ...addFormData, department: e.target.value })}
                    placeholder="e.g. Sewing / Cutting / Quality"
                    className="w-full bg-white border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-hidden shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Job Type</label>
                  <select
                    value={addFormData.jobType || 'Permanent'}
                    onChange={(e) => setAddFormData({ ...addFormData, jobType: e.target.value })}
                    className="w-full bg-white border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 rounded-lg px-3 py-2 text-xs text-slate-900 outline-hidden shadow-2xs"
                  >
                    <option value="Permanent">Permanent</option>
                    <option value="Contractual">Contractual</option>
                    <option value="Probationary">Probationary</option>
                    <option value="Temporary">Temporary</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Blood Group</label>
                  <select
                    value={addFormData.bloodGroup || 'O+'}
                    onChange={(e) => setAddFormData({ ...addFormData, bloodGroup: e.target.value })}
                    className="w-full bg-white border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 outline-hidden shadow-2xs"
                  >
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Joining Date</label>
                  <input
                    type="text"
                    value={addFormData.joiningDate || ''}
                    onChange={(e) => setAddFormData({ ...addFormData, joiningDate: e.target.value })}
                    placeholder="DD/MM/YYYY e.g. 01/03/2026"
                    className="w-full bg-white border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 placeholder-slate-400 outline-hidden shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Card Issue Date</label>
                  <input
                    type="text"
                    value={addFormData.cardIssue || ''}
                    onChange={(e) => setAddFormData({ ...addFormData, cardIssue: e.target.value })}
                    placeholder="DD/MM/YYYY e.g. 19/10/2026"
                    className="w-full bg-white border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 placeholder-slate-400 outline-hidden shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Contact / Emergency Number
                  </label>
                  <input
                    type="text"
                    value={addFormData.emergencyContact || ''}
                    onChange={(e) => setAddFormData({ ...addFormData, emergencyContact: e.target.value })}
                    placeholder="e.g. 01712-345678"
                    className="w-full bg-white border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 placeholder-slate-400 outline-hidden shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">National ID (NID)</label>
                  <input
                    type="text"
                    value={addFormData.nationalId || ''}
                    onChange={(e) => setAddFormData({ ...addFormData, nationalId: e.target.value })}
                    placeholder="e.g. 19952691500001234"
                    className="w-full bg-white border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 placeholder-slate-400 outline-hidden shadow-2xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Permanent Address</label>
                  <input
                    type="text"
                    value={addFormData.permanentAddress || ''}
                    onChange={(e) => setAddFormData({ ...addFormData, permanentAddress: e.target.value })}
                    placeholder="e.g. Mukkhopur, Trishal, Mymensingh"
                    className="w-full bg-white border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-hidden shadow-2xs"
                  />
                </div>
              </div>

              {/* Photo & Signature Section with Automatic Optimization <= 200 KB */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200">
                {/* Photo */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-900">Employee Photo</label>
                    <span className="text-[10px] text-slate-500 font-semibold">Max 200 KB (Auto-compressed)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {addFormData.photo ? (
                      <div className="relative group">
                        <img
                          src={addFormData.photo}
                          alt="Employee Photo Preview"
                          className="w-14 h-16 object-cover rounded-lg border border-slate-300 shadow-2xs"
                        />
                        <button
                          type="button"
                          onClick={() => setAddFormData((prev) => ({ ...prev, photo: '' }))}
                          className="absolute -top-1.5 -right-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full p-0.5 shadow cursor-pointer"
                          title="Remove photo"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-14 h-16 bg-white rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
                        <ImageIcon className="w-5 h-5 text-slate-300" />
                        <span className="text-[9px] text-slate-400 mt-0.5">Portrait</span>
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5 flex-1">
                      <input
                        type="file"
                        ref={addPhotoInputRef}
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const result = await compressImageFile(file, { maxWidth: 800, maxHeight: 800, quality: 0.84 });
                              if (!result.isValidSize || result.sizeBytes > MAX_FILE_SIZE_BYTES) {
                                setIsSizeAlertOpen(true);
                                if (addPhotoInputRef.current) addPhotoInputRef.current.value = '';
                                return;
                              }
                              setAddFormData((prev) => ({ ...prev, photo: result.dataUrl }));
                            } catch (err) {
                              console.error('Error compressing photo:', err);
                            } finally {
                              e.target.value = '';
                            }
                          }
                        }}
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => addPhotoInputRef.current?.click()}
                          className="flex-1 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        >
                          <Upload className="w-3 h-3 text-slate-500" />
                          <span>Upload</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCameraTarget('photo');
                            setPhotoSigContext('add');
                            setIsCameraOpen(true);
                          }}
                          className="flex-1 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        >
                          <Camera className="w-3 h-3 text-slate-500" />
                          <span>Camera</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Signature */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-900">Employee Signature</label>
                    <span className="text-[10px] text-slate-500 font-semibold">Max 200 KB (Auto-compressed)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {addFormData.signature ? (
                      <div className="relative group">
                        <img
                          src={addFormData.signature}
                          alt="Employee Signature Preview"
                          className="w-20 h-14 object-contain rounded-lg border border-slate-300 bg-white shadow-2xs p-1"
                        />
                        <button
                          type="button"
                          onClick={() => setAddFormData((prev) => ({ ...prev, signature: '' }))}
                          className="absolute -top-1.5 -right-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full p-0.5 shadow cursor-pointer"
                          title="Remove signature"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-20 h-14 bg-white rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
                        <ImageIcon className="w-5 h-5 text-slate-300" />
                        <span className="text-[9px] text-slate-400 mt-0.5">Horizontal</span>
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5 flex-1">
                      <input
                        type="file"
                        ref={addSigInputRef}
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const result = await compressImageFile(file, { maxWidth: 800, maxHeight: 800, quality: 0.88, isSignature: true });
                              if (!result.isValidSize || result.sizeBytes > MAX_FILE_SIZE_BYTES) {
                                setIsSizeAlertOpen(true);
                                if (addSigInputRef.current) addSigInputRef.current.value = '';
                                return;
                              }
                              setAddFormData((prev) => ({ ...prev, signature: result.dataUrl }));
                            } catch (err) {
                              console.error('Error compressing signature:', err);
                            } finally {
                              e.target.value = '';
                            }
                          }
                        }}
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => addSigInputRef.current?.click()}
                          className="flex-1 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        >
                          <Upload className="w-3 h-3 text-slate-500" />
                          <span>Upload</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPhotoSigContext('add');
                            setIsSignaturePadOpen(true);
                          }}
                          className="flex-1 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        >
                          <Pencil className="w-3 h-3 text-slate-500" />
                          <span>Draw</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingAdd}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSavingAdd ? 'Saving to Database...' : 'Save Employee'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        title={cameraTarget === 'photo' ? 'Capture Employee Photo' : 'Capture Employee Signature'}
        type={cameraTarget}
        onCapture={async (dataUrl: string) => {
          try {
            const res = await compressDataUrl(dataUrl, {
              maxWidth: 800,
              maxHeight: 800,
              quality: 0.84,
              isSignature: cameraTarget === 'signature',
            });
            if (!res.isValidSize || res.sizeBytes > MAX_FILE_SIZE_BYTES) {
              setIsSizeAlertOpen(true);
              return;
            }
            if (photoSigContext === 'add') {
              if (cameraTarget === 'photo') {
                setAddFormData((prev) => ({ ...prev, photo: res.dataUrl }));
              } else {
                setAddFormData((prev) => ({ ...prev, signature: res.dataUrl }));
              }
            } else {
              if (cameraTarget === 'photo') {
                setEditFormData((prev) => ({ ...prev, photo: res.dataUrl }));
              } else {
                setEditFormData((prev) => ({ ...prev, signature: res.dataUrl }));
              }
            }
          } catch (err) {
            console.error(err);
          } finally {
            setIsCameraOpen(false);
          }
        }}
      />

      {/* Signature Pad Modal */}
      <SignaturePadModal
        isOpen={isSignaturePadOpen}
        onClose={() => setIsSignaturePadOpen(false)}
        onSave={async (dataUrl: string) => {
          try {
            const res = await compressDataUrl(dataUrl, {
              maxWidth: 800,
              maxHeight: 800,
              quality: 0.88,
              isSignature: true,
            });
            if (!res.isValidSize || res.sizeBytes > MAX_FILE_SIZE_BYTES) {
              setIsSizeAlertOpen(true);
              return;
            }
            if (photoSigContext === 'add') {
              setAddFormData((prev) => ({ ...prev, signature: res.dataUrl }));
            } else {
              setEditFormData((prev) => ({ ...prev, signature: res.dataUrl }));
            }
          } catch (err) {
            console.error(err);
          } finally {
            setIsSignaturePadOpen(false);
          }
        }}
      />

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

      {/* Bangla 1MB Size Alert Popup Modal */}
      <BanglaSizeAlertModal
        isOpen={isSizeAlertOpen}
        onClose={() => {
          setIsSizeAlertOpen(false);
          if (editPhotoInputRef.current) editPhotoInputRef.current.value = '';
          if (editSigInputRef.current) editSigInputRef.current.value = '';
          if (addPhotoInputRef.current) addPhotoInputRef.current.value = '';
          if (addSigInputRef.current) addSigInputRef.current.value = '';
        }}
      />
    </div>
  );
}
