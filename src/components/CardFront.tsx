import React from 'react';
import { EmployeeCardData, CardCalibrationSettings, CARD_WIDTH, CARD_HEIGHT } from '../types';
import { FRONT_TEMPLATE_SVG } from '../data/cardTemplates';
import { FRONT_LOGO_BASE64, ISSUING_SIG_BASE64, FOOTER_PILLAR_BASE64 } from '../data/assets';
import { DEFAULT_CALIBRATION } from '../types';

interface CardFrontProps {
  employee: EmployeeCardData;
  templateUrl?: string;
  calibration?: CardCalibrationSettings['front'];
  scale?: number;
  className?: string;
  id?: string;
}

export const CardFront: React.FC<CardFrontProps> = ({
  employee,
  templateUrl = FRONT_TEMPLATE_SVG,
  calibration = DEFAULT_CALIBRATION.front,
  scale = 1,
  className = '',
  id,
}) => {
  // Dimensions for the 3 distinct integrated sections:
  // 1. Top Section (header containing pink background and ROSA logo): y=0 to y=114
  // 2. Middle Section (variable text area on white background): y=114 to y=332
  // 3. Lower Section (signature, photo, and bottom red banner): y=332 to y=500
  const HEADER_HEIGHT = 114;
  const LOWER_START_Y = 332;
  const LOWER_HEIGHT = CARD_HEIGHT - LOWER_START_Y; // 168px

  // Dynamic font sizing for Name to guarantee single-line fit without truncation
  const rawName = (employee.name || 'JONAID AL AKANDH').trim().replace(/\s+/g, ' ');
  const nameLen = rawName.length;
  let nameFontSize = 15.5;
  if (nameLen > 36) {
    nameFontSize = 9.2;
  } else if (nameLen > 28) {
    nameFontSize = 11.0;
  } else if (nameLen > 22) {
    nameFontSize = 12.8;
  } else if (nameLen > 16) {
    nameFontSize = 14.2;
  }

  // Dynamic font sizing for Designation to prevent overflow or truncation
  const rawDesignation = (employee.designation || 'Staff').trim();
  const desLen = rawDesignation.length;
  let desFontSize = calibration.designation.fontSize && calibration.designation.fontSize > 13.5 ? calibration.designation.fontSize : 14.2;
  if (desLen > 36) {
    desFontSize = 9.5;
  } else if (desLen > 26) {
    desFontSize = 11.2;
  } else if (desLen > 20) {
    desFontSize = 12.8;
  }

  // Dynamic font sizing for Department to prevent overflow or truncation
  const rawDepartment = (employee.department || 'General').trim();
  const deptLen = rawDepartment.length;
  let deptFontSize = calibration.department.fontSize && calibration.department.fontSize > 13.5 ? calibration.department.fontSize : 14.2;
  if (deptLen > 36) {
    deptFontSize = 9.5;
  } else if (deptLen > 26) {
    deptFontSize = 11.2;
  } else if (deptLen > 20) {
    deptFontSize = 12.8;
  }

  return (
    <div
      id={id}
      data-card-type="front"
      data-employee-id={employee.id}
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: 'top left',
      }}
      className={`relative rounded-[14px] overflow-hidden select-none shadow-md border border-gray-200/70 print:shadow-none print:border-none bg-white flex flex-col justify-between ${className}`}
    >
      {/* =========================================================================
          SECTION 1: CROPPED TOP SECTION (Header with Pink Background & ROSA Logo)
          ========================================================================= */}
      <div
        style={{
          width: CARD_WIDTH,
          height: HEADER_HEIGHT,
          position: 'relative',
          overflow: 'hidden',
        }}
        className="rounded-t-[14px] flex-shrink-0"
      >
        <img
          src={templateUrl}
          alt="Front Header Crop"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            objectFit: 'fill',
          }}
          className="pointer-events-none select-none"
          referrerPolicy="no-referrer"
        />

        {/* Clean patch matching header background */}
        <div
          style={{
            position: 'absolute',
            left: 125,
            top: 16,
            width: 150,
            height: 84,
            backgroundColor: '#FCD0CC',
          }}
        />

        {/* High-res self-contained ROSA logo */}
        <div
          style={{
            position: 'absolute',
            top: 26,
            left: 136,
            width: 128,
            height: 58,
          }}
          className="flex items-center justify-center pointer-events-none select-none"
        >
          <img
            src={FRONT_LOGO_BASE64}
            alt="ROSA Beyond Beauty"
            style={{
              maxWidth: 128,
              maxHeight: 58,
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              display: 'block',
            }}
            referrerPolicy="no-referrer"
          />
        </div>
      </div>

      {/* =========================================================================
          SECTION 2: MIDDLE SECTION (Variable Text Fields)
          ========================================================================= */}
      <div
        style={{
          width: CARD_WIDTH,
          height: LOWER_START_Y - HEADER_HEIGHT, // 218px
          position: 'relative',
          backgroundColor: '#FFFFFF',
        }}
        className="flex-shrink-0 px-4 pt-1.5"
      >
        {/* 1. Employee Name (Single line, complete text, never clipped) */}
        <div
          style={{
            position: 'absolute',
            left: calibration.name.x,
            top: calibration.name.y - HEADER_HEIGHT,
            width: 250,
            maxWidth: 250,
            overflow: 'visible',
            zIndex: 2,
          }}
        >
          <span
            style={{
              fontSize: `${nameFontSize}px`,
              fontWeight: '900',
              color: calibration.name.color || '#000000',
              textAlign: calibration.name.textAlign || 'left',
              letterSpacing: '0.1px',
              fontFamily: "'Arial Narrow', 'Arial Black', Impact, Arial, sans-serif",
              display: 'inline-block',
              transform: 'scaleY(1.06)',
              transformOrigin: 'left',
              whiteSpace: 'nowrap',
              lineHeight: 1.15,
            }}
            className="uppercase block"
          >
            {rawName}
          </span>
        </div>

        {/* 2. Designation (Auto-scaled for long titles, complete text without ellipses) */}
        <div
          style={{
            position: 'absolute',
            left: calibration.designation.x,
            top: calibration.designation.y - HEADER_HEIGHT,
            width: calibration.designation.whiteoutWidth || 250,
            zIndex: 2,
          }}
        >
          <span
            style={{
              fontSize: `${desFontSize}px`,
              fontWeight: calibration.designation.fontWeight || 'bold',
              color: calibration.designation.color || '#000000',
              textAlign: calibration.designation.textAlign || 'left',
              fontFamily: 'Arial, Helvetica, sans-serif',
              display: 'inline-block',
              transform: 'scaleY(1.04)',
              transformOrigin: 'left',
              whiteSpace: 'nowrap',
              lineHeight: 1.2,
            }}
            className="block max-w-full"
          >
            {rawDesignation}
          </span>
        </div>

        {/* 3. Department (Auto-scaled for long departments, complete text without ellipses) */}
        <div
          style={{
            position: 'absolute',
            left: calibration.department.x,
            top: calibration.department.y - HEADER_HEIGHT,
            width: calibration.department.whiteoutWidth || 250,
            zIndex: 2,
          }}
        >
          <span
            style={{
              fontSize: `${deptFontSize}px`,
              fontWeight: calibration.department.fontWeight || 'bold',
              color: calibration.department.color || '#000000',
              textAlign: calibration.department.textAlign || 'left',
              fontFamily: 'Arial, Helvetica, sans-serif',
              display: 'inline-block',
              transform: 'scaleY(1.04)',
              transformOrigin: 'left',
              whiteSpace: 'nowrap',
              lineHeight: 1.2,
            }}
            className="block max-w-full"
          >
            {rawDepartment}
          </span>
        </div>

        {/* 4. 2x2 Grid Labels & Values (No ellipses, complete strings) */}
        {/* Row 1: JOB TYPE & JOINING DATE */}
        <div
          style={{
            position: 'absolute',
            left: 18,
            top: calibration.jobType.y - HEADER_HEIGHT - 12,
            zIndex: 2,
          }}
        >
          <span
            style={{ display: 'inline-block', transform: 'scaleY(1.08)', transformOrigin: 'left' }}
            className="font-['Arial_Black',Arial,sans-serif] font-black text-[9.2px] uppercase tracking-wider text-black block"
          >
            JOB TYPE
          </span>
          <span
            style={{
              fontSize: `${calibration.jobType.fontSize || 12}px`,
              fontWeight: calibration.jobType.fontWeight || '600',
              color: calibration.jobType.color || '#000000',
              fontFamily: 'Arial, Helvetica, sans-serif',
              whiteSpace: 'nowrap',
            }}
            className="leading-none block mt-0.5"
          >
            {employee.jobType || 'Permanent'}
          </span>
        </div>

        <div
          style={{
            position: 'absolute',
            left: 152,
            top: calibration.joiningDate.y - HEADER_HEIGHT - 12,
            zIndex: 2,
          }}
        >
          <span
            style={{ display: 'inline-block', transform: 'scaleY(1.08)', transformOrigin: 'left' }}
            className="font-['Arial_Black',Arial,sans-serif] font-black text-[9.2px] uppercase tracking-wider text-black block"
          >
            JOINING DATE
          </span>
          <span
            style={{
              fontSize: `${calibration.joiningDate.fontSize || 12}px`,
              fontWeight: calibration.joiningDate.fontWeight || '600',
              color: calibration.joiningDate.color || '#000000',
              fontFamily: 'Arial, Helvetica, sans-serif',
              whiteSpace: 'nowrap',
            }}
            className="leading-none block mt-0.5"
          >
            {employee.joiningDate || '01/03/2026'}
          </span>
        </div>

        {/* Row 2: ENROLL ID & CARD ISSUE */}
        <div
          style={{
            position: 'absolute',
            left: 18,
            top: calibration.enrollId.y - HEADER_HEIGHT - 12,
            zIndex: 2,
          }}
        >
          <span
            style={{ display: 'inline-block', transform: 'scaleY(1.08)', transformOrigin: 'left' }}
            className="font-['Arial_Black',Arial,sans-serif] font-black text-[9.2px] uppercase tracking-wider text-black block"
          >
            ENROLL ID
          </span>
          <span
            style={{
              fontSize: `${calibration.enrollId.fontSize || 12}px`,
              fontWeight: calibration.enrollId.fontWeight || '600',
              color: calibration.enrollId.color || '#000000',
              fontFamily: 'Arial, Helvetica, sans-serif',
              whiteSpace: 'nowrap',
            }}
            className="leading-none block mt-0.5"
          >
            {employee.enrollId || '586665'}
          </span>
        </div>

        <div
          style={{
            position: 'absolute',
            left: 152,
            top: calibration.cardIssue.y - HEADER_HEIGHT - 12,
            zIndex: 2,
          }}
        >
          <span
            style={{ display: 'inline-block', transform: 'scaleY(1.08)', transformOrigin: 'left' }}
            className="font-['Arial_Black',Arial,sans-serif] font-black text-[9.2px] uppercase tracking-wider text-black block"
          >
            CARD ISSUE
          </span>
          <span
            style={{
              fontSize: `${calibration.cardIssue.fontSize || 12}px`,
              fontWeight: calibration.cardIssue.fontWeight || '600',
              color: calibration.cardIssue.color || '#000000',
              fontFamily: 'Arial, Helvetica, sans-serif',
              whiteSpace: 'nowrap',
            }}
            className="leading-none block mt-0.5"
          >
            {employee.cardIssue || '19/10/2026'}
          </span>
        </div>
      </div>

      {/* =========================================================================
          SECTION 3: CROPPED LOWER SECTION (Signatures, Photo & Red Footer Banner)
          ========================================================================= */}
      <div
        style={{
          width: CARD_WIDTH,
          height: LOWER_HEIGHT, // 168px
          position: 'relative',
          overflow: 'hidden',
        }}
        className="rounded-b-[14px] flex-shrink-0"
      >
        {/* Background of Lower Section */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: CARD_WIDTH,
            height: 106,
            backgroundColor: '#FFFFFF',
          }}
        />

        {/* Bottom Red Footer Banner */}
        <div
          style={{
            position: 'absolute',
            top: 106,
            left: 0,
            width: CARD_WIDTH,
            height: 62,
            backgroundColor: '#E31B23',
          }}
        />

        {/* 1. EMPLOYEE SIGNATURE (Strict box dimensions, preserved aspect ratio, never oversized or shifting) */}
        {(() => {
          const sigTop = calibration.signature.y > 100 ? calibration.signature.y - LOWER_START_Y : (calibration.signature.y || 40);
          const sigHeight = calibration.signature.height || 26;
          return (
            <>
              <div
                style={{
                  position: 'absolute',
                  left: calibration.signature.x ?? 16,
                  top: sigTop,
                  width: 68,
                  height: sigHeight,
                  maxWidth: 68,
                  maxHeight: sigHeight,
                  backgroundColor: '#FFFFFF',
                  zIndex: 3,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxSizing: 'border-box',
                }}
              >
                {employee.signatureUrl ? (
                  <img
                    src={employee.signatureUrl}
                    alt={`${employee.name} Signature`}
                    style={{
                      maxWidth: '68px',
                      maxHeight: `${sigHeight}px`,
                      width: 'auto',
                      height: 'auto',
                      objectFit: 'contain',
                      display: 'block',
                      margin: 'auto',
                    }}
                    loading="eager"
                    decoding="sync"
                    crossOrigin="anonymous"
                    className="pointer-events-none select-none"
                    referrerPolicy="no-referrer"
                  />
                ) : null}
              </div>

              {/* Employee signature line & caption */}
              <div
                style={{
                  position: 'absolute',
                  left: calibration.signature.x ?? 16,
                  top: sigTop + sigHeight,
                  width: 68,
                  zIndex: 3,
                }}
                className="text-center"
              >
                <div className="w-full border-t border-gray-400 mt-0.5" />
                <span className="text-[7.5px] font-sans font-bold text-slate-700 block mt-0.5">
                  Employee
                </span>
              </div>
            </>
          );
        })()}

        {/* 2. ISSUING / AUTHORIZED SIGNATURE */}
        <div
          style={{
            position: 'absolute',
            left: 92,
            top: 28,
            width: 72,
            height: 46,
            zIndex: 3,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          className="pointer-events-none select-none"
        >
          <img
            src={ISSUING_SIG_BASE64}
            alt="Issuing Authority Signature"
            style={{
              maxWidth: '72px',
              maxHeight: '46px',
              width: 'auto',
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

        {/* 3. EMPLOYEE PHOTO */}
        <div
          style={{
            position: 'absolute',
            left: calibration.photo.x ?? 170,
            top: (calibration.photo.y ? calibration.photo.y - LOWER_START_Y : 2),
            width: 94,
            height: 104,
            backgroundColor: '#FFFFFF',
            boxSizing: 'border-box',
            zIndex: 3,
          }}
          className="overflow-hidden flex items-center justify-center rounded-[2px] border border-gray-300 shadow-sm"
        >
          {employee.photoUrl ? (
            <img
              src={employee.photoUrl}
              alt={employee.name}
              className="w-full h-full object-cover object-top select-none pointer-events-none"
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center text-gray-400">
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
              <span className="text-[6.5px] font-bold text-gray-500 uppercase mt-0.5">
                PHOTO
              </span>
            </div>
          )}
        </div>

        {/* 4. FOOTER: PILLAR LOGO & "BEYOND TOMORROW" */}
        <div
          style={{
            position: 'absolute',
            left: 140,
            top: 92,
            width: 22,
            height: 44,
            zIndex: 10,
          }}
          className="pointer-events-none select-none flex items-center justify-center"
        >
          <img
            src={FOOTER_PILLAR_BASE64}
            alt="Footer Pillar"
            style={{
              maxWidth: 22,
              maxHeight: 44,
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              display: 'block',
            }}
            referrerPolicy="no-referrer"
          />
        </div>

        <div
          style={{
            position: 'absolute',
            left: 167,
            top: 114,
            zIndex: 10,
          }}
          className="pointer-events-none select-none flex flex-col"
        >
          <span className="font-['Arial_Black',Arial,sans-serif] font-black text-[13px] leading-[1.05] text-white tracking-[0.4px]">
            BEYOND
          </span>
          <span className="font-['Arial_Black',Arial,sans-serif] font-black text-[13px] leading-[1.05] text-white tracking-[0.4px]">
            TOMORROW
          </span>
        </div>
      </div>
    </div>
  );
};
