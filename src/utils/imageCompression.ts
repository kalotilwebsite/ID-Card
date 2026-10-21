/**
 * Utility for client-side image compression and validation using HTML Canvas.
 * Automatically resizes and compresses captured or uploaded employee photos and signatures
 * to keep each file size strictly at or below 200 KB while preserving crisp ID card print clarity.
 */

// Target limit: 200 KB (204,800 bytes)
export const MAX_FILE_SIZE_BYTES = 200 * 1024;

export const BANGLA_SIZE_ALERT_MESSAGE =
  'ছবি বা সিগনেচারের সাইজ অনেক বেশি বড়! অনুগ্রহ করে ২০০ কিলোবাইটের (200 KB) নিচের ছবি বা সিগনেচার আপলোড করুন।';

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  isSignature?: boolean;
}

export interface CompressResult {
  dataUrl: string;
  sizeBytes: number;
  isValidSize: boolean;
  width: number;
  height: number;
}

/**
 * Calculates the binary byte size of a Base64 data URL.
 */
export function getDataUrlSizeBytes(dataUrl: string): number {
  if (!dataUrl) return 0;
  const commaIdx = dataUrl.indexOf(',');
  const base64Data = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const padding = base64Data.endsWith('==') ? 2 : base64Data.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.round((base64Data.length * 3) / 4) - padding);
}

/**
 * Loads an image from a Data URL or object URL.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (!src || !src.trim()) {
      reject(new Error('Empty image source provided'));
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error('Failed to load image for compression: ' + err));
    img.src = src;
  });
}

/**
 * Resizes and compresses an image Data URL using HTML Canvas to strictly meet the <= 200 KB target.
 * Preserves passport-style portrait framing for photos, and narrow horizontal framing for signatures.
 */
export async function compressDataUrl(
  dataUrl: string,
  options: CompressOptions = {}
): Promise<CompressResult> {
  const isSignature = Boolean(options.isSignature);

  // Default dimensions tailored for ID cards:
  // - Photos: Max 600x750 (4:5 or 3:4 passport portrait)
  // - Signatures: Max 600x240 (wide horizontal format)
  const defaultMaxW = isSignature ? 600 : 600;
  const defaultMaxH = isSignature ? 240 : 750;

  const maxWidth = options.maxWidth || defaultMaxW;
  const maxHeight = options.maxHeight || defaultMaxH;
  const initialQuality = options.quality !== undefined ? options.quality : isSignature ? 0.88 : 0.84;

  const img = await loadImage(dataUrl);

  // Compute proportional dimensions strictly preserving original aspect ratio
  let { width, height } = img;
  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  width = Math.max(1, width);
  height = Math.max(1, height);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is not available');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // White background ensures clean edges and optimal JPEG compression
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const mimeType = 'image/jpeg';
  let quality = initialQuality;
  let compressedDataUrl = canvas.toDataURL(mimeType, quality);
  let sizeBytes = getDataUrlSizeBytes(compressedDataUrl);

  // Progressive step 1: Decrease quality if above 200 KB
  const qualitySteps = [0.80, 0.74, 0.68, 0.60];
  let stepIdx = 0;
  while (sizeBytes > MAX_FILE_SIZE_BYTES && stepIdx < qualitySteps.length) {
    quality = qualitySteps[stepIdx];
    compressedDataUrl = canvas.toDataURL(mimeType, quality);
    sizeBytes = getDataUrlSizeBytes(compressedDataUrl);
    stepIdx++;
  }

  // Progressive step 2: If still > 200 KB, scale dimensions down progressively
  let currentCanvas = canvas;
  let curW = width;
  let curH = height;
  while (sizeBytes > MAX_FILE_SIZE_BYTES && (curW > 300 || curH > 300)) {
    curW = Math.round(curW * 0.82);
    curH = Math.round(curH * 0.82);

    const stepCanvas = document.createElement('canvas');
    stepCanvas.width = curW;
    stepCanvas.height = curH;
    const stepCtx = stepCanvas.getContext('2d');
    if (!stepCtx) break;

    stepCtx.imageSmoothingEnabled = true;
    stepCtx.imageSmoothingQuality = 'high';
    stepCtx.fillStyle = '#ffffff';
    stepCtx.fillRect(0, 0, curW, curH);
    stepCtx.drawImage(currentCanvas, 0, 0, curW, curH);

    currentCanvas = stepCanvas;
    compressedDataUrl = stepCanvas.toDataURL(mimeType, 0.72);
    sizeBytes = getDataUrlSizeBytes(compressedDataUrl);
    width = curW;
    height = curH;
  }

  const isValidSize = sizeBytes <= MAX_FILE_SIZE_BYTES;

  return {
    dataUrl: compressedDataUrl,
    sizeBytes,
    isValidSize,
    width,
    height,
  };
}

/**
 * Reads a File object, compresses it via Canvas, and validates that the final size is <= 200 KB.
 */
export async function compressImageFile(
  file: File,
  options: CompressOptions = {}
): Promise<CompressResult> {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file provided'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file from disk'));
    reader.onload = async (e) => {
      try {
        const rawDataUrl = e.target?.result as string;
        const result = await compressDataUrl(rawDataUrl, options);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsDataURL(file);
  });
}
