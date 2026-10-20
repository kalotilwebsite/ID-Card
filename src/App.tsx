import React, { useState, useRef, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Settings,
  Printer,
  Upload,
  RefreshCw,
  Eye,
  Layers,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Sliders,
  Table as TableIcon,
  CheckCircle,
  AlertTriangle,
  Image as ImageIcon,
} from 'lucide-react';
import {
  EmployeeCardData,
  ColumnMapping,
  PrintSettings,
  CompanyTemplateConfig,
  CardCalibrationSettings,
  CARD_WIDTH,
  CARD_HEIGHT,
} from './types';
import { SAMPLE_EMPLOYEES, DEFAULT_COMPANY_CONFIG } from './data/sampleEmployees';
import { FRONT_TEMPLATE_SVG, BACK_TEMPLATE_SVG } from './data/cardTemplates';
import { DEFAULT_CALIBRATION } from './types';
import { CardFront } from './components/CardFront';
import { CardBack } from './components/CardBack';
import { DataImportModal } from './components/DataImportModal';
import { ColumnMappingModal } from './components/ColumnMappingModal';
import { PrintSettingsModal, DEFAULT_PRINT_SETTINGS } from './components/PrintSettingsModal';
import { EmployeeTableEditor } from './components/EmployeeTableEditor';
import { ExportModal } from './components/ExportModal';
import { FieldCalibrationModal } from './components/FieldCalibrationModal';

export default function App() {
  // Main data state
  const [employees, setEmployees] = useState<EmployeeCardData[]>(SAMPLE_EMPLOYEES);
  const [selectedEmpIndex, setSelectedEmpIndex] = useState(0);
  const [printSettings, setPrintSettings] = useState<PrintSettings>(DEFAULT_PRINT_SETTINGS);
  const [companyConfig, setCompanyConfig] = useState<CompanyTemplateConfig>(DEFAULT_COMPANY_CONFIG);

  // Template images (default to exact reference template SVGs, or custom uploaded image from localStorage)
  const [frontTemplateUrl, setFrontTemplateUrl] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('id_card_front_template');
      if (saved) return saved;
    } catch (e) {}
    return FRONT_TEMPLATE_SVG;
  });
  const [backTemplateUrl, setBackTemplateUrl] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('id_card_back_template');
      if (saved) return saved;
    } catch (e) {}
    return BACK_TEMPLATE_SVG;
  });

  const handleUploadFrontImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      setFrontTemplateUrl(url);
      try {
        localStorage.setItem('id_card_front_template', url);
      } catch (err) {}
    };
    reader.readAsDataURL(file);
  };

  const handleUploadBackImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      setBackTemplateUrl(url);
      try {
        localStorage.setItem('id_card_back_template', url);
      } catch (err) {}
    };
    reader.readAsDataURL(file);
  };

  // Calibration settings (persistent across sessions via localStorage)
  const [calibration, setCalibration] = useState<CardCalibrationSettings>(() => {
    try {
      const saved = localStorage.getItem('id_card_calibration_settings');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // ignore
    }
    return DEFAULT_CALIBRATION;
  });

  // Raw imported data state for mapping
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [currentSourceName, setCurrentSourceName] = useState<string>('Demo Sample Data');

  // UI state
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'table' | 'gallery'>('table');
  const [previewSide, setPreviewSide] = useState<'both' | 'front' | 'back'>('both');
  const [previewZoom, setPreviewZoom] = useState(0.85);

  // Modals
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isCalibrationModalOpen, setIsCalibrationModalOpen] = useState(false);

  // Ref to hidden export container
  const exportRenderRef = useRef<HTMLDivElement>(null);

  const currentEmployee = employees[selectedEmpIndex] || employees[0] || SAMPLE_EMPLOYEES[0];

  const handleDataLoaded = (data: {
    headers: string[];
    rows: Record<string, any>[];
    sourceName: string;
    embeddedImagesCount?: number;
  }) => {
    setRawHeaders(data.headers);
    setRawRows(data.rows);
    setCurrentSourceName(data.sourceName);
    setIsMappingModalOpen(true);
  };

  const handleConfirmMapping = (mappings: ColumnMapping[]) => {
    const generated: EmployeeCardData[] = rawRows.map((row, idx) => {
      const getVal = (key: string): string => {
        const m = mappings.find((item) => item.fieldKey === key);
        if (!m) return '';
        const raw = m.sourceColumn ? row[m.sourceColumn] : '';
        if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
          return String(raw).trim();
        }
        return m.fallbackValue || '';
      };

      const name = getVal('name');
      const designation = getVal('designation');
      const department = getVal('department');
      const enrollId = getVal('enrollId');

      // Check if row has an embedded photo
      let photoUrl = getVal('photoUrl');
      if (!photoUrl && row['__embedded_photo__']) {
        photoUrl = row['__embedded_photo__'];
      }

      // Check if row has an embedded signature
      let signatureUrl = getVal('signatureUrl');
      if (!signatureUrl && row['__embedded_signature__']) {
        signatureUrl = row['__embedded_signature__'];
      }

      const isValid = Boolean(name && designation && department && enrollId);

      return {
        id: `card-${idx + 1}-${Date.now()}`,
        name: name || `EMPLOYEE #${idx + 1}`,
        designation: designation || 'Staff',
        department: department || 'General',
        jobType: getVal('jobType') || 'Permanent',
        joiningDate: getVal('joiningDate') || new Date().toLocaleDateString('en-GB'),
        enrollId: enrollId || String(100000 + idx),
        cardIssue: getVal('cardIssue') || new Date().toLocaleDateString('en-GB'),
        photoUrl: photoUrl || undefined,
        emergencyContact: getVal('emergencyContact') || '01920-694100',
        nationalId: getVal('nationalId') || '',
        bloodGroup: getVal('bloodGroup') || 'O+',
        signatureUrl: signatureUrl || undefined,
        isValid,
      };
    });

    setEmployees(generated);
    setSelectedEmpIndex(0);
  };

  const handleLoadSample = () => {
    setEmployees(SAMPLE_EMPLOYEES);
    setSelectedEmpIndex(0);
    setCurrentSourceName('Akij Ceramics & Rosa Certified Sample');
  };

  const getCardElement = (empId: string, side: 'front' | 'back'): HTMLElement | null => {
    return document.getElementById(`export-${side}-${empId}`);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Top Application Bar */}
      <header className="bg-slate-950/90 border-b border-slate-800 backdrop-blur sticky top-0 z-30 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-md">
        {/* Brand and Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 to-rose-400 flex items-center justify-center text-white shadow-md shadow-rose-900/40">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-black tracking-tight text-white">
                Bulk Employee ID Card Generator
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                EXACT REFERENCE TEMPLATES
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Active Dataset: <span className="text-rose-400 font-semibold">{currentSourceName}</span> ({employees.length} cards)
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Data</span>
          </button>

          {rawHeaders.length > 0 && (
            <button
              onClick={() => setIsMappingModalOpen(true)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all border border-slate-700 flex items-center gap-1.5"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Map Columns</span>
            </button>
          )}

          <button
            onClick={() => setIsCalibrationModalOpen(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all border border-slate-700 flex items-center gap-1.5"
            title="Calibrate field positions and overlay directly onto template"
          >
            <Sliders className="w-3.5 h-3.5 text-rose-400" />
            <span>Field Calibration</span>
          </button>

          <label className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all border border-slate-700 flex items-center gap-1.5 cursor-pointer" title="Select Front Reference.jpg file from your device">
            <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
            <span>Upload Front Reference.jpg</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleUploadFrontImage(e.target.files[0]);
                }
              }}
            />
          </label>

          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all border border-slate-700 flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Layout</span>
          </button>

          <button
            onClick={() => setIsExportModalOpen(true)}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-950/40 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export (PDF & Word)</span>
          </button>

          <button
            onClick={handleLoadSample}
            title="Reset to default reference demo employees"
            className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition-colors border border-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Workspace Body: Left (Table/Gallery) & Right (Card Preview) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Section: Tabs and Controls */}
        <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-900/50 overflow-hidden">
          {/* Workspace Tabs Header */}
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/40 px-4 pt-2">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveWorkspaceTab('table')}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-t-lg transition-colors border-b-2 ${
                  activeWorkspaceTab === 'table'
                    ? 'border-rose-500 text-white bg-slate-800/60'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                Employee Table & Validation ({employees.length})
              </button>

              <button
                onClick={() => setActiveWorkspaceTab('gallery')}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-t-lg transition-colors border-b-2 ${
                  activeWorkspaceTab === 'gallery'
                    ? 'border-rose-500 text-white bg-slate-800/60'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                All Cards Gallery
              </button>
            </div>

            <div className="pb-1 text-[11px] text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Original Templates Active
            </div>
          </div>

          {/* Tab 1: Table & Validation */}
          {activeWorkspaceTab === 'table' && (
            <div className="flex-1 p-4 overflow-y-auto">
              <EmployeeTableEditor
                employees={employees}
                onUpdateEmployees={setEmployees}
                selectedEmployeeId={currentEmployee.id}
                onSelectEmployeeForPreview={(id) => {
                  const idx = employees.findIndex((e) => e.id === id);
                  if (idx !== -1) setSelectedEmpIndex(idx);
                }}
              />
            </div>
          )}

          {/* Tab 2: Gallery Grid */}
          {activeWorkspaceTab === 'gallery' && (
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Generated ID Card Gallery</h3>
                  <p className="text-xs text-slate-400">
                    Showing {employees.length} front and back cards rendered over the exact reference templates
                  </p>
                </div>
                <div className="text-xs text-slate-400">
                  Click any card to inspect or calibrate
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {employees.map((emp, index) => (
                  <div
                    key={emp.id}
                    onClick={() => setSelectedEmpIndex(index)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      index === selectedEmpIndex
                        ? 'border-rose-500 bg-slate-800/80 shadow-lg shadow-rose-950/20 ring-1 ring-rose-500'
                        : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3 text-xs">
                      <span className="font-bold text-white truncate max-w-[150px]">
                        {emp.name}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                        {emp.enrollId}
                      </span>
                    </div>

                    <div className="flex justify-center gap-3 overflow-hidden py-2">
                      <div className="transform scale-[0.45] origin-top -mb-64">
                        <CardFront
                          employee={emp}
                          templateUrl={frontTemplateUrl}
                          calibration={calibration.front}
                        />
                      </div>
                      <div className="transform scale-[0.45] origin-top -mb-64">
                        <CardBack
                          employee={emp}
                          templateUrl={backTemplateUrl}
                          calibration={calibration.back}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Section: Live ID Card Preview Panel */}
        <div className="w-full lg:w-[480px] xl:w-[540px] bg-slate-950 flex flex-col justify-between p-4 sm:p-6 overflow-y-auto">
          {/* Preview Controls Header */}
          <div className="space-y-3 pb-3 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Live Card Preview
                </h3>
              </div>

              {/* Front / Back / Both Toggle */}
              <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px] font-semibold">
                <button
                  onClick={() => setPreviewSide('both')}
                  className={`px-2 py-1 rounded-md transition-colors ${
                    previewSide === 'both' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Both Sides
                </button>
                <button
                  onClick={() => setPreviewSide('front')}
                  className={`px-2 py-1 rounded-md transition-colors ${
                    previewSide === 'front' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Front
                </button>
                <button
                  onClick={() => setPreviewSide('back')}
                  className={`px-2 py-1 rounded-md transition-colors ${
                    previewSide === 'back' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Back
                </button>
              </div>
            </div>

            {/* Employee Pager Navigation */}
            <div className="flex items-center justify-between bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setSelectedEmpIndex((p) => Math.max(0, p - 1))}
                disabled={selectedEmpIndex === 0}
                className="p-1 rounded hover:bg-slate-800 text-slate-300 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="text-center">
                <span className="font-bold text-white block">
                  {currentEmployee.name}
                </span>
                <span className="text-[10px] text-slate-400">
                  Employee {selectedEmpIndex + 1} of {employees.length} · ID: {currentEmployee.enrollId}
                </span>
              </div>

              <button
                onClick={() => setSelectedEmpIndex((p) => Math.min(employees.length - 1, p + 1))}
                disabled={selectedEmpIndex === employees.length - 1}
                className="p-1 rounded hover:bg-slate-800 text-slate-300 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Zoom & Calibration Controls */}
            <div className="flex items-center justify-between text-xs text-slate-400">
              <button
                onClick={() => setIsCalibrationModalOpen(true)}
                className="text-xs text-rose-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Calibrate Overlays</span>
              </button>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPreviewZoom((z) => Math.max(0.6, z - 0.1))}
                  className="p-1 rounded hover:bg-slate-800 text-slate-300"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-[11px] font-bold text-slate-300">
                  {Math.round(previewZoom * 100)}%
                </span>
                <button
                  onClick={() => setPreviewZoom((z) => Math.min(1.2, z + 0.1))}
                  className="p-1 rounded hover:bg-slate-800 text-slate-300"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Centered Rendered Cards */}
          <div className="flex-1 flex items-center justify-center py-6 overflow-x-auto">
            <div className="flex items-center justify-center gap-6 transition-all duration-200">
              {(previewSide === 'both' || previewSide === 'front') && (
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                    Front Side (9 Fields Overlaid)
                  </span>
                  <div
                    style={{
                      width: CARD_WIDTH * previewZoom,
                      height: CARD_HEIGHT * previewZoom,
                    }}
                    className="relative transition-all"
                  >
                    <CardFront
                      employee={currentEmployee}
                      templateUrl={frontTemplateUrl}
                      calibration={calibration.front}
                      scale={previewZoom}
                    />
                  </div>
                </div>
              )}

              {(previewSide === 'both' || previewSide === 'back') && (
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                    Back Side (Strictly 3 Fields Overlaid)
                  </span>
                  <div
                    style={{
                      width: CARD_WIDTH * previewZoom,
                      height: CARD_HEIGHT * previewZoom,
                    }}
                    className="relative transition-all"
                  >
                    <CardBack
                      employee={currentEmployee}
                      templateUrl={backTemplateUrl}
                      calibration={calibration.back}
                      scale={previewZoom}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Card Status & Export Action */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
            <div className="text-[11px] text-slate-400">
              {currentEmployee.isValid ? (
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Valid & Ready
                </span>
              ) : (
                <span className="text-rose-400 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Missing required fields
                </span>
              )}
            </div>

            <button
              onClick={() => setIsExportModalOpen(true)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export All ({employees.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Hidden Offscreen Container for Export Rendering */}
      <div
        ref={exportRenderRef}
        style={{
          position: 'absolute',
          left: -99999,
          top: -99999,
          pointerEvents: 'none',
          opacity: 1,
        }}
        aria-hidden="true"
      >
        {employees.map((emp) => (
          <div key={emp.id} className="flex">
            <CardFront
              id={`export-front-${emp.id}`}
              employee={emp}
              templateUrl={frontTemplateUrl}
              calibration={calibration.front}
              scale={1}
            />
            <CardBack
              id={`export-back-${emp.id}`}
              employee={emp}
              templateUrl={backTemplateUrl}
              calibration={calibration.back}
              scale={1}
            />
          </div>
        ))}
      </div>

      {/* Modals */}
      <DataImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onDataLoaded={handleDataLoaded}
        onLoadSample={handleLoadSample}
      />

      <ColumnMappingModal
        isOpen={isMappingModalOpen}
        onClose={() => setIsMappingModalOpen(false)}
        headers={rawHeaders}
        sampleRows={rawRows}
        sourceName={currentSourceName}
        onConfirmMapping={handleConfirmMapping}
      />

      <FieldCalibrationModal
        isOpen={isCalibrationModalOpen}
        onClose={() => setIsCalibrationModalOpen(false)}
        calibration={calibration}
        onChangeCalibration={setCalibration}
        frontTemplateUrl={frontTemplateUrl}
        backTemplateUrl={backTemplateUrl}
        onUpdateFrontTemplate={setFrontTemplateUrl}
        onUpdateBackTemplate={setBackTemplateUrl}
        onResetTemplates={() => {
          setFrontTemplateUrl(FRONT_TEMPLATE_SVG);
          setBackTemplateUrl(BACK_TEMPLATE_SVG);
        }}
      />

      <PrintSettingsModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        settings={printSettings}
        onChangeSettings={setPrintSettings}
        totalCardsCount={employees.length}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        employees={employees}
        settings={printSettings}
        companyConfig={companyConfig}
        getCardElement={getCardElement}
      />
    </div>
  );
}
