import { EmployeeCardData, CompanyTemplateConfig } from '../types';

export const DEFAULT_COMPANY_CONFIG: CompanyTemplateConfig = {
  companyName: 'AKIJ CERAMICS LIMITED.',
  factoryAddress: 'Mukkhopur, Trishal, Mymensingh Bangladesh',
  contactPhones: 'Call: 01920-694100, 01833-636610',
  brandTagline: 'INNOVATIVE SANITARYWARE SOLUTION',
  validityNotice: 'VALID UNTILL REVOKED',
  disclaimer: 'In case of losing this identity card, please notify your managing authortity promotly.',
  returnToHeader: 'If found please return to:',
};

// Realistic reference avatar matching the young man in the cyan polo shirt with stripes
const createJonaidAvatar = () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 180" width="160" height="180">
    <rect width="100%" height="100%" fill="#f1f5f9"/>
    <!-- Head & Neck -->
    <path d="M70 95 L70 125 L90 125 L90 95 Z" fill="#d49a7a"/>
    <ellipse cx="80" cy="65" rx="26" ry="32" fill="#e0a98b"/>
    <!-- Hair -->
    <path d="M54 60 C54 35, 106 35, 106 60 C106 45, 96 38, 80 38 C64 38, 54 45, 54 60 Z" fill="#171717"/>
    <path d="M54 50 Q80 32 106 50 Q108 42 100 36 Q80 28 60 36 Z" fill="#171717"/>
    <!-- Eyes, Eyebrows & Nose -->
    <path d="M64 54 Q72 52 75 55" stroke="#171717" stroke-width="2" fill="none"/>
    <path d="M85 55 Q88 52 96 54" stroke="#171717" stroke-width="2" fill="none"/>
    <circle cx="70" cy="60" r="2.5" fill="#1c1917"/>
    <circle cx="90" cy="60" r="2.5" fill="#1c1917"/>
    <path d="M80 60 L78 72 L83 72" stroke="#b47858" stroke-width="1.8" fill="none"/>
    <!-- Mouth & Beard/Stubble -->
    <path d="M74 80 Q80 84 86 80" stroke="#a05d3c" stroke-width="1.8" fill="none"/>
    <path d="M60 68 C60 92, 100 92, 100 68 C96 86, 64 86, 60 68 Z" fill="#262626" opacity="0.35"/>
    <!-- Cyan Polo Shirt with White/Grey Stripes & Collar -->
    <!-- Shoulders -->
    <path d="M20 180 C20 135, 45 125, 80 125 C115 125, 140 135, 140 180 Z" fill="#06b6d4"/>
    <!-- Horizontal White/Grey Stripes on chest -->
    <rect x="25" y="146" width="110" height="9" fill="#e2e8f0"/>
    <rect x="25" y="162" width="110" height="9" fill="#f472b6" opacity="0.75"/>
    <!-- Polo Collar & Placket -->
    <path d="M66 124 L80 148 L94 124 L86 122 L80 138 L74 122 Z" fill="#0891b2"/>
    <rect x="77" y="142" width="6" height="26" fill="#0891b2"/>
    <circle cx="80" cy="148" r="1.5" fill="#ffffff"/>
    <circle cx="80" cy="158" r="1.5" fill="#ffffff"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const createJonaidSignature = () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 50" width="160" height="50">
    <!-- Cursive handwritten script signature resembling the Bengali sign in reference -->
    <path d="M12 28 Q24 16 38 26 T62 18 T88 28 T118 20 T148 24" fill="none" stroke="#0f172a" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M24 35 Q60 30 110 32 T142 30" fill="none" stroke="#0f172a" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M45 14 Q52 30 58 16" fill="none" stroke="#0f172a" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M80 14 Q88 32 94 18" fill="none" stroke="#0f172a" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const createSampleAvatar = (name: string, bg: string, text: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 190" width="160" height="190">
    <rect width="100%" height="100%" fill="${bg}"/>
    <circle cx="80" cy="70" r="38" fill="${text}" opacity="0.85"/>
    <path d="M20 180 C20 125, 45 120, 80 120 C115 120, 140 125, 140 180 Z" fill="${text}" opacity="0.85"/>
    <text x="80" y="77" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#ffffff" text-anchor="middle">${name.charAt(0)}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const createSampleSignature = (name: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 50" width="180" height="50">
    <path d="M10 32 Q35 10 55 30 T95 24 T130 35 T170 20" fill="none" stroke="#1e293b" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M30 38 L145 32" fill="none" stroke="#1e293b" stroke-width="1.2" stroke-linecap="round"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const SAMPLE_EMPLOYEES: EmployeeCardData[] = [
  {
    id: 'emp-1',
    name: 'JONAID AL AKANDH AKANDH',
    designation: 'Asst.Caster',
    department: 'Casting',
    jobType: 'Permanent',
    joiningDate: '01/03/2026',
    enrollId: '586665',
    cardIssue: '19/10/2026',
    photoUrl: createJonaidAvatar(),
    permanentAddress: 'Mukkhopur, Trishal, Mymensingh',
    emergencyContact: '01712-345678',
    nationalId: '01643970731',
    bloodGroup: 'O+',
    signatureUrl: createJonaidSignature(),
    isValid: true,
  },
  {
    id: 'emp-2',
    name: 'FATIMA ZAHRA RAHMAN',
    designation: 'Sr. Quality Officer',
    department: 'Quality Control',
    jobType: 'Permanent',
    joiningDate: '15/01/2025',
    enrollId: '582104',
    cardIssue: '19/10/2026',
    photoUrl: createSampleAvatar('F', '#7c3aed', '#6d28d9'),
    permanentAddress: 'Bhaluka, Mymensingh',
    emergencyContact: '01833-636610',
    nationalId: '1994269123456',
    bloodGroup: 'A+',
    signatureUrl: createSampleSignature('Fatima'),
    isValid: true,
  },
  {
    id: 'emp-3',
    name: 'MOHAMMED TANVIR HASAN',
    designation: 'Production Engineer',
    department: 'Glazing & Kiln',
    jobType: 'Permanent',
    joiningDate: '10/08/2024',
    enrollId: '574920',
    cardIssue: '19/10/2026',
    photoUrl: createSampleAvatar('M', '#059669', '#047857'),
    permanentAddress: 'Mukkhopur, Trishal, Mymensingh',
    emergencyContact: '01920-694100',
    nationalId: '1988269876543',
    bloodGroup: 'B+',
    signatureUrl: createSampleSignature('Tanvir'),
    isValid: true,
  },
  {
    id: 'emp-4',
    name: 'SHAMSUN NAHAR',
    designation: 'Admin Executive',
    department: 'Human Resources',
    jobType: 'Permanent',
    joiningDate: '01/02/2025',
    enrollId: '583419',
    cardIssue: '19/10/2026',
    photoUrl: createSampleAvatar('S', '#db2777', '#be185d'),
    permanentAddress: 'Sadar, Mymensingh',
    emergencyContact: '01711-223344',
    nationalId: '1996269554433',
    bloodGroup: 'AB+',
    signatureUrl: createSampleSignature('Shamsun'),
    isValid: true,
  },
  {
    id: 'emp-5',
    name: 'KABIR HOSSAIN',
    designation: 'Mechanical Technician',
    department: 'Maintenance',
    jobType: 'Contractual',
    joiningDate: '05/11/2023',
    enrollId: '569802',
    cardIssue: '19/10/2026',
    photoUrl: createSampleAvatar('K', '#d97706', '#b45309'),
    permanentAddress: 'Trishal, Mymensingh',
    emergencyContact: '01819-998877',
    nationalId: '1991269998877',
    bloodGroup: 'O-',
    signatureUrl: createSampleSignature('Kabir'),
    isValid: true,
  },
];
