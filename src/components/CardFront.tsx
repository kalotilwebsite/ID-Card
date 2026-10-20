import React from 'react';
import { EmployeeCardData, CardCalibrationSettings, CARD_WIDTH, CARD_HEIGHT } from '../types';
import { FRONT_TEMPLATE_SVG } from '../data/cardTemplates';
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
  // 1. Top Section (cropped header containing color, background, and logo): y=0 to y=114
  // 2. Middle Section (variable text area on white background): y=114 to y=332
  // 3. Lower Section (cropped starting from signature and photo down to bottom): y=332 to y=500
  const HEADER_HEIGHT = 114;
  const LOWER_START_Y = 332;
  const LOWER_HEIGHT = CARD_HEIGHT - LOWER_START_Y; // 168px

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
          SECTION 1: CROPPED TOP SECTION
          (Contains color, pink background, and the ROSA logo above the name)
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

        {/* Clean patch removing the original logo and subtitle cleanly, preserving background color */}
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

        {/* Exact replacement PNG logo and subtitle */}
        <img
          src="/assets/aistudio/Fornt_part_png_logo_fe48da95.png"
          alt="ROSA Beyond Beauty"
          style={{
            position: 'absolute',
            top: 26,
            left: 136,
            width: 128,
            height: 58,
            objectFit: 'contain',
          }}
          className="pointer-events-none select-none"
          referrerPolicy="no-referrer"
        />
      </div>

      {/* =========================================================================
          SECTION 2: MIDDLE SECTION (Variable Text Fields)
          (Employee Name, Designation, Department, 2x2 Grid for Job Type & Dates)
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
        {/* 1. Employee Name */}
        <div
          style={{
            position: 'absolute',
            left: calibration.name.x,
            top: calibration.name.y - HEADER_HEIGHT,
            width: calibration.name.whiteoutWidth || 250,
          }}
        >
          <span
            style={{
              fontSize: `${calibration.name.fontSize}px`,
              fontWeight: calibration.name.fontWeight,
              color: calibration.name.color,
              textAlign: calibration.name.textAlign,
              letterSpacing: calibration.name.letterSpacing || '0.2px',
              fontFamily: "'Arial Black', Impact, Arial, sans-serif",
            }}
            className="uppercase leading-tight truncate block max-w-full"
          >
            {employee.name || 'JONAID AL AKANDH AKANDH'}
          </span>
        </div>

        {/* 2. Designation */}
        <div
          style={{
            position: 'absolute',
            left: calibration.designation.x,
            top: calibration.designation.y - HEADER_HEIGHT,
            width: calibration.designation.whiteoutWidth || 250,
          }}
        >
          <span
            style={{
              fontSize: `${calibration.designation.fontSize}px`,
              fontWeight: calibration.designation.fontWeight,
              color: calibration.designation.color,
              textAlign: calibration.designation.textAlign,
              fontFamily: 'Arial, Helvetica, sans-serif',
            }}
            className="leading-snug truncate block max-w-full"
          >
            {employee.designation || 'Asst.Caster'}
          </span>
        </div>

        {/* 3. Department */}
        <div
          style={{
            position: 'absolute',
            left: calibration.department.x,
            top: calibration.department.y - HEADER_HEIGHT,
            width: calibration.department.whiteoutWidth || 250,
          }}
        >
          <span
            style={{
              fontSize: `${calibration.department.fontSize}px`,
              fontWeight: calibration.department.fontWeight,
              color: calibration.department.color,
              textAlign: calibration.department.textAlign,
              fontFamily: 'Arial, Helvetica, sans-serif',
            }}
            className="leading-snug truncate block max-w-full"
          >
            {employee.department || 'Casting'}
          </span>
        </div>

        {/* 4. 2x2 Grid Labels & Values */}
        {/* Row 1: JOB TYPE & JOINING DATE */}
        <div
          style={{
            position: 'absolute',
            left: 18,
            top: calibration.jobType.y - HEADER_HEIGHT - 12,
          }}
        >
          <span className="font-['Arial_Black',Arial,sans-serif] font-black text-[8.5px] uppercase tracking-wider text-black block">
            JOB TYPE
          </span>
          <span
            style={{
              fontSize: `${calibration.jobType.fontSize}px`,
              fontWeight: calibration.jobType.fontWeight,
              color: calibration.jobType.color,
              fontFamily: 'Arial, Helvetica, sans-serif',
            }}
            className="leading-none block truncate max-w-[110px] mt-0.5"
          >
            {employee.jobType || 'Permanent'}
          </span>
        </div>

        <div
          style={{
            position: 'absolute',
            left: 152,
            top: calibration.joiningDate.y - HEADER_HEIGHT - 12,
          }}
        >
          <span className="font-['Arial_Black',Arial,sans-serif] font-black text-[8.5px] uppercase tracking-wider text-black block">
            JOINING DATE
          </span>
          <span
            style={{
              fontSize: `${calibration.joiningDate.fontSize}px`,
              fontWeight: calibration.joiningDate.fontWeight,
              color: calibration.joiningDate.color,
              fontFamily: 'Arial, Helvetica, sans-serif',
            }}
            className="leading-none block truncate max-w-[110px] mt-0.5"
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
          }}
        >
          <span className="font-['Arial_Black',Arial,sans-serif] font-black text-[8.5px] uppercase tracking-wider text-black block">
            ENROLL ID
          </span>
          <span
            style={{
              fontSize: `${calibration.enrollId.fontSize}px`,
              fontWeight: calibration.enrollId.fontWeight,
              color: calibration.enrollId.color,
              fontFamily: 'Arial, Helvetica, sans-serif',
            }}
            className="leading-none block truncate max-w-[110px] mt-0.5"
          >
            {employee.enrollId || '586665'}
          </span>
        </div>

        <div
          style={{
            position: 'absolute',
            left: 152,
            top: calibration.cardIssue.y - HEADER_HEIGHT - 12,
          }}
        >
          <span className="font-['Arial_Black',Arial,sans-serif] font-black text-[8.5px] uppercase tracking-wider text-black block">
            CARD ISSUE
          </span>
          <span
            style={{
              fontSize: `${calibration.cardIssue.fontSize}px`,
              fontWeight: calibration.cardIssue.fontWeight,
              color: calibration.cardIssue.color,
              fontFamily: 'Arial, Helvetica, sans-serif',
            }}
            className="leading-none block truncate max-w-[110px] mt-0.5"
          >
            {employee.cardIssue || '19/10/2026'}
          </span>
        </div>
      </div>

      {/* =========================================================================
          SECTION 3: CROPPED LOWER SECTION
          (Starting from signature area and image, all the way to the very bottom)
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
        {/* Background of Lower Section: White card body (top 106px) + Red footer banner (bottom 62px) */}
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

        {/* Bottom Red Footer Banner (Preserving original red footer background) */}
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

        {/* 1. EMPLOYEE SIGNATURE (Kept exactly as currently implemented) */}
        <div
          style={{
            position: 'absolute',
            left: calibration.signature.x,
            top: calibration.signature.y - LOWER_START_Y,
            width: calibration.signature.width || 76,
            height: calibration.signature.height || 26,
            backgroundColor: '#FFFFFF',
          }}
          className="flex items-center justify-center overflow-hidden"
        >
          {employee.signatureUrl ? (
            <img
              src={employee.signatureUrl}
              alt="Signature"
              className="max-h-full max-w-full object-contain"
              referrerPolicy="no-referrer"
            />
          ) : null}
        </div>
        {/* Employee signature caption & line */}
        <div
          style={{
            position: 'absolute',
            left: calibration.signature.x,
            top: calibration.signature.y - LOWER_START_Y + (calibration.signature.height || 26),
            width: calibration.signature.width || 76,
          }}
          className="text-center"
        >
          <div className="w-full border-t border-gray-400 mt-0.5" />
          <span className="text-[7.5px] font-sans text-slate-700 block mt-0.5">
            employee
          </span>
        </div>

        {/* 2. ISSUING AUTHORITY SIGNATURE (Exact signature from user cropped reference) */}
        <div
          style={{
            position: 'absolute',
            left: 78,
            top: 24,
            width: 70,
            height: 52,
          }}
          className="flex items-center justify-center pointer-events-none select-none"
        >
          <img
            src="/assets/issuing_authority_signature.png"
            alt="Issuing Authority Signature"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
            referrerPolicy="no-referrer"
          />
        </div>

        {/* 3. EMPLOYEE PHOTO (Dynamic photo field with exact dimensions & position) */}
        <div
          style={{
            position: 'absolute',
            left: calibration.photo.x,
            top: calibration.photo.y - LOWER_START_Y,
            width: calibration.photo.width || 94,
            height: calibration.photo.height || 104,
            backgroundColor: '#FFFFFF',
          }}
          className="overflow-hidden flex items-center justify-center rounded-sm"
        >
          {employee.photoUrl ? (
            <img
              src={employee.photoUrl}
              alt={employee.name}
              className="w-full h-full object-cover object-top"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center text-gray-400 border border-gray-200">
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
              <span className="text-[6.5px] font-bold text-gray-500 uppercase mt-0.5">
                PHOTO
              </span>
            </div>
          )}
        </div>

        {/* 4. FOOTER: BLACK PILLAR ICON & TEXT ("BEYOND TOMORROW") */}
        {/* Black pillar logo icon placed immediately to the left of the text, overlapping the red banner */}
        <div
          style={{
            position: 'absolute',
            left: 135,
            top: 84,
            width: 28,
            height: 44,
            zIndex: 10,
          }}
          className="pointer-events-none select-none"
        >
          <img
            src="/assets/footer_pillar_icon.png"
            alt="Logo Icon"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
            referrerPolicy="no-referrer"
          />
        </div>

        {/* White "BEYOND TOMORROW" typography matching reference */}
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
