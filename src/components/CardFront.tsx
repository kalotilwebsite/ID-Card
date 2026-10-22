import React from 'react';
import { EmployeeCardData, CardCalibrationSettings, CARD_WIDTH, CARD_HEIGHT } from '../types';
import { FRONT_TEMPLATE_SVG } from '../data/cardTemplates';
import { DEFAULT_CALIBRATION } from '../types';
import {
  ROSA_FRONT_LOGO_BASE64,
  FRONT_FOOTER_LOGO_BASE64,
  ISSUING_AUTHORITY_SIG_BASE64,
} from '../data/cardAssets';

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
  // Ensure calibration values always exist with rock-solid fallbacks
  const activeCalibration = {
    name: { ...DEFAULT_CALIBRATION.front.name, ...(calibration?.name || {}) },
    designation: { ...DEFAULT_CALIBRATION.front.designation, ...(calibration?.designation || {}) },
    department: { ...DEFAULT_CALIBRATION.front.department, ...(calibration?.department || {}) },
    jobType: { ...DEFAULT_CALIBRATION.front.jobType, ...(calibration?.jobType || {}) },
    joiningDate: { ...DEFAULT_CALIBRATION.front.joiningDate, ...(calibration?.joiningDate || {}) },
    enrollId: { ...DEFAULT_CALIBRATION.front.enrollId, ...(calibration?.enrollId || {}) },
    cardIssue: { ...DEFAULT_CALIBRATION.front.cardIssue, ...(calibration?.cardIssue || {}) },
    photo: { ...DEFAULT_CALIBRATION.front.photo, ...(calibration?.photo || {}) },
    signature: { ...DEFAULT_CALIBRATION.front.signature, ...(calibration?.signature || {}) },
  };

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
        boxSizing: 'border-box',
        overflow: 'hidden',
        isolation: 'isolate',
        position: 'relative',
        backgroundColor: '#FFFFFF',
      }}
      className={`relative rounded-[14px] overflow-hidden select-none shadow-sm border border-slate-300 bg-white ${className}`}
    >
      {/* =========================================================================
          LAYER 1: BASE TEMPLATE BACKGROUND (Optional Custom Upload)
          ========================================================================= */}
      {templateUrl && (
        <img
          src={templateUrl}
          alt="Front Template Background"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'fill',
            zIndex: 0,
          }}
          className="pointer-events-none select-none"
          referrerPolicy="no-referrer"
        />
      )}

      {/* =========================================================================
          LAYER 2: TOP PINK HEADER BAR & LOGO (y: 0 to 112)
          ========================================================================= */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: CARD_WIDTH,
          height: 112,
          backgroundColor: '#FCD0CC',
          zIndex: 1,
        }}
        className="rounded-t-[14px]"
      />

      {/* Exact ROSA Beyond Beauty PNG Logo (Horizontally Centered) */}
      <img
        src={ROSA_FRONT_LOGO_BASE64}
        alt="ROSA Beyond Beauty"
        style={{
          position: 'absolute',
          top: 26,
          left: Math.round((CARD_WIDTH - 128) / 2), // 78px
          width: 128,
          height: 58,
          objectFit: 'contain',
          zIndex: 2,
        }}
        className="pointer-events-none select-none"
      />

      {/* =========================================================================
          LAYER 3: CRISP WHITE BODY (y: 112 to 438)
          ========================================================================= */}
      <div
        style={{
          position: 'absolute',
          top: 112,
          left: 0,
          width: CARD_WIDTH,
          height: 326, // 112 + 326 = 438px (flushes cleanly against the red banner)
          backgroundColor: '#FFFFFF',
          zIndex: 1,
        }}
      />

      {/* =========================================================================
          LAYER 4: BOTTOM RED FOOTER BANNER (y: 438 to 500, height 62px)
          ========================================================================= */}
      <div
        style={{
          position: 'absolute',
          top: 438,
          left: 0,
          width: CARD_WIDTH,
          height: 62,
          backgroundColor: '#E31B23',
          zIndex: 2,
        }}
        className="rounded-b-[14px]"
      />

      {/* Black Logo Icon overlapping boundary into red banner */}
      <div
        style={{
          position: 'absolute',
          left: 140,
          top: 424,
          width: 23,
          height: 44,
          zIndex: 10,
        }}
        className="pointer-events-none select-none flex items-center justify-center"
      >
        <img
          src={FRONT_FOOTER_LOGO_BASE64}
          alt="Rosa Beyond Tomorrow Logo"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
          }}
          className="pointer-events-none select-none"
        />
      </div>

      {/* White "BEYOND TOMORROW" typography */}
      <div
        style={{
          position: 'absolute',
          left: 167,
          top: 446,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
        }}
        className="pointer-events-none select-none"
      >
        <span
          style={{
            fontFamily: "'Arial Black', Arial, sans-serif",
            fontWeight: 900,
            fontSize: '13px',
            lineHeight: 1.05,
            color: '#FFFFFF',
            letterSpacing: '0.4px',
            display: 'block',
          }}
        >
          BEYOND
        </span>
        <span
          style={{
            fontFamily: "'Arial Black', Arial, sans-serif",
            fontWeight: 900,
            fontSize: '13px',
            lineHeight: 1.05,
            color: '#FFFFFF',
            letterSpacing: '0.4px',
            display: 'block',
          }}
        >
          TOMORROW
        </span>
      </div>

      {/* =========================================================================
          LAYER 5: VARIABLE METADATA FIELDS (Fixed absolute coordinates, zIndex: 10)
          ========================================================================= */}

      {/* 1. Employee Name (Single line auto-fit) */}
      {(() => {
        const rawName = (employee.name || 'JONAID AL AKANDH AKANDH').trim().replace(/\s+/g, ' ');
        const len = rawName.length;

        let fontSize = activeCalibration.name.fontSize || 15.5;
        if (len > 36) {
          fontSize = Math.max(8.5, Math.min(10.2, 246 / (len * 0.58)));
        } else if (len > 28) {
          fontSize = Math.max(10.2, Math.min(11.8, 246 / (len * 0.6)));
        } else if (len > 22) {
          fontSize = Math.max(12.0, Math.min(13.6, 246 / (len * 0.62)));
        } else if (len > 16) {
          fontSize = 14.2;
        }

        return (
          <div
            style={{
              position: 'absolute',
              left: activeCalibration.name.x,
              top: activeCalibration.name.y,
              width: activeCalibration.name.whiteoutWidth || 250,
              maxWidth: 250,
              overflow: 'visible',
              zIndex: 10,
            }}
          >
            <span
              style={{
                fontSize: `${fontSize}px`,
                fontWeight: activeCalibration.name.fontWeight || '900',
                color: activeCalibration.name.color || '#000000',
                textAlign: activeCalibration.name.textAlign || 'left',
                letterSpacing: activeCalibration.name.letterSpacing || '0.1px',
                fontFamily: "'Arial Narrow', 'Arial Black', Impact, Arial, sans-serif",
                display: 'inline-block',
                transform: 'scaleY(1.18)',
                transformOrigin: 'left',
                whiteSpace: 'nowrap',
                lineHeight: 1.1,
                textTransform: 'uppercase',
              }}
            >
              {rawName}
            </span>
          </div>
        );
      })()}

      {/* 2. Designation */}
      <div
        style={{
          position: 'absolute',
          left: activeCalibration.designation.x,
          top: activeCalibration.designation.y,
          width: activeCalibration.designation.whiteoutWidth || 250,
          zIndex: 10,
        }}
      >
        <span
          style={{
            fontSize: `${activeCalibration.designation.fontSize && activeCalibration.designation.fontSize > 13.5 ? activeCalibration.designation.fontSize : 14.2}px`,
            fontWeight: activeCalibration.designation.fontWeight || 'bold',
            color: activeCalibration.designation.color || '#000000',
            textAlign: activeCalibration.designation.textAlign || 'left',
            fontFamily: 'Arial, Helvetica, sans-serif',
            display: 'inline-block',
            transform: 'scaleY(1.08)',
            transformOrigin: 'left',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '100%',
          }}
        >
          {employee.designation || 'Senior Glazer'}
        </span>
      </div>

      {/* 3. Department */}
      <div
        style={{
          position: 'absolute',
          left: activeCalibration.department.x,
          top: activeCalibration.department.y,
          width: activeCalibration.department.whiteoutWidth || 250,
          zIndex: 10,
        }}
      >
        <span
          style={{
            fontSize: `${activeCalibration.department.fontSize && activeCalibration.department.fontSize > 13.5 ? activeCalibration.department.fontSize : 14.2}px`,
            fontWeight: activeCalibration.department.fontWeight || 'bold',
            color: activeCalibration.department.color || '#000000',
            textAlign: activeCalibration.department.textAlign || 'left',
            fontFamily: 'Arial, Helvetica, sans-serif',
            display: 'inline-block',
            transform: 'scaleY(1.08)',
            transformOrigin: 'left',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '100%',
          }}
        >
          {employee.department || 'Glazing'}
        </span>
      </div>

      {/* 4. 2x2 Metadata Grid — STRICT VERTICAL STACKING with Dedicated Flex Column Containers */}
      {/* 4a. Job Type */}
      <div
        style={{
          position: 'absolute',
          left: activeCalibration.jobType.x,
          top: activeCalibration.jobType.y,
          width: 124,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          zIndex: 10,
        }}
      >
        <span
          style={{
            fontFamily: "'Arial Black', Impact, Arial, sans-serif",
            fontWeight: 900,
            fontSize: '9.2px',
            color: '#000000',
            letterSpacing: '0.4px',
            textTransform: 'uppercase',
            lineHeight: 1.15,
            display: 'block',
            transform: 'scaleY(1.08)',
            transformOrigin: 'left',
          }}
        >
          JOB TYPE
        </span>
        <span
          style={{
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: `${activeCalibration.jobType.fontSize || 12}px`,
            fontWeight: activeCalibration.jobType.fontWeight || 'bold',
            color: activeCalibration.jobType.color || '#000000',
            marginTop: '2px',
            lineHeight: 1.2,
            display: 'block',
            maxWidth: '120px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {employee.jobType || 'Permanent'}
        </span>
      </div>

      {/* 4b. Joining Date */}
      <div
        style={{
          position: 'absolute',
          left: activeCalibration.joiningDate.x,
          top: activeCalibration.joiningDate.y,
          width: 124,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          zIndex: 10,
        }}
      >
        <span
          style={{
            fontFamily: "'Arial Black', Impact, Arial, sans-serif",
            fontWeight: 900,
            fontSize: '9.2px',
            color: '#000000',
            letterSpacing: '0.4px',
            textTransform: 'uppercase',
            lineHeight: 1.15,
            display: 'block',
            transform: 'scaleY(1.08)',
            transformOrigin: 'left',
          }}
        >
          JOINING DATE
        </span>
        <span
          style={{
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: `${activeCalibration.joiningDate.fontSize || 12}px`,
            fontWeight: activeCalibration.joiningDate.fontWeight || 'bold',
            color: activeCalibration.joiningDate.color || '#000000',
            marginTop: '2px',
            lineHeight: 1.2,
            display: 'block',
            maxWidth: '120px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {employee.joiningDate || '01/03/2026'}
        </span>
      </div>

      {/* 4c. Enroll ID */}
      <div
        style={{
          position: 'absolute',
          left: activeCalibration.enrollId.x,
          top: activeCalibration.enrollId.y,
          width: 124,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          zIndex: 10,
        }}
      >
        <span
          style={{
            fontFamily: "'Arial Black', Impact, Arial, sans-serif",
            fontWeight: 900,
            fontSize: '9.2px',
            color: '#000000',
            letterSpacing: '0.4px',
            textTransform: 'uppercase',
            lineHeight: 1.15,
            display: 'block',
            transform: 'scaleY(1.08)',
            transformOrigin: 'left',
          }}
        >
          ENROLL ID
        </span>
        <span
          style={{
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: `${activeCalibration.enrollId.fontSize || 12}px`,
            fontWeight: activeCalibration.enrollId.fontWeight || 'bold',
            color: activeCalibration.enrollId.color || '#000000',
            marginTop: '2px',
            lineHeight: 1.2,
            display: 'block',
            maxWidth: '120px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {employee.enrollId || '586665'}
        </span>
      </div>

      {/* 4d. Card Issue */}
      <div
        style={{
          position: 'absolute',
          left: activeCalibration.cardIssue.x,
          top: activeCalibration.cardIssue.y,
          width: 124,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          zIndex: 10,
        }}
      >
        <span
          style={{
            fontFamily: "'Arial Black', Impact, Arial, sans-serif",
            fontWeight: 900,
            fontSize: '9.2px',
            color: '#000000',
            letterSpacing: '0.4px',
            textTransform: 'uppercase',
            lineHeight: 1.15,
            display: 'block',
            transform: 'scaleY(1.08)',
            transformOrigin: 'left',
          }}
        >
          CARD ISSUE
        </span>
        <span
          style={{
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: `${activeCalibration.cardIssue.fontSize || 12}px`,
            fontWeight: activeCalibration.cardIssue.fontWeight || 'bold',
            color: activeCalibration.cardIssue.color || '#000000',
            marginTop: '2px',
            lineHeight: 1.2,
            display: 'block',
            maxWidth: '120px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {employee.cardIssue || '19/10/2026'}
        </span>
      </div>

      {/* =========================================================================
          LAYER 6: SIGNATURES & PHOTO (Clean spacing, zero overlap with red banner)
          ========================================================================= */}

      {/* 6a. Employee Signature Area (Fixed horizontal banner bounding box: low height, wide width) */}
      <div
        style={{
          position: 'absolute',
          left: activeCalibration.signature.x ?? 16,
          top: activeCalibration.signature.y ?? 370,
          width: activeCalibration.signature.width || 72,
          height: activeCalibration.signature.height || 26,
          maxWidth: 74,
          maxHeight: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          boxSizing: 'border-box',
          backgroundColor: '#FFFFFF',
          zIndex: 10,
        }}
      >
        {employee.signatureUrl ? (
          <img
            src={employee.signatureUrl}
            alt={`${employee.name} Signature`}
            style={{
              width: '100%',
              height: '100%',
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              objectPosition: 'center',
              display: 'block',
              margin: 'auto',
            }}
            className="pointer-events-none select-none"
            referrerPolicy="no-referrer"
          />
        ) : null}
      </div>

      {/* Employee signature caption & line strictly positioned under the fixed signature box */}
      <div
        style={{
          position: 'absolute',
          left: activeCalibration.signature.x ?? 16,
          top: (activeCalibration.signature.y ?? 370) + (activeCalibration.signature.height || 26) + 1,
          width: activeCalibration.signature.width || 72,
          maxWidth: 74,
          zIndex: 10,
        }}
        className="text-center"
      >
        <div style={{ width: '100%', borderTop: '0.8px solid #94A3B8' }} />
        <span
          style={{
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: '7.5px',
            fontWeight: 'bold',
            color: '#334155',
            marginTop: '2px',
            display: 'block',
            textAlign: 'center',
          }}
        >
          Employee
        </span>
      </div>

      {/* 6b. Issuing / Authorized Authority Signature (Clean clearance from red footer) */}
      <div
        style={{
          position: 'absolute',
          left: 92,
          top: 365,
          width: 70,
          height: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          boxSizing: 'border-box',
          zIndex: 10,
        }}
        className="pointer-events-none select-none"
      >
        <img
          src={ISSUING_AUTHORITY_SIG_BASE64}
          alt="Issuing Authority Signature"
          style={{
            width: '100%',
            height: '100%',
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            objectPosition: 'center',
            display: 'block',
            margin: 'auto',
          }}
          className="pointer-events-none select-none"
        />
      </div>

      {/* 6c. Employee Photo (Strictly sits on top of red banner: 334 + 104 = 438px) */}
      <div
        style={{
          position: 'absolute',
          left: activeCalibration.photo.x ?? 170,
          top: activeCalibration.photo.y ?? 334,
          width: activeCalibration.photo.width ?? 94,
          height: activeCalibration.photo.height ?? 104,
          backgroundColor: '#FFFFFF',
          boxSizing: 'border-box',
          overflow: 'hidden',
          zIndex: 10,
          borderRadius: 2,
          border: '1px solid #D1D5DB',
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        }}
        className="flex items-center justify-center"
      >
        {employee.photoUrl ? (
          <img
            src={employee.photoUrl}
            alt={employee.name}
            className="w-full h-full object-cover object-top select-none pointer-events-none"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'top center',
              display: 'block',
            }}
          />
        ) : (
          <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center text-gray-400">
            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
            <span
              style={{
                fontFamily: 'Arial, Helvetica, sans-serif',
                fontSize: '6.5px',
                fontWeight: 'bold',
                color: '#6B7280',
                textTransform: 'uppercase',
                marginTop: '2px',
              }}
            >
              PHOTO
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
