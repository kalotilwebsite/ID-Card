import React from 'react';
import { EmployeeCardData, CardCalibrationSettings, CARD_WIDTH, CARD_HEIGHT } from '../types';
import { BACK_TEMPLATE_SVG } from '../data/cardTemplates';
import { BACK_FOOTER_LOGO_BASE64 } from '../data/assets';
import { DEFAULT_CALIBRATION } from '../types';

interface CardBackProps {
  employee: EmployeeCardData;
  templateUrl?: string;
  calibration?: CardCalibrationSettings['back'];
  scale?: number;
  className?: string;
  id?: string;
}

export const CardBack: React.FC<CardBackProps> = ({
  employee,
  templateUrl = BACK_TEMPLATE_SVG,
  calibration = DEFAULT_CALIBRATION.back,
  scale = 1,
  className = '',
  id,
}) => {
  // Safe field values with full fallbacks (ensuring complete string display)
  const emergencyContactStr = (employee.emergencyContact || '01920-694100').trim();
  const nationalIdStr = (employee.nationalId || '01643970731').trim();
  const bloodGroupStr = (employee.bloodGroup || 'O+').trim().toUpperCase();

  // Dynamic font sizing for Emergency Contact to strictly prevent truncation, ellipses, or overflow
  let emergencyFontSize = 12;
  if (emergencyContactStr.length > 28) {
    emergencyFontSize = 7.8;
  } else if (emergencyContactStr.length > 22) {
    emergencyFontSize = 8.8;
  } else if (emergencyContactStr.length > 16) {
    emergencyFontSize = 9.8;
  } else if (emergencyContactStr.length > 12) {
    emergencyFontSize = 11.0;
  }

  // Dynamic font sizing for National ID to display all digits without clipping (supporting 10, 13, 17+ digits)
  let nidFontSize = 11.5;
  if (nationalIdStr.length > 17) {
    nidFontSize = 7.5;
  } else if (nationalIdStr.length > 14) {
    nidFontSize = 8.5;
  } else if (nationalIdStr.length > 11) {
    nidFontSize = 9.8;
  }

  return (
    <div
      id={id}
      data-card-type="back"
      data-employee-id={employee.id}
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: 'top left',
      }}
      className={`relative rounded-[14px] overflow-hidden select-none shadow-md border border-gray-200/60 print:shadow-none print:border-none bg-white ${className}`}
    >
      {/* 1. Photoshop Export Background Template (Self-contained vector SVG) */}
      <img
        src={templateUrl}
        alt="Back Reference Template"
        className="absolute inset-0 w-full h-full object-fill pointer-events-none"
        style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
        loading="eager"
        decoding="sync"
        referrerPolicy="no-referrer"
      />

      {/* 2. Whiteouts & Overlays for the Three Designated Variable Fields */}

      {/* Field 1: Emergency Contact Number (Strictly pure black #000000, never white, complete value) */}
      <div
        style={{
          position: 'absolute',
          left: 50,
          top: (calibration?.emergencyContact?.y ?? 236) - 2,
          width: 188,
          height: 20,
          backgroundColor: '#FFFFFF',
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 52,
          top: calibration?.emergencyContact?.y ?? 236,
          width: 188,
          zIndex: 2,
          overflow: 'visible',
        }}
        className="flex items-center"
      >
        <span
          style={{
            fontSize: `${emergencyFontSize}px`,
            fontWeight: '900',
            color: '#000000', // Strictly black to guarantee 100% contrast on white background
            textAlign: 'left',
            fontFamily: "'Arial Black', Arial, sans-serif",
            whiteSpace: 'nowrap',
            lineHeight: 1.1,
            letterSpacing: '-0.2px',
            textOverflow: 'clip',
          }}
          className="block"
        >
          {emergencyContactStr}
        </span>
      </div>

      {/* Field 2: National ID Number (All digits displayed, strictly black #000000) */}
      <div
        style={{
          position: 'absolute',
          left: 50,
          top: (calibration?.nationalId?.y ?? 288) - 2,
          width: 118,
          height: 20,
          backgroundColor: '#FFFFFF',
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 52,
          top: calibration?.nationalId?.y ?? 288,
          width: 118,
          zIndex: 2,
          overflow: 'visible',
        }}
        className="flex items-center"
      >
        <span
          style={{
            fontSize: `${nidFontSize}px`,
            fontWeight: '900',
            color: '#000000', // Strictly black
            textAlign: 'left',
            fontFamily: "'Arial Black', Arial, sans-serif",
            whiteSpace: 'nowrap',
            lineHeight: 1.1,
            letterSpacing: '-0.2px',
            textOverflow: 'clip',
          }}
          className="block"
        >
          {nationalIdStr}
        </span>
      </div>

      {/* Field 3: Blood Group (Strictly black #000000, centered) */}
      <div
        style={{
          position: 'absolute',
          left: 172,
          top: (calibration?.bloodGroup?.y ?? 288) - 2,
          width: 68,
          height: 20,
          backgroundColor: '#FFFFFF',
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 174,
          top: calibration?.bloodGroup?.y ?? 288,
          width: 68,
          zIndex: 2,
          overflow: 'visible',
        }}
        className="flex items-center justify-center"
      >
        <span
          style={{
            fontSize: '12px',
            fontWeight: '900',
            color: '#000000', // Strictly black
            textAlign: 'center',
            fontFamily: "'Arial Black', Arial, sans-serif",
            whiteSpace: 'nowrap',
            lineHeight: 1.1,
            textOverflow: 'clip',
          }}
          className="block text-center uppercase"
        >
          {bloodGroupStr}
        </span>
      </div>

      {/* 3. Footer Area: Exact Akij Bashir Group PNG logo with preserved natural aspect ratio (293x57) */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 438,
          width: CARD_WIDTH,
          height: 62,
          backgroundColor: '#000000',
          zIndex: 5,
        }}
        className="flex items-center justify-center pointer-events-none select-none"
      >
        <img
          src={BACK_FOOTER_LOGO_BASE64}
          alt="Akij Bashir Group"
          style={{
            maxWidth: '260px',
            maxHeight: '52px',
            width: '260px',
            height: 'auto',
            objectFit: 'contain',
            display: 'block',
            margin: 'auto',
          }}
          loading="eager"
          decoding="sync"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
};
