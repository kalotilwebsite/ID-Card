import React from 'react';
import { EmployeeCardData, CardCalibrationSettings, CARD_WIDTH, CARD_HEIGHT } from '../types';
import { BACK_TEMPLATE_SVG } from '../data/cardTemplates';
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
      {/* 1. Original Photoshop Export Background Template */}
      {/* Contains:
          - "If found please return to:"
          - "AKIJ CERAMICS LIMITED."
          - "Mukkhopur, Trishal, Mymensingh Bangladesh"
          - "Call: 01920-694100, 01833-636610"
          - Terracotta box with "EMPLOYEE INFORMATION"
          - "PERMANENT ADDRESS" and "Mukkhopur, Trishal, Mymensingh"
          - "EMERGENCY CONTACT", "NATIONAL ID", "BLOOD GROUP" labels
          - "VALID UNTILL REVOKED"
          - "In case of losing this identity card, please notify your managing authortity promotly."
          - Bottom black banner with AkijBashir Group logo
      */}
      <img
        src={templateUrl}
        alt="Back Reference Template"
        className="absolute inset-0 w-full h-full object-fill pointer-events-none"
        referrerPolicy="no-referrer"
      />

      {/* 2. Whiteouts & Overlays for STRICTLY the Three Designated Variable Fields */}

      {/* Field 1: Emergency Contact Number */}
      <div
        style={{
          position: 'absolute',
          left: calibration.emergencyContact.x - 2,
          top: calibration.emergencyContact.y - 2,
          width: calibration.emergencyContact.whiteoutWidth || 182,
          height: calibration.emergencyContact.whiteoutHeight || 20,
        }}
        className="bg-white"
      />
      <div
        style={{
          position: 'absolute',
          left: calibration.emergencyContact.x,
          top: calibration.emergencyContact.y,
          width: calibration.emergencyContact.whiteoutWidth || 182,
        }}
        className="flex items-center"
      >
        <span
          style={{
            fontSize: `${calibration.emergencyContact.fontSize}px`,
            fontWeight: calibration.emergencyContact.fontWeight,
            color: calibration.emergencyContact.color,
            textAlign: calibration.emergencyContact.textAlign,
            fontFamily: "'Arial Black', Arial, sans-serif",
          }}
          className="leading-none truncate block max-w-full tracking-tight"
        >
          {employee.emergencyContact || '01920-694100'}
        </span>
      </div>

      {/* Field 2: National ID Number */}
      <div
        style={{
          position: 'absolute',
          left: calibration.nationalId.x - 2,
          top: calibration.nationalId.y - 2,
          width: calibration.nationalId.whiteoutWidth || 98,
          height: calibration.nationalId.whiteoutHeight || 20,
        }}
        className="bg-white"
      />
      <div
        style={{
          position: 'absolute',
          left: calibration.nationalId.x,
          top: calibration.nationalId.y,
          width: calibration.nationalId.whiteoutWidth || 98,
        }}
        className="flex items-center"
      >
        <span
          style={{
            fontSize: `${calibration.nationalId.fontSize}px`,
            fontWeight: calibration.nationalId.fontWeight,
            color: calibration.nationalId.color,
            textAlign: calibration.nationalId.textAlign,
            fontFamily: "'Arial Black', Arial, sans-serif",
          }}
          className="leading-none truncate block max-w-full tracking-tight"
        >
          {employee.nationalId || '01643970731'}
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
        }}
        className="bg-white"
      />
      <div
        style={{
          position: 'absolute',
          left: calibration.bloodGroup.x,
          top: calibration.bloodGroup.y,
          width: calibration.bloodGroup.whiteoutWidth || 68,
        }}
        className="flex items-center justify-center"
      >
        <span
          style={{
            fontSize: `${calibration.bloodGroup.fontSize}px`,
            fontWeight: calibration.bloodGroup.fontWeight,
            color: calibration.bloodGroup.color,
            textAlign: calibration.bloodGroup.textAlign,
            fontFamily: "'Arial Black', Arial, sans-serif",
          }}
          className="leading-none block text-center uppercase"
        >
          {employee.bloodGroup || 'O+'}
        </span>
      </div>
    </div>
  );
};
