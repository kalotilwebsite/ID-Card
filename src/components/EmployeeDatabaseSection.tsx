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
} from 'lucide-react';
import { apiService } from '../services/apiService';
import { MasterEmployee, ColumnMapping } from '../types';
import { parseExcelFile } from '../services/excelService';
import { ColumnMappingModal } from './ColumnMappingModal';

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
      setStatusMessage({ type: 'success', text: 'All master employee records have been cleared.' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to clear master database.' });
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
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
              Admin Only
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Database className="w-5 h-5 text-rose-600" />
              <span>Master Employee Database</span>
            </h2>
          </div>
          <p className="text-xs text-slate-600 max-w-2xl">
            Import and maintain master employee records from Excel with column mapping. The
            <strong className="text-slate-900"> Enrollment ID</strong> serves as the unique lookup key
            for supervisors. This master data is strictly kept separate from submitted cards.
          </p>
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
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import from Excel</span>
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
              onClick={handleClearAll}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All</span>
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
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
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
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Blood</th>
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
                    <td className="py-3 px-4 font-mono text-slate-600">{emp.emergencyContact}</td>
                    <td className="py-3 px-4 font-bold text-rose-600">{emp.bloodGroup}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteEmployee(emp.enrollId)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete from master database"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
