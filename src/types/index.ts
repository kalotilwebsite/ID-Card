export interface EmployeeCardData {
  id: string;
  name: string;
  designation: string;
  department: string;
  jobType: string;
  joiningDate: string;
  enrollId: string;
  cardIssue: string;
  photoUrl?: string;
  permanentAddress?: string;
  emergencyContact: string;
  nationalId: string;
  bloodGroup: string;
  signatureUrl?: string;
  isValid?: boolean;
  validationErrors?: string[];
  printStatus?: 'pending' | 'printed';
  printCount?: number;
  printedAt?: string;
  reprintHistory?: PrintHistoryItem[];
}

export type CardFieldKey =
  | 'name'
  | 'designation'
  | 'department'
  | 'jobType'
  | 'joiningDate'
  | 'enrollId'
  | 'cardIssue'
  | 'photoUrl'
  | 'permanentAddress'
  | 'emergencyContact'
  | 'nationalId'
  | 'bloodGroup'
  | 'signatureUrl';

export interface ColumnMapping {
  fieldKey: CardFieldKey;
  label: string;
  sourceColumn: string;
  required: boolean;
  fallbackValue?: string;
}

export interface FieldPositionConfig {
  x: number; // in px (based on 284x500 reference dimensions)
  y: number; // in px
  fontSize: number; // in px
  fontWeight: 'normal' | 'semibold' | 'bold' | '800' | '900';
  color: string;
  textAlign: 'left' | 'center' | 'right';
  width?: number; // for photo or signature box
  height?: number;
  letterSpacing?: string;
  whiteoutWidth?: number;
  whiteoutHeight?: number;
}

export interface CardCalibrationSettings {
  front: {
    name: FieldPositionConfig;
    designation: FieldPositionConfig;
    department: FieldPositionConfig;
    jobType: FieldPositionConfig;
    joiningDate: FieldPositionConfig;
    enrollId: FieldPositionConfig;
    cardIssue: FieldPositionConfig;
    photo: FieldPositionConfig;
    signature: FieldPositionConfig;
  };
  back: {
    emergencyContact: FieldPositionConfig;
    nationalId: FieldPositionConfig;
    bloodGroup: FieldPositionConfig;
  };
}

export const CARD_WIDTH = 284;
export const CARD_HEIGHT = 500;

export const DEFAULT_CALIBRATION: CardCalibrationSettings = {
  front: {
    name: {
      x: 18,
      y: 126,
      fontSize: 15.5,
      fontWeight: '900',
      color: '#000000',
      textAlign: 'left',
      letterSpacing: '0.2px',
      whiteoutWidth: 250,
      whiteoutHeight: 22,
    },
    designation: {
      x: 18,
      y: 162,
      fontSize: 14.2,
      fontWeight: 'bold',
      color: '#000000',
      textAlign: 'left',
      whiteoutWidth: 250,
      whiteoutHeight: 20,
    },
    department: {
      x: 18,
      y: 190,
      fontSize: 14.2,
      fontWeight: 'bold',
      color: '#000000',
      textAlign: 'left',
      whiteoutWidth: 250,
      whiteoutHeight: 20,
    },
    jobType: {
      x: 18,
      y: 224,
      fontSize: 12,
      fontWeight: 'semibold',
      color: '#000000',
      textAlign: 'left',
      whiteoutWidth: 104,
      whiteoutHeight: 18,
    },
    joiningDate: {
      x: 152,
      y: 224,
      fontSize: 12,
      fontWeight: 'semibold',
      color: '#000000',
      textAlign: 'left',
      whiteoutWidth: 104,
      whiteoutHeight: 18,
    },
    enrollId: {
      x: 18,
      y: 272,
      fontSize: 12,
      fontWeight: 'semibold',
      color: '#000000',
      textAlign: 'left',
      whiteoutWidth: 104,
      whiteoutHeight: 18,
    },
    cardIssue: {
      x: 152,
      y: 272,
      fontSize: 12,
      fontWeight: 'semibold',
      color: '#000000',
      textAlign: 'left',
      whiteoutWidth: 104,
      whiteoutHeight: 18,
    },
    photo: {
      x: 170,
      y: 334,
      width: 94,
      height: 104,
      fontSize: 10,
      fontWeight: 'normal',
      color: '#000000',
      textAlign: 'center',
      whiteoutWidth: 94,
      whiteoutHeight: 104,
    },
    signature: {
      x: 16,
      y: 372,
      width: 68,
      height: 26,
      fontSize: 10,
      fontWeight: 'normal',
      color: '#000000',
      textAlign: 'center',
      whiteoutWidth: 68,
      whiteoutHeight: 26,
    },
  },
  back: {
    emergencyContact: {
      x: 52,
      y: 236,
      fontSize: 12,
      fontWeight: '900',
      color: '#000000',
      textAlign: 'left',
      whiteoutWidth: 182,
      whiteoutHeight: 20,
    },
    nationalId: {
      x: 52,
      y: 288,
      fontSize: 11.5,
      fontWeight: '900',
      color: '#000000',
      textAlign: 'left',
      whiteoutWidth: 98,
      whiteoutHeight: 20,
    },
    bloodGroup: {
      x: 174,
      y: 288,
      fontSize: 12,
      fontWeight: '900',
      color: '#000000',
      textAlign: 'center',
      whiteoutWidth: 68,
      whiteoutHeight: 20,
    },
  },
};

export interface PaperSizeConfig {
  name: string;
  widthMm: number;
  heightMm: number;
}

export interface PrintSettings {
  paperSize: 'a4' | 'letter' | 'custom';
  customWidthMm?: number;
  customHeightMm?: number;
  orientation: 'portrait' | 'landscape';
  cardWidthMm: number;
  cardHeightMm: number;
  marginsMm: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  spacingMm: {
    horizontal: number;
    vertical: number;
  };
  columnsPerPage: number;
  rowsPerPage: number;
  layoutMode: 'duplex' | 'side-by-side' | 'front-only' | 'back-only';
  showCutMarks: boolean;
  cardBorderRadiusMm: number;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
}

export interface CompanyTemplateConfig {
  companyName: string;
  factoryAddress: string;
  contactPhones: string;
  brandTagline: string;
  validityNotice: string;
  disclaimer: string;
  returnToHeader: string;
}

export type UserRole = 'admin' | 'data_entry' | 'supervisor';

export interface AuthUser {
  id: string;
  username: string;
  employeeId?: string;
  name: string;
  email?: string;
  role: UserRole;
  status?: 'active' | 'inactive';
  createdAt?: string;
}

export interface MasterEmployee {
  enrollId: string;
  name: string;
  designation: string;
  department: string;
  jobType: string;
  joiningDate: string;
  cardIssue: string;
  emergencyContact: string;
  permanentAddress: string;
  bloodGroup: string;
  nationalId?: string;
  importedAt?: string;
}

export interface PrintHistoryItem {
  printedAt: string;
  printedBy: string;
  action: 'initial_print' | 'reprint';
  note?: string;
}

export interface SubmissionRecord {
  id: string;
  enrollId: string;
  nationalId: string;
  photoUrl: string;
  signatureUrl: string;
  employee: MasterEmployee;
  submittedBy: {
    id: string;
    name: string;
    username: string;
    employeeId?: string;
    role?: string;
  };
  submittedAt: string;
  printStatus: 'pending' | 'printed';
  printedAt?: string;
  printCount?: number;
  reprintHistory?: PrintHistoryItem[];
}

export interface AppSettings {
  supervisorSuccessMessage: string;
  loginBackgroundImage?: string;
}

