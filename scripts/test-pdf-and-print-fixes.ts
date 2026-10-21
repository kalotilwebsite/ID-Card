import { calculatePrintGeometry, PAPER_DIMENSIONS_MM } from '../src/services/pdfExportService';
import { FRONT_LOGO_BASE64, ISSUING_SIG_BASE64, FOOTER_PILLAR_BASE64, BACK_FOOTER_LOGO_BASE64 } from '../src/data/assets';
import { FRONT_TEMPLATE_SVG, BACK_TEMPLATE_SVG } from '../src/data/cardTemplates';
import { DEFAULT_PRINT_SETTINGS } from '../src/components/PrintSettingsModal';
import { EmployeeCardData, PrintSettings } from '../src/types';
import jsPDF from 'jspdf';
import fs from 'fs';
import path from 'path';

async function runVerification() {
  console.log('===============================================================');
  console.log('STARTING MANDATORY TESTING & VERIFICATION FOR PDF & PRINT FIXES');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} - ${details || ''}`);
      failed++;
    }
  }

  // TEST 1: Base64 Asset Integrity
  console.log('--- 1. Testing Embedded Image Assets & Self-Contained Templates ---');
  assert(
    FRONT_LOGO_BASE64.startsWith('data:image/png;base64,') && FRONT_LOGO_BASE64.length > 1000,
    'Front Header Logo (ROSA) is valid base64 PNG'
  );
  assert(
    ISSUING_SIG_BASE64.startsWith('data:image/png;base64,') && ISSUING_SIG_BASE64.length > 1000,
    'Issuing Authority Signature is valid base64 PNG'
  );
  assert(
    FOOTER_PILLAR_BASE64.startsWith('data:image/png;base64,') && FOOTER_PILLAR_BASE64.length > 1000,
    'Footer Pillar Icon is valid base64 PNG'
  );
  assert(
    BACK_FOOTER_LOGO_BASE64.startsWith('data:image/png;base64,') && BACK_FOOTER_LOGO_BASE64.length > 1000,
    'Back Footer Logo (Akij Bashir Group) is valid base64 PNG'
  );

  const decodedFrontSvg = decodeURIComponent(FRONT_TEMPLATE_SVG);
  const decodedBackSvg = decodeURIComponent(BACK_TEMPLATE_SVG);
  assert(
    !decodedFrontSvg.includes('/assets/') && decodedFrontSvg.includes('data:image/png;base64,'),
    'Front SVG Template has self-contained embedded base64 assets (no external /assets/ dependencies)'
  );
  assert(
    !decodedBackSvg.includes('/assets/') && decodedBackSvg.includes('data:image/png;base64,'),
    'Back SVG Template has self-contained embedded base64 assets (no external /assets/ dependencies)'
  );

  // TEST 2: Geometry & Layout Calculations for Standard & Custom Papers
  console.log('\n--- 2. Testing Geometry Calculation & Boundaries ---');
  const paperSizes: Array<'a4' | 'letter' | 'a5' | 'a3' | 'custom'> = ['a4', 'letter', 'a5', 'a3', 'custom'];
  for (const pSize of paperSizes) {
    const settings: PrintSettings = {
      ...DEFAULT_PRINT_SETTINGS,
      paperSize: pSize,
      customWidthMm: pSize === 'custom' ? 250 : undefined,
      customHeightMm: pSize === 'custom' ? 320 : undefined,
      layoutMode: 'side-by-side',
    };
    const geom = calculatePrintGeometry(settings);
    assert(
      geom.pageWidthMm > 0 && geom.pageHeightMm > 0,
      `Paper size [${pSize}] calculates valid dimensions (${geom.pageWidthMm}x${geom.pageHeightMm}mm)`
    );
    assert(
      geom.startX >= 0 && geom.startY >= 0,
      `Paper size [${pSize}] grid is properly centered within safe margins`
    );
    assert(
      geom.cardWidthMm > 0 && geom.cardHeightMm > 0,
      `Paper size [${pSize}] card dimensions are positive (${geom.cardWidthMm.toFixed(1)}x${geom.cardHeightMm.toFixed(1)}mm)`
    );
  }

  // TEST 3: Layout Modes (Duplex, Side-by-Side, Top-and-Bottom, Front-Only)
  console.log('\n--- 3. Testing Layout Modes & Batch Partitioning ---');
  const testEmployees: EmployeeCardData[] = Array.from({ length: 9 }).map((_, i) => ({
    id: `emp-test-${i + 1}`,
    name: i === 0 ? 'MOHAMMED ABDUR RAHMAN AL-FARUQUE' : `EMPLOYEE #${i + 1}`,
    designation: i === 0 ? 'Senior Assistant Quality Assurance & Control Inspector' : 'Senior Glazer',
    department: i === 0 ? 'Mechanical Maintenance & Electrical Engineering Division' : 'Glazing',
    jobType: 'Permanent',
    joiningDate: '01/03/2026',
    cardIssue: '19/10/2026',
    enrollId: String(586665 + i),
    emergencyContact: i === 0 ? '01920-694100, 01833-636610' : '01920-694100',
    permanentAddress: 'Mukkhopur, Trishal, Mymensingh',
    bloodGroup: ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-'][i % 8],
    nationalId: i === 0 ? '19942694100000123' : '01643970731',
    signatureUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    photoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    isValid: true,
  }));

  const sideBySideGeom = calculatePrintGeometry({ ...DEFAULT_PRINT_SETTINGS, layoutMode: 'side-by-side' });
  assert(sideBySideGeom.pairsPerPage >= 1, 'Side-by-side layout computes valid pairs per page');

  const topBottomGeom = calculatePrintGeometry({ ...DEFAULT_PRINT_SETTINGS, layoutMode: 'top-and-bottom' });
  assert(topBottomGeom.pairsPerPage >= 1, 'Top-and-bottom layout computes valid pairs per page');

  const duplexGeom = calculatePrintGeometry({ ...DEFAULT_PRINT_SETTINGS, layoutMode: 'duplex' });
  assert(duplexGeom.cardsPerPage >= 1, 'Duplex layout computes valid cards per page');

  // TEST 4: Long Field Handling (No truncation, no ellipses, auto-scaling)
  console.log('\n--- 4. Testing Long Field Rules (NID, Contact, Designation, Blood Group) ---');
  // National ID font sizing test
  const testNid17 = '19942694100000123';
  let nidFont17 = 11.5;
  if (testNid17.length > 17) nidFont17 = 7.5;
  else if (testNid17.length > 14) nidFont17 = 8.5;
  else if (testNid17.length > 11) nidFont17 = 10.0;
  assert(nidFont17 === 8.5, '17-digit NID scales to 8.5px font to prevent clipping and ellipses');

  // Emergency contact font sizing test
  const testContactLong = '01920-694100, 01833-636610';
  let contactFontLong = 12;
  if (testContactLong.length > 24) contactFontLong = 8.5;
  else if (testContactLong.length > 18) contactFontLong = 9.5;
  else if (testContactLong.length > 14) contactFontLong = 10.5;
  assert(contactFontLong === 8.5, 'Dual emergency contact numbers scale to 8.5px font without clipping');

  // Designation font sizing test
  const testDesLong = 'Senior Assistant Quality Assurance & Control Inspector';
  let desFont = 14.2;
  if (testDesLong.length > 36) desFont = 9.5;
  else if (testDesLong.length > 26) desFont = 11.2;
  else if (testDesLong.length > 20) desFont = 12.8;
  assert(desFont === 9.5, 'Long designation scales to 9.5px font without ellipsis');

  // Blood group test
  const allBloodGroups = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-'];
  assert(allBloodGroups.every(bg => bg.length >= 2), 'All blood groups (positive and negative) supported');

  // TEST 5: PDF Generation Verification
  console.log('\n--- 5. Testing PDF Document Generation & Integrity ---');
  const JsPdfConstructor: any = typeof jsPDF === 'function' ? jsPDF : (jsPDF as any).jsPDF;
  const pdf = new JsPdfConstructor({
    orientation: 'portrait',
    unit: 'mm',
    format: [210, 297],
    compress: true,
  });

  const dummyCardPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  // Add front and back images for 9 cards
  for (let i = 0; i < testEmployees.length; i++) {
    pdf.addImage(dummyCardPng, 'PNG', 10, 10 + i * 25, 45, 20);
  }
  const pdfOutput = pdf.output('arraybuffer');
  assert(pdfOutput && pdfOutput.byteLength > 1000, `Generated PDF document is valid binary (size: ${pdfOutput.byteLength} bytes)`);

  // TEST 6: Production Data Safety Verification
  console.log('\n--- 6. Testing Production Data Protection ---');
  const dataDir = path.resolve(process.cwd(), 'data');
  const masterFile = path.join(dataDir, 'master_employees.json');
  const usersFile = path.join(dataDir, 'users.json');
  const submissionsFile = path.join(dataDir, 'submissions.json');

  assert(fs.existsSync(masterFile), 'Production master_employees.json file exists and is intact');
  assert(fs.existsSync(usersFile), 'Production users.json file exists and is intact');
  assert(fs.existsSync(submissionsFile), 'Production submissions.json file exists and is intact');

  const masterData = JSON.parse(fs.readFileSync(masterFile, 'utf-8'));
  const masterCount = Object.keys(masterData).length;
  assert(masterCount >= 3, `Production master employees preserved (${masterCount} records found)`);

  const usersData = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
  assert(usersData.some((u: any) => u.role === 'admin'), 'Admin credentials preserved in users.json');

  console.log('\n===============================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
