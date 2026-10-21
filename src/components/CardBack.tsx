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
        boxSizing: 'border-box',
      }}
      className={`relative rounded-[14px] overflow-hidden select-none shadow-sm border border-slate-300 bg-white ${className}`}
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

      {/* Field 1: Emergency Contact Number (Displays all 11 digits completely without ellipses, dots or truncation) */}
      {(() => {
        const rawContact = String(employee.emergencyContact || '01920-694100').trim();
        const contactLength = rawContact.length;

        // Clean typography: bold weight, adjusted font size so all 11 digits fit with zero truncation or ellipses
        let fontSize = calibration.emergencyContact.fontSize || 11.5;
        let fontWeight: string | number = calibration.emergencyContact.fontWeight || 'bold';

        // Remove 900/heavy styling to ensure crisp, clean digit legibility without glyph crowding
        if (fontWeight === '900') {
          fontWeight = 'bold';
        }
        if (fontSize > 11.5) {
          fontSize = 11.5;
        }
        if (contactLength > 13) {
          fontSize = Math.min(10.5, 10.5 * (13 / contactLength));
        }

        const whiteoutW = Math.max(calibration.emergencyContact.whiteoutWidth || 182, 195);

        return (
          <>
            <div
              style={{
                position: 'absolute',
                left: calibration.emergencyContact.x - 2,
                top: calibration.emergencyContact.y - 2,
                width: whiteoutW,
                height: calibration.emergencyContact.whiteoutHeight || 20,
              }}
              className="bg-white"
            />
            <div
              style={{
                position: 'absolute',
                left: calibration.emergencyContact.x,
                top: calibration.emergencyContact.y,
                width: whiteoutW,
                overflow: 'visible',
              }}
              className="flex items-center"
            >
              <span
                style={{
                  fontSize: `${fontSize}px`,
                  fontWeight: fontWeight as any,
                  color: calibration.emergencyContact.color || '#000000',
                  textAlign: calibration.emergencyContact.textAlign || 'left',
                  fontFamily: "Arial, Helvetica, sans-serif",
                  letterSpacing: '0.1px',
                  whiteSpace: 'nowrap',
                  display: 'inline-block',
                }}
                className="leading-none block max-w-none select-text"
              >
                {rawContact}
              </span>
            </div>
          </>
        );
      })()}

      {/* Field 2: National ID Number (Displays all digits completely without truncation or ellipses) */}
      {(() => {
        const nid = String(employee.nationalId || '01643970731').trim();
        const nidLength = nid.length;
        // Dynamically compute font sizing and weight so all 15 digits fit cleanly without truncation
        let fontSize = calibration.nationalId.fontSize || 11.5;
        let fontWeight: string | number = calibration.nationalId.fontWeight || 'bold';
        let letterSpacing = '0px';

        if (nidLength >= 15) {
          fontSize = Math.min(9.2, 9.2 * (15 / nidLength));
          fontWeight = 'bold'; // Clean bold (not 900/black) to ensure crisp digit legibility
          letterSpacing = '-0.2px';
        } else if (nidLength >= 13) {
          fontSize = 10.0;
          fontWeight = 'bold';
          letterSpacing = '-0.1px';
        } else if (nidLength >= 11) {
          fontSize = 10.8;
          fontWeight = calibration.nationalId.fontWeight;
        }

        // Available horizontal space before Blood Group column (starts at x=174)
        const whiteoutW = Math.max(calibration.nationalId.whiteoutWidth || 98, 116);

        return (
          <>
            <div
              style={{
                position: 'absolute',
                left: calibration.nationalId.x - 2,
                top: calibration.nationalId.y - 2,
                width: whiteoutW,
                height: calibration.nationalId.whiteoutHeight || 20,
              }}
              className="bg-white"
            />
            <div
              style={{
                position: 'absolute',
                left: calibration.nationalId.x,
                top: calibration.nationalId.y,
                width: whiteoutW,
                overflow: 'visible',
              }}
              className="flex items-center"
            >
              <span
                style={{
                  fontSize: `${fontSize}px`,
                  fontWeight: fontWeight as any,
                  color: calibration.nationalId.color || '#000000',
                  textAlign: calibration.nationalId.textAlign || 'left',
                  fontFamily: "Arial, Helvetica, sans-serif",
                  letterSpacing,
                  whiteSpace: 'nowrap',
                  display: 'inline-block',
                }}
                className="leading-none block max-w-none"
              >
                {nid}
              </span>
            </div>
          </>
        );
      })()}

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

      {/* 3. Footer Area: Exact Akij Bashir Group PNG logo directly over existing black footer background */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 438,
          width: CARD_WIDTH,
          height: 62,
          backgroundColor: '#000000',
        }}
        className="flex items-center justify-center overflow-hidden pointer-events-none select-none"
      >
        <img
          src="/assets/akij_bashir_footer_logo.png"
          alt="Akij Bashir Group"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
};
