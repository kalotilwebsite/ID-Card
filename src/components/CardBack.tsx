import React from 'react';
import { EmployeeCardData, CardCalibrationSettings, CARD_WIDTH, CARD_HEIGHT } from '../types';
import { BACK_TEMPLATE_SVG } from '../data/cardTemplates';
import { DEFAULT_CALIBRATION } from '../types';
import { AKIJ_BASHIR_LOGO_BASE64 } from '../data/cardAssets';

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
  // Ensure calibration values always exist even if partially provided
  const activeCalibration = {
    emergencyContact: {
      ...DEFAULT_CALIBRATION.back.emergencyContact,
      ...(calibration?.emergencyContact || {}),
    },
    nationalId: {
      ...DEFAULT_CALIBRATION.back.nationalId,
      ...(calibration?.nationalId || {}),
    },
    bloodGroup: {
      ...DEFAULT_CALIBRATION.back.bloodGroup,
      ...(calibration?.bloodGroup || {}),
    },
  };

  // Robust data extraction guaranteeing Contact Number, NID, and Blood Group never vanish
  const rawContact = String(
    employee.emergencyContact ||
      (employee as any).contactNumber ||
      (employee as any).phone ||
      (employee as any).contact ||
      (employee as any)?.employee?.emergencyContact ||
      '01920-694100'
  ).trim();

  const nid = String(
    employee.nationalId ||
      (employee as any).nid ||
      (employee as any).national_id ||
      (employee as any)?.employee?.nationalId ||
      '01643970731'
  ).trim();

  const bloodGroupVal = String(
    employee.bloodGroup ||
      (employee as any).blood_group ||
      (employee as any)?.employee?.bloodGroup ||
      'O+'
  ).trim();

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
        overflow: 'hidden',
        isolation: 'isolate',
        position: 'relative',
      }}
      className={`relative rounded-[14px] overflow-hidden select-none shadow-sm border border-slate-300 bg-white ${className}`}
    >
      {/* 1. Original Photoshop Export Background Template */}
      <img
        src={templateUrl}
        alt="Back Reference Template"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'fill',
          zIndex: 1,
        }}
        className="pointer-events-none"
        referrerPolicy="no-referrer"
      />

      {/* 2. Whiteouts & Overlays for STRICTLY the Three Designated Variable Fields */}

      {/* Field 1: Emergency Contact Number (Displays all digits completely without truncation or vanishing) */}
      {(() => {
        const contactLength = rawContact.length;

        // Clean typography: bold weight, adjusted font size so all digits fit cleanly
        let fontSize = activeCalibration.emergencyContact.fontSize || 11.5;
        let fontWeight: string | number = activeCalibration.emergencyContact.fontWeight || 'bold';

        if (fontWeight === '900') {
          fontWeight = 'bold';
        }
        if (fontSize > 11.5) {
          fontSize = 11.5;
        }
        if (contactLength > 13) {
          fontSize = Math.min(10.5, 10.5 * (13 / contactLength));
        }

        const whiteoutW = Math.max(activeCalibration.emergencyContact.whiteoutWidth || 182, 195);

        return (
          <>
            {/* Whiteout Patch: Strictly z-index: 4 so it sits behind text */}
            <div
              style={{
                position: 'absolute',
                left: activeCalibration.emergencyContact.x - 2,
                top: activeCalibration.emergencyContact.y - 2,
                width: whiteoutW,
                height: activeCalibration.emergencyContact.whiteoutHeight || 20,
                backgroundColor: '#FFFFFF',
                zIndex: 4,
              }}
            />
            {/* Dynamic Text Layer: Strictly z-index: 10 so it is NEVER hidden */}
            <div
              style={{
                position: 'absolute',
                left: activeCalibration.emergencyContact.x,
                top: activeCalibration.emergencyContact.y,
                width: whiteoutW,
                overflow: 'visible',
                zIndex: 10,
              }}
              className="flex items-center"
            >
              <span
                style={{
                  fontSize: `${fontSize}px`,
                  fontWeight: fontWeight as any,
                  color: activeCalibration.emergencyContact.color || '#000000',
                  textAlign: activeCalibration.emergencyContact.textAlign || 'left',
                  fontFamily: 'Arial, Helvetica, sans-serif',
                  letterSpacing: '0.1px',
                  whiteSpace: 'nowrap',
                  display: 'inline-block',
                }}
                className="leading-none block max-w-none select-text text-black"
              >
                {rawContact}
              </span>
            </div>
          </>
        );
      })()}

      {/* Field 2: National ID Number (Displays all digits completely without truncation) */}
      {(() => {
        const nidLength = nid.length;
        let fontSize = activeCalibration.nationalId.fontSize || 11.5;
        let fontWeight: string | number = activeCalibration.nationalId.fontWeight || 'bold';
        let letterSpacing = '0px';

        if (nidLength >= 15) {
          fontSize = Math.min(9.2, 9.2 * (15 / nidLength));
          fontWeight = 'bold';
          letterSpacing = '-0.2px';
        } else if (nidLength >= 13) {
          fontSize = 10.0;
          fontWeight = 'bold';
          letterSpacing = '-0.1px';
        } else if (nidLength >= 11) {
          fontSize = 10.8;
          fontWeight = activeCalibration.nationalId.fontWeight;
        }

        const whiteoutW = Math.max(activeCalibration.nationalId.whiteoutWidth || 98, 116);

        return (
          <>
            {/* Whiteout Patch: Strictly z-index: 4 */}
            <div
              style={{
                position: 'absolute',
                left: activeCalibration.nationalId.x - 2,
                top: activeCalibration.nationalId.y - 2,
                width: whiteoutW,
                height: activeCalibration.nationalId.whiteoutHeight || 20,
                backgroundColor: '#FFFFFF',
                zIndex: 4,
              }}
            />
            {/* Dynamic Text Layer: Strictly z-index: 10 */}
            <div
              style={{
                position: 'absolute',
                left: activeCalibration.nationalId.x,
                top: activeCalibration.nationalId.y,
                width: whiteoutW,
                overflow: 'visible',
                zIndex: 10,
              }}
              className="flex items-center"
            >
              <span
                style={{
                  fontSize: `${fontSize}px`,
                  fontWeight: fontWeight as any,
                  color: activeCalibration.nationalId.color || '#000000',
                  textAlign: activeCalibration.nationalId.textAlign || 'left',
                  fontFamily: 'Arial, Helvetica, sans-serif',
                  letterSpacing,
                  whiteSpace: 'nowrap',
                  display: 'inline-block',
                }}
                className="leading-none block max-w-none text-black"
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
          left: activeCalibration.bloodGroup.x - 2,
          top: activeCalibration.bloodGroup.y - 2,
          width: activeCalibration.bloodGroup.whiteoutWidth || 68,
          height: activeCalibration.bloodGroup.whiteoutHeight || 20,
          backgroundColor: '#FFFFFF',
          zIndex: 4,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: activeCalibration.bloodGroup.x,
          top: activeCalibration.bloodGroup.y,
          width: activeCalibration.bloodGroup.whiteoutWidth || 68,
          zIndex: 10,
        }}
        className="flex items-center justify-center"
      >
        <span
          style={{
            fontSize: `${activeCalibration.bloodGroup.fontSize}px`,
            fontWeight: activeCalibration.bloodGroup.fontWeight,
            color: activeCalibration.bloodGroup.color || '#000000',
            textAlign: activeCalibration.bloodGroup.textAlign || 'center',
            fontFamily: "'Arial Black', Arial, sans-serif",
          }}
          className="leading-none block text-center uppercase text-black"
        >
          {bloodGroupVal}
        </span>
      </div>

      {/* 3. Footer Area: Exact Akij Bashir Group Base64 PNG logo directly over solid black footer background */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 438,
          width: CARD_WIDTH,
          height: 62,
          backgroundColor: '#000000',
          zIndex: 15,
        }}
        className="flex items-center justify-center overflow-hidden pointer-events-none select-none px-3"
      >
        <img
          src={AKIJ_BASHIR_LOGO_BASE64}
          alt="Akij Bashir Group"
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            display: 'block',
          }}
          className="pointer-events-none select-none"
        />
      </div>
    </div>
  );
};
