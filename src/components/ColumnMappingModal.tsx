import React, { useState, useEffect } from 'react';
import { ColumnMapping, CardFieldKey, EmployeeCardData } from '../types';
import { Check, ArrowRight, HelpCircle, AlertTriangle } from 'lucide-react';

interface ColumnMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  headers: string[];
  sampleRows: Record<string, any>[];
  sourceName: string;
  onConfirmMapping: (mappings: ColumnMapping[]) => void;
}

const FIELD_DEFINITIONS: {
  key: CardFieldKey;
  label: string;
  required: boolean;
  description: string;
  keywords: string[];
  defaultFallback?: string;
}[] = [
  {
    key: 'name',
    label: 'Employee Name',
    required: true,
    description: 'Full name printed prominently on the front of the card',
    keywords: ['name', 'employee name', 'emp name', 'full name', 'employee', 'staff name'],
  },
  {
    key: 'designation',
    label: 'Designation / Role',
    required: true,
    description: 'Job designation (e.g., Asst.Caster)',
    keywords: ['designation', 'role', 'position', 'job title', 'title', 'post'],
  },
  {
    key: 'department',
    label: 'Department',
    required: true,
    description: 'Department (e.g., Casting, Production)',
    keywords: ['department', 'dept', 'division', 'section', 'unit'],
  },
  {
    key: 'jobType',
    label: 'Job Type',
    required: false,
    description: 'Employment type (e.g., Permanent, Contractual)',
    keywords: ['job type', 'type', 'employment type', 'status', 'job_type'],
    defaultFallback: 'Permanent',
  },
  {
    key: 'joiningDate',
    label: 'Joining Date',
    required: false,
    description: 'Date joined the company (e.g., 01/03/2026)',
    keywords: ['joining date', 'join date', 'doj', 'joining', 'date of join', 'appointment date'],
    defaultFallback: '01/01/2026',
  },
  {
    key: 'enrollId',
    label: 'Enroll ID / Employee ID',
    required: true,
    description: 'Unique badge/enrollment number (e.g., 586665)',
    keywords: ['enroll id', 'enroll', 'id', 'employee id', 'emp id', 'staff id', 'badge id', 'card id'],
  },
  {
    key: 'cardIssue',
    label: 'Card Issue Date',
    required: false,
    description: 'Date the card was issued (e.g., 19/10/2026)',
    keywords: ['card issue', 'issue date', 'card issue date', 'issued date', 'doi', 'date of issue'],
    defaultFallback: new Date().toLocaleDateString('en-GB'),
  },
  {
    key: 'photoUrl',
    label: 'Employee Photo',
    required: false,
    description: 'Embedded Excel picture, Image URL, or Base64 string placed in photo area',
    keywords: ['embedded photo', '__embedded_photo__', 'photo', 'picture', 'image', 'photo url', 'avatar', 'img'],
  },
  {
    key: 'signatureUrl',
    label: 'Employee Signature',
    required: false,
    description: 'Optional signature image placed in the signature area without a box border',
    keywords: ['signature', 'sign', 'employee sign', 'signature url'],
  },
  {
    key: 'emergencyContact',
    label: 'Emergency Contact (Back Side)',
    required: false,
    description: 'Emergency phone number overlaid on the back side',
    keywords: ['emergency contact', 'emergency', 'phone', 'mobile', 'contact', 'cell', 'emergency phone'],
    defaultFallback: '01920-694100',
  },
  {
    key: 'nationalId',
    label: 'National ID / NID (Back Side)',
    required: false,
    description: 'National ID or Smart Card number on the back side',
    keywords: ['national id', 'nid', 'nid no', 'national id no', 'nid number', 'national identity'],
  },
  {
    key: 'bloodGroup',
    label: 'Blood Group (Back Side)',
    required: false,
    description: 'Blood group on the back side (e.g., O+, A+, B+)',
    keywords: ['blood group', 'blood', 'bg', 'blood grp', 'b.g.'],
    defaultFallback: 'O+',
  },
];

export const ColumnMappingModal: React.FC<ColumnMappingModalProps> = ({
  isOpen,
  onClose,
  headers,
  sampleRows,
  sourceName,
  onConfirmMapping,
}) => {
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [previewRowIdx, setPreviewRowIdx] = useState(0);

  // Auto-map based on keyword heuristics on open or headers change
  useEffect(() => {
    if (!headers || headers.length === 0) return;

    const initialMappings: ColumnMapping[] = FIELD_DEFINITIONS.map((def) => {
      // Find matching header
      let matchedHeader = '';
      const lowerHeaders = headers.map((h) => h.toLowerCase().trim());

      for (const kw of def.keywords) {
        const idx = lowerHeaders.findIndex(
          (h) => h === kw || h.includes(kw) || kw.includes(h)
        );
        if (idx !== -1) {
          matchedHeader = headers[idx];
          break;
        }
      }

      return {
        fieldKey: def.key,
        label: def.label,
        sourceColumn: matchedHeader,
        required: def.required,
        fallbackValue: def.defaultFallback || '',
      };
    });

    setMappings(initialMappings);
  }, [headers]);

  const handleSourceChange = (fieldKey: CardFieldKey, newSource: string) => {
    setMappings((prev) =>
      prev.map((m) => (m.fieldKey === fieldKey ? { ...m, sourceColumn: newSource } : m))
    );
  };

  const handleFallbackChange = (fieldKey: CardFieldKey, val: string) => {
    setMappings((prev) =>
      prev.map((m) => (m.fieldKey === fieldKey ? { ...m, fallbackValue: val } : m))
    );
  };

  const getMappedPreviewValue = (fieldKey: CardFieldKey): string => {
    const mapping = mappings.find((m) => m.fieldKey === fieldKey);
    if (!mapping) return '';
    const currentRow = sampleRows[previewRowIdx] || {};
    const rawVal = mapping.sourceColumn ? currentRow[mapping.sourceColumn] : '';
    if (rawVal) return String(rawVal);
    return mapping.fallbackValue || '';
  };

  const handleSaveAndGenerate = () => {
    // Validate required fields
    const missingRequired = mappings.filter(
      (m) => m.required && !m.sourceColumn && !m.fallbackValue
    );

    if (missingRequired.length > 0) {
      alert(
        `Please map the required field(s): ${missingRequired
          .map((m) => m.label)
          .join(', ')}`
      );
      return;
    }

    onConfirmMapping(mappings);
    onClose();
  };

  if (!isOpen) return null;

  const currentPreviewRow = sampleRows[previewRowIdx] || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-black p-5 text-white flex items-center justify-between flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold uppercase tracking-wider">
                Step 2
              </span>
              <h2 className="text-lg font-bold">Map Columns to ID Card Fields</h2>
            </div>
            <p className="text-xs text-gray-300 mt-0.5">
              Source: <span className="text-rose-400 font-semibold">{sourceName}</span> (
              {sampleRows.length} total rows)
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Content Body: Split into Mapping List (Left) and Live Sample Preview (Right) */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-gray-200">
          {/* Left Column: Mappings list (7 cols) */}
          <div className="lg:col-span-7 p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Card Field
              </span>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Spreadsheet Column
              </span>
            </div>

            <div className="space-y-3">
              {FIELD_DEFINITIONS.map((def) => {
                const currentMap = mappings.find((m) => m.fieldKey === def.key);
                const isMapped = Boolean(currentMap?.sourceColumn);

                return (
                  <div
                    key={def.key}
                    className={`p-3 rounded-xl border transition-all ${
                      isMapped
                        ? 'border-gray-200 bg-white hover:border-gray-300'
                        : def.required
                        ? 'border-rose-300 bg-rose-50/30'
                        : 'border-dashed border-gray-200 bg-gray-50/50'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-gray-900">
                            {def.label}
                          </span>
                          {def.required ? (
                            <span className="text-[10px] text-rose-600 font-bold">
                              *Required
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400">Optional</span>
                          )}
                          {isMapped && (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          )}
                        </div>
                        <p className="text-[10.5px] text-gray-500 mt-0.5">
                          {def.description}
                        </p>
                      </div>

                      {/* Dropdown to select header */}
                      <div className="w-full sm:w-56">
                        <select
                          value={currentMap?.sourceColumn || ''}
                          onChange={(e) => handleSourceChange(def.key, e.target.value)}
                          className={`w-full text-xs rounded-lg px-2.5 py-1.5 font-medium border transition-colors ${
                            isMapped
                              ? 'bg-emerald-50/50 border-emerald-300 text-emerald-950 font-semibold'
                              : 'bg-white border-gray-300 text-gray-700'
                          }`}
                        >
                          <option value="">-- Do Not Map --</option>
                          {headers.map((h, i) => (
                            <option key={i} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Default fallback input if optional */}
                    {!isMapped && def.defaultFallback && (
                      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                        <span>Fallback Default:</span>
                        <input
                          type="text"
                          value={currentMap?.fallbackValue || ''}
                          onChange={(e) => handleFallbackChange(def.key, e.target.value)}
                          className="bg-white border border-gray-200 rounded px-2 py-0.5 text-[11px] text-gray-700 w-44"
                          placeholder={def.defaultFallback}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Live Mapped Preview & Sample Inspector (5 cols) */}
          <div className="lg:col-span-5 p-6 bg-gray-50/70 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                    Live Record Preview
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    Inspecting Row {previewRowIdx + 1} of {sampleRows.length}
                  </p>
                </div>

                {sampleRows.length > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPreviewRowIdx((p) => Math.max(0, p - 1))}
                      disabled={previewRowIdx === 0}
                      className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-bold disabled:opacity-40"
                    >
                      ←
                    </button>
                    <button
                      onClick={() =>
                        setPreviewRowIdx((p) => Math.min(sampleRows.length - 1, p + 1))
                      }
                      disabled={previewRowIdx === sampleRows.length - 1}
                      className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-bold disabled:opacity-40"
                    >
                      →
                    </button>
                  </div>
                )}
              </div>

              {/* Card Values Inspector Table */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="bg-gray-100/70 px-3 py-2 border-b border-gray-200 text-[11px] font-bold text-gray-700">
                  Values that will appear on this card:
                </div>
                <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto text-xs">
                  {FIELD_DEFINITIONS.map((def) => {
                    const mappedVal = getMappedPreviewValue(def.key);
                    const isMissing = def.required && !mappedVal;

                    return (
                      <div
                        key={def.key}
                        className={`px-3 py-1.5 flex items-center justify-between ${
                          isMissing ? 'bg-red-50 text-red-900' : ''
                        }`}
                      >
                        <span className="text-[11px] font-medium text-gray-500">
                          {def.label}:
                        </span>
                        <span
                          className={`text-xs font-semibold max-w-[180px] truncate text-right ${
                            isMissing
                              ? 'text-red-600 font-bold'
                              : mappedVal
                              ? 'text-gray-900'
                              : 'text-gray-400 italic'
                          }`}
                        >
                          {def.key === 'photoUrl' && mappedVal ? (
                            <span className="text-purple-600 text-[10px]">
                              [Image Loaded]
                            </span>
                          ) : (
                            mappedVal || (isMissing ? 'Missing *' : 'Empty')
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-[11px] text-blue-900 flex items-start gap-2">
                <HelpCircle className="w-4 h-4 flex-shrink-0 text-blue-600 mt-0.5" />
                <p>
                  You will also be able to review and inline-edit any employee record in a table
                  before finalizing your PDF or Word export.
                </p>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-6 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAndGenerate}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
              >
                <span>Generate Cards ({sampleRows.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
