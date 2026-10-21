import html2canvas from 'html2canvas-pro';
import { EmployeeCardData, CARD_WIDTH, CARD_HEIGHT } from '../types';

export interface CopyCardResult {
  success: boolean;
  method: 'clipboard' | 'download';
  message: string;
  blob?: Blob;
  dataUrl?: string;
  width?: number;
  height?: number;
  error?: any;
}

/**
 * Combines front and back of an employee card side-by-side into a single high-resolution image
 * and copies it to the system clipboard (or downloads as PNG fallback).
 */
export async function copyCardSideBySideToClipboard(
  employee: EmployeeCardData,
  getCardElement: (empId: string, side: 'front' | 'back') => HTMLElement | null,
  options?: {
    scale?: number;
    gap?: number;
    padding?: number;
    forceDownload?: boolean;
  }
): Promise<CopyCardResult> {
  const scale = options?.scale ?? 3;
  const gap = options?.gap ?? 32;
  const padding = options?.padding ?? 16;

  // 1. Locate Front and Back DOM elements
  let frontEl = getCardElement(employee.id, 'front');
  let backEl = getCardElement(employee.id, 'back');

  // Fallback to inspector DOM elements if offscreen element isn't directly resolved
  if (!frontEl) {
    frontEl = (document.getElementById(`inspect-front-${employee.id}`) ||
      document.querySelector(`[data-card-type="front"][data-employee-id="${employee.id}"]`)) as HTMLElement | null;
  }
  if (!backEl) {
    backEl = (document.getElementById(`inspect-back-${employee.id}`) ||
      document.querySelector(`[data-card-type="back"][data-employee-id="${employee.id}"]`)) as HTMLElement | null;
  }

  if (!frontEl || !backEl) {
    throw new Error(
      `Could not find card preview elements for employee ID: ${employee.enrollId || employee.id}`
    );
  }

  // 2. Capture each side with html2canvas preserving exact appearance
  const canvasFront = await html2canvas(frontEl, {
    scale,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
  });

  const canvasBack = await html2canvas(backEl, {
    scale,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
  });

  // 3. Create a combined canvas side-by-side
  const totalWidth = canvasFront.width + canvasBack.width + gap + padding * 2;
  const totalHeight = Math.max(canvasFront.height, canvasBack.height) + padding * 2;

  const combinedCanvas = document.createElement('canvas');
  combinedCanvas.width = totalWidth;
  combinedCanvas.height = totalHeight;

  const ctx = combinedCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize 2D context for card combination canvas.');
  }

  // Clean white background - standard for printing and Microsoft Word paste
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  // Draw Front Side on Left
  const frontY = padding + Math.round((totalHeight - padding * 2 - canvasFront.height) / 2);
  ctx.drawImage(canvasFront, padding, frontY);

  // Draw Back Side on Right
  const backX = padding + canvasFront.width + gap;
  const backY = padding + Math.round((totalHeight - padding * 2 - canvasBack.height) / 2);
  ctx.drawImage(canvasBack, backX, backY);

  // 4. Generate PNG Blob
  const blob = await new Promise<Blob | null>((resolve) => {
    combinedCanvas.toBlob(resolve, 'image/png');
  });

  if (!blob) {
    throw new Error('Failed to generate PNG image blob from combined card canvas.');
  }

  const dataUrl = combinedCanvas.toDataURL('image/png');
  const safeName = (employee.enrollId || employee.name || 'card').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `ID_Card_${safeName}_Front_Back.png`;

  // 5. Try copying to clipboard via ClipboardItem
  if (
    !options?.forceDownload &&
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof ClipboardItem !== 'undefined'
  ) {
    try {
      const clipboardItem = new ClipboardItem({ 'image/png': blob });
      await navigator.clipboard.write([clipboardItem]);

      return {
        success: true,
        method: 'clipboard',
        message: `Card for ${employee.name || employee.enrollId} copied to clipboard! Paste directly into Word with Ctrl+V.`,
        blob,
        dataUrl,
        width: totalWidth,
        height: totalHeight,
      };
    } catch (clipErr) {
      console.warn(
        'navigator.clipboard.write failed (likely iframe permission restriction), falling back to download:',
        clipErr
      );
      // Fall through to download fallback
    }
  }

  // 6. Download fallback if clipboard is unavailable or blocked by browser/iframe policy
  downloadPngBlob(blob, filename);

  return {
    success: true,
    method: 'download',
    message: `Card image downloaded as "${filename}" (clipboard write restricted in iframe). You can insert or copy it into Word.`,
    blob,
    dataUrl,
    width: totalWidth,
    height: totalHeight,
  };
}

/**
 * Trigger immediate browser download of the PNG blob
 */
export function downloadPngBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
