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
  // Safe field values with full fallbacks
  const emergencyContactStr = (employee.emergencyContact || '01920-694100').trim();
  const nationalIdStr = (employee.nationalId || '01643970731').trim();
  const bloodGroupStr = (employee.bloodGroup || 'O+').trim().toUpperCase();

  // Dynamic font sizing for Emergency Contact to strictly prevent truncation or ellipses
  let emergencyFontSize = calibration.emergencyContact.fontSize || 12;
  if (emergencyContactStr.length > 24) {
    emergencyFontSize = 8.5;
  } else if (emergencyContactStr.length > 18) {
    emergencyFontSize = 9.5;
  } else if (emergencyContactStr.length > 14) {
    emergencyFontSize = 10.5;
  }

  // Dynamic font sizing for National ID to display all digits without clipping
  let nidFontSize = calibration.nationalId.fontSize || 11.5;
  if (nationalIdStr.length > 17) {
    nidFontSize = 7.5;
  } else if (nationalIdStr.length > 14) {
    nidFontSize = 8.5;
  } else if (nationalIdStr.length > 11) {
    nidFontSize = 10.0;
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
        referrerPolicy="no-referrer"
      />

      {/* 2. Whiteouts & Overlays for the Three Designated Variable Fields */}

      {/* Field 1: Emergency Contact Number */}
      <div
        style={{
          position: 'absolute',
          left: calibration.emergencyContact.x - 2,
          top: calibration.emergencyContact.y - 2,
          width: Math.max(182, calibration.emergencyContact.whiteoutWidth || 182),
          height: calibration.emergencyContact.whiteoutHeight || 20,
          backgroundColor: '#FFFFFF',
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: calibration.emergencyContact.x,
          top: calibration.emergencyContact.y,
          width: Math.max(182, calibration.emergencyContact.whiteoutWidth || 182),
          zIndex: 2,
        }}
        className="flex items-center"
      >
        <span
          style={{
            fontSize: `${emergencyFontSize}px`,
            fontWeight: calibration.emergencyContact.fontWeight || '900',
            color: calibration.emergencyContact.color || '#000000',
            textAlign: calibration.emergencyContact.textAlign || 'left',
            fontFamily: "'Arial Black', Arial, sans-serif",
            whiteSpace: 'nowrap',
            lineHeight: 1.1,
            letterSpacing: '-0.2px',
          }}
          className="block"
        >
          {emergencyContactStr}
        </span>
      </div>

      {/* Field 2: National ID Number */}
      <div
        style={{
          position: 'absolute',
          left: calibration.nationalId.x - 2,
          top: calibration.nationalId.y - 2,
          width: 116,
          height: calibration.nationalId.whiteoutHeight || 20,
          backgroundColor: '#FFFFFF',
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: calibration.nationalId.x,
          top: calibration.nationalId.y,
          width: 116,
          zIndex: 2,
        }}
        className="flex items-center"
      >
        <span
          style={{
            fontSize: `${nidFontSize}px`,
            fontWeight: calibration.nationalId.fontWeight || '900',
            color: calibration.nationalId.color || '#000000',
            textAlign: calibration.nationalId.textAlign || 'left',
            fontFamily: "'Arial Black', Arial, sans-serif",
            whiteSpace: 'nowrap',
            lineHeight: 1.1,
            letterSpacing: '-0.2px',
          }}
          className="block"
        >
          {nationalIdStr}
        </span>
      </div>

      {/* Field 3: Blood Group */}
      <div
        style={{
          position: 'absolute',
          left: calibration.bloodGroup.x - 2,
          top: calibration.bloodGroup.y - 2,
          width: calibration.bloodGroup.whiteoutWidth || 68,
          height: calibration.bloodGroup.whiteoutHeight || 20,
          backgroundColor: '#FFFFFF',
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: calibration.bloodGroup.x,
          top: calibration.bloodGroup.y,
          width: calibration.bloodGroup.whiteoutWidth || 68,
          zIndex: 2,
        }}
        className="flex items-center justify-center"
      >
        <span
          style={{
            fontSize: `${calibration.bloodGroup.fontSize || 12}px`,
            fontWeight: calibration.bloodGroup.fontWeight || '900',
            color: calibration.bloodGroup.color || '#000000',
            textAlign: calibration.bloodGroup.textAlign || 'center',
            fontFamily: "'Arial Black', Arial, sans-serif",
            whiteSpace: 'nowrap',
            lineHeight: 1.1,
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
        className="flex items-center justify-center overflow-hidden pointer-events-none select-none"
      >
        <img
          src={BACK_FOOTER_LOGO_BASE64}
          alt="Akij Bashir Group"
          style={{
            maxWidth: 260,
            maxHeight: 52,
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
            display: 'block',
          }}
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
};
